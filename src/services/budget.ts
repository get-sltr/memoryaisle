// Smart Budget Tracker Service
// Budget management with spending analytics from purchase_history

import { supabase } from './supabase';
import { logger } from '../utils/logger';

export interface Budget {
  id: string;
  household_id: string;
  amount: number;
  period: 'weekly' | 'monthly';
  start_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SpendingSummary {
  totalSpent: number;
  budgetAmount: number;
  remaining: number;
  percentUsed: number;
  daysLeft: number;
  dailyAverage: number;
  projectedTotal: number;
  status: 'green' | 'yellow' | 'red'; // under 60%, 60-85%, over 85%
}

export interface CategoryBreakdown {
  category: string;
  total: number;
  percentage: number;
  itemCount: number;
}

export interface MonthlyTrend {
  month: string; // 'Jan 2026'
  spent: number;
  budget: number;
}

class BudgetService {
  // Get active budget for a household
  async getBudget(
    householdId: string,
    period: 'weekly' | 'monthly' = 'monthly'
  ): Promise<{ success: boolean; budget?: Budget; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('budgets')
        .select('*')
        .eq('household_id', householdId)
        .eq('period', period)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      return { success: true, budget: data || undefined };
    } catch (error: any) {
      logger.error('Error fetching budget:', error);
      return { success: false, error: error.message };
    }
  }

  // Set or update budget
  async setBudget(
    householdId: string,
    amount: number,
    period: 'weekly' | 'monthly' = 'monthly'
  ): Promise<{ success: boolean; budget?: Budget; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('budgets')
        .upsert({
          household_id: householdId,
          amount,
          period,
          is_active: true,
          start_date: new Date().toISOString().split('T')[0],
        }, {
          onConflict: 'household_id,period',
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, budget: data };
    } catch (error: any) {
      logger.error('Error setting budget:', error);
      return { success: false, error: error.message };
    }
  }

  // Get spending for current period
  async getSpendingSummary(
    householdId: string,
    budget: Budget
  ): Promise<SpendingSummary> {
    try {
      const { periodStart, periodEnd, daysLeft, totalDays } = this.getPeriodDates(budget);

      const { data, error } = await supabase
        .from('purchase_history')
        .select('price')
        .eq('household_id', householdId)
        .gte('purchased_at', periodStart)
        .lt('purchased_at', periodEnd);

      if (error) throw error;

      const totalSpent = (data || []).reduce((sum, row) => sum + (row.price || 0), 0);
      const remaining = Math.max(0, budget.amount - totalSpent);
      const percentUsed = budget.amount > 0 ? (totalSpent / budget.amount) * 100 : 0;
      const daysPassed = totalDays - daysLeft;
      const dailyAverage = daysPassed > 0 ? totalSpent / daysPassed : 0;
      const projectedTotal = dailyAverage * totalDays;

      let status: 'green' | 'yellow' | 'red' = 'green';
      if (percentUsed >= 85) status = 'red';
      else if (percentUsed >= 60) status = 'yellow';

      return {
        totalSpent: Math.round(totalSpent * 100) / 100,
        budgetAmount: budget.amount,
        remaining: Math.round(remaining * 100) / 100,
        percentUsed: Math.round(percentUsed),
        daysLeft,
        dailyAverage: Math.round(dailyAverage * 100) / 100,
        projectedTotal: Math.round(projectedTotal * 100) / 100,
        status,
      };
    } catch (error: any) {
      logger.error('Error getting spending summary:', error);
      return {
        totalSpent: 0,
        budgetAmount: budget.amount,
        remaining: budget.amount,
        percentUsed: 0,
        daysLeft: 0,
        dailyAverage: 0,
        projectedTotal: 0,
        status: 'green',
      };
    }
  }

  // Get spending by category for current period
  async getCategoryBreakdown(
    householdId: string,
    budget: Budget
  ): Promise<CategoryBreakdown[]> {
    try {
      const { periodStart, periodEnd } = this.getPeriodDates(budget);

      const { data, error } = await supabase
        .from('purchase_history')
        .select('category, price')
        .eq('household_id', householdId)
        .gte('purchased_at', periodStart)
        .lt('purchased_at', periodEnd);

      if (error) throw error;

      const categoryMap = new Map<string, { total: number; count: number }>();
      let grandTotal = 0;

      for (const row of data || []) {
        const cat = row.category || 'other';
        const price = row.price || 0;
        const existing = categoryMap.get(cat) || { total: 0, count: 0 };
        existing.total += price;
        existing.count += 1;
        categoryMap.set(cat, existing);
        grandTotal += price;
      }

      return Array.from(categoryMap.entries())
        .map(([category, { total, count }]) => ({
          category,
          total: Math.round(total * 100) / 100,
          percentage: grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0,
          itemCount: count,
        }))
        .sort((a, b) => b.total - a.total);
    } catch (error: any) {
      logger.error('Error getting category breakdown:', error);
      return [];
    }
  }

  // Get monthly spending trends (last 6 months)
  async getMonthlyTrends(
    householdId: string,
    months = 6
  ): Promise<MonthlyTrend[]> {
    try {
      const trends: MonthlyTrend[] = [];
      const now = new Date();

      // Get the budget amount for context
      const budgetResult = await this.getBudget(householdId, 'monthly');
      const budgetAmount = budgetResult.budget?.amount || 0;

      for (let i = months - 1; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = date.toISOString();
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 1).toISOString();

        const { data, error } = await supabase
          .from('purchase_history')
          .select('price')
          .eq('household_id', householdId)
          .gte('purchased_at', monthStart)
          .lt('purchased_at', monthEnd);

        if (error) throw error;

        const spent = (data || []).reduce((sum, row) => sum + (row.price || 0), 0);

        trends.push({
          month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          spent: Math.round(spent * 100) / 100,
          budget: budgetAmount,
        });
      }

      return trends;
    } catch (error: any) {
      logger.error('Error getting monthly trends:', error);
      return [];
    }
  }

  // Helper: calculate period start/end dates
  private getPeriodDates(budget: Budget): {
    periodStart: string;
    periodEnd: string;
    daysLeft: number;
    totalDays: number;
  } {
    const now = new Date();

    if (budget.period === 'weekly') {
      const dayOfWeek = now.getDay(); // 0=Sun
      const periodStart = new Date(now);
      periodStart.setDate(now.getDate() - dayOfWeek);
      periodStart.setHours(0, 0, 0, 0);

      const periodEnd = new Date(periodStart);
      periodEnd.setDate(periodStart.getDate() + 7);

      const daysLeft = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        daysLeft,
        totalDays: 7,
      };
    }

    // Monthly
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const totalDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
    const daysLeft = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      daysLeft,
      totalDays,
    };
  }

  // Build budget context string for Mira
  generateMiraBudgetContext(summary: SpendingSummary): string {
    return `\n\n--- BUDGET INFO ---\nThe user's remaining grocery budget is $${summary.remaining} for ${summary.daysLeft} days (${summary.percentUsed}% used). Daily average: $${summary.dailyAverage}/day. ${summary.status === 'red' ? 'They are running low — suggest budget-friendly meals.' : summary.status === 'yellow' ? 'Moderate spending — keep suggestions cost-effective.' : 'Good budget position.'}\n`;
  }
}

export const budgetService = new BudgetService();
