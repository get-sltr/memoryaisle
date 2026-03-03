import { create } from 'zustand';
import { budgetService, type Budget, type SpendingSummary, type CategoryBreakdown, type MonthlyTrend } from '../services/budget';
import { logger } from '../utils/logger';

interface BudgetState {
  budget: Budget | null;
  summary: SpendingSummary | null;
  categoryBreakdown: CategoryBreakdown[];
  monthlyTrends: MonthlyTrend[];
  isLoading: boolean;
  requestSeq: number;

  initialize: (householdId: string) => Promise<void>;
  refresh: (householdId: string) => Promise<void>;
  setBudget: (householdId: string, amount: number, period?: 'weekly' | 'monthly') => Promise<boolean>;
  loadTrends: (householdId: string) => Promise<void>;
  cleanup: () => void;
}

export const useBudgetStore = create<BudgetState>((set, get) => ({
  budget: null,
  summary: null,
  categoryBreakdown: [],
  monthlyTrends: [],
  isLoading: false,
  requestSeq: 0,

  initialize: async (householdId: string) => {
    const seq = get().requestSeq + 1;
    set({ isLoading: true, requestSeq: seq });

    try {
      const budgetResult = await budgetService.getBudget(householdId);

      if (get().requestSeq !== seq) return;

      if (budgetResult.budget) {
        const [summary, breakdown] = await Promise.all([
          budgetService.getSpendingSummary(householdId, budgetResult.budget),
          budgetService.getCategoryBreakdown(householdId, budgetResult.budget),
        ]);

        if (get().requestSeq !== seq) return;

        set({
          budget: budgetResult.budget,
          summary,
          categoryBreakdown: breakdown,
          isLoading: false,
        });
      } else {
        set({ budget: null, summary: null, categoryBreakdown: [], isLoading: false });
      }
    } catch (error) {
      logger.error('Error initializing budget:', error);
      if (get().requestSeq === seq) {
        set({ isLoading: false });
      }
    }
  },

  refresh: async (householdId: string) => {
    const budget = get().budget;
    if (!budget) return;

    try {
      const [summary, breakdown] = await Promise.all([
        budgetService.getSpendingSummary(householdId, budget),
        budgetService.getCategoryBreakdown(householdId, budget),
      ]);

      set({ summary, categoryBreakdown: breakdown });
    } catch (error) {
      logger.error('Error refreshing budget:', error);
    }
  },

  setBudget: async (householdId: string, amount: number, period: 'weekly' | 'monthly' = 'monthly') => {
    try {
      const result = await budgetService.setBudget(householdId, amount, period);
      if (result.success && result.budget) {
        const summary = await budgetService.getSpendingSummary(householdId, result.budget);
        set({ budget: result.budget, summary });
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Error setting budget:', error);
      return false;
    }
  },

  loadTrends: async (householdId: string) => {
    try {
      const trends = await budgetService.getMonthlyTrends(householdId);
      set({ monthlyTrends: trends });
    } catch (error) {
      logger.error('Error loading trends:', error);
    }
  },

  cleanup: () => {
    set({
      budget: null,
      summary: null,
      categoryBreakdown: [],
      monthlyTrends: [],
      isLoading: false,
    });
  },
}));
