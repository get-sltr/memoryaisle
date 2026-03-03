// Holiday Planner Service
// Cultural holiday meal planning with prep timelines and budget estimates

import { supabase } from './supabase';
import { logger } from '../utils/logger';

export interface HolidayPlan {
  id: string;
  household_id: string;
  created_by?: string;
  holiday_name: string;
  holiday_date: string;
  guest_count: number;
  dietary_notes?: string;
  menu: HolidayMenuItem[];
  shopping_list: string[];
  prep_timeline: PrepTimelineEntry[];
  budget_estimate?: number;
  actual_spent?: number;
  notes?: string;
  status: 'planning' | 'shopping' | 'prepping' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface HolidayMenuItem {
  meal: string; // 'Main Course', 'Appetizers', 'Dessert', 'Sides', 'Drinks'
  dishes: {
    name: string;
    servings: number;
    ingredients: string[];
  }[];
}

export interface PrepTimelineEntry {
  days_before: number; // 0 = day of, 1 = 1 day before, etc.
  label: string; // 'Day of', '1 day before', '3 days before'
  tasks: string[];
}

export const HOLIDAYS = [
  { name: 'Thanksgiving', emoji: '🦃', month: 10 }, // November (0-indexed)
  { name: 'Christmas', emoji: '🎄', month: 11 },
  { name: 'Hanukkah', emoji: '🕎', month: 11 },
  { name: 'Easter', emoji: '🐣', month: 3 },
  { name: 'Passover', emoji: '🫓', month: 3 },
  { name: 'Eid al-Fitr', emoji: '🌙', month: -1 }, // varies
  { name: 'Eid al-Adha', emoji: '🐑', month: -1 },
  { name: 'Diwali', emoji: '🪔', month: 9 },
  { name: 'Lunar New Year', emoji: '🧧', month: 0 },
  { name: 'Ramadan', emoji: '☪️', month: -1 },
  { name: 'July 4th', emoji: '🎆', month: 6 },
  { name: 'Super Bowl', emoji: '🏈', month: 1 },
  { name: 'Birthday Party', emoji: '🎂', month: -1 },
  { name: 'Family Reunion', emoji: '👨‍👩‍👧‍👦', month: -1 },
  { name: 'Dinner Party', emoji: '🍷', month: -1 },
  { name: 'Other', emoji: '🎉', month: -1 },
] as const;

class HolidayPlannerService {
  // Get all holiday plans for a household
  async getPlans(
    householdId: string,
    options?: { status?: string; upcoming?: boolean }
  ): Promise<HolidayPlan[]> {
    try {
      let query = supabase
        .from('holiday_plans')
        .select('*')
        .eq('household_id', householdId)
        .order('holiday_date', { ascending: true });

      if (options?.status) {
        query = query.eq('status', options.status);
      }
      if (options?.upcoming) {
        query = query.gte('holiday_date', new Date().toISOString().split('T')[0]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(this.mapPlan);
    } catch (error: any) {
      logger.error('Error fetching holiday plans:', error);
      return [];
    }
  }

  // Get a single plan
  async getPlan(planId: string): Promise<HolidayPlan | null> {
    try {
      const { data, error } = await supabase
        .from('holiday_plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (error) throw error;
      return data ? this.mapPlan(data) : null;
    } catch (error: any) {
      logger.error('Error fetching holiday plan:', error);
      return null;
    }
  }

  // Create a new holiday plan
  async createPlan(
    householdId: string,
    plan: {
      holiday_name: string;
      holiday_date: string;
      guest_count?: number;
      dietary_notes?: string;
    },
    userId?: string
  ): Promise<{ success: boolean; plan?: HolidayPlan; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('holiday_plans')
        .insert({
          household_id: householdId,
          created_by: userId,
          holiday_name: plan.holiday_name,
          holiday_date: plan.holiday_date,
          guest_count: plan.guest_count || 0,
          dietary_notes: plan.dietary_notes,
          menu: [],
          shopping_list: [],
          prep_timeline: [],
          status: 'planning',
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, plan: this.mapPlan(data) };
    } catch (error: any) {
      logger.error('Error creating holiday plan:', error);
      return { success: false, error: error.message };
    }
  }

  // Update a plan (menu, shopping list, timeline, status, etc.)
  async updatePlan(
    planId: string,
    updates: Partial<HolidayPlan>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: Record<string, any> = {};
      if (updates.holiday_name !== undefined) updateData.holiday_name = updates.holiday_name;
      if (updates.holiday_date !== undefined) updateData.holiday_date = updates.holiday_date;
      if (updates.guest_count !== undefined) updateData.guest_count = updates.guest_count;
      if (updates.dietary_notes !== undefined) updateData.dietary_notes = updates.dietary_notes;
      if (updates.menu !== undefined) updateData.menu = JSON.stringify(updates.menu);
      if (updates.shopping_list !== undefined) updateData.shopping_list = JSON.stringify(updates.shopping_list);
      if (updates.prep_timeline !== undefined) updateData.prep_timeline = JSON.stringify(updates.prep_timeline);
      if (updates.budget_estimate !== undefined) updateData.budget_estimate = updates.budget_estimate;
      if (updates.actual_spent !== undefined) updateData.actual_spent = updates.actual_spent;
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      if (updates.status !== undefined) updateData.status = updates.status;

      const { error } = await supabase
        .from('holiday_plans')
        .update(updateData)
        .eq('id', planId);

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      logger.error('Error updating holiday plan:', error);
      return { success: false, error: error.message };
    }
  }

  // Save Mira-generated plan data
  async saveMiraPlan(
    planId: string,
    miraData: {
      menu?: HolidayMenuItem[];
      shopping_list?: string[];
      prep_timeline?: PrepTimelineEntry[];
      budget_estimate?: number;
    }
  ): Promise<boolean> {
    const result = await this.updatePlan(planId, miraData as any);
    return result.success;
  }

  // Delete a plan
  async deletePlan(planId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('holiday_plans')
        .delete()
        .eq('id', planId);

      if (error) throw error;
      return true;
    } catch (error: any) {
      logger.error('Error deleting holiday plan:', error);
      return false;
    }
  }

  // Add shopping list items to grocery list
  async addShoppingListToGrocery(
    listId: string,
    items: string[],
    addItemFn: (listId: string, name: string) => Promise<any>
  ): Promise<number> {
    let added = 0;
    for (const item of items) {
      const result = await addItemFn(listId, item);
      if (result) added++;
    }
    return added;
  }

  // Build Mira context for holiday planning
  generateMiraHolidayContext(plan: HolidayPlan): string {
    const daysUntil = Math.ceil(
      (new Date(plan.holiday_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    return `\n\n--- HOLIDAY PLANNING ---\nThe user is planning for ${plan.holiday_name} on ${plan.holiday_date} (${daysUntil} days away). Guest count: ${plan.guest_count}. ${plan.dietary_notes ? `Guest dietary notes: ${plan.dietary_notes}. ` : ''}Status: ${plan.status}. Help with menu planning, shopping lists, prep timelines, and budget estimates. Be culturally sensitive and specific to this holiday's traditions.\n`;
  }

  private mapPlan(row: any): HolidayPlan {
    return {
      ...row,
      menu: typeof row.menu === 'string' ? JSON.parse(row.menu) : (row.menu || []),
      shopping_list: typeof row.shopping_list === 'string' ? JSON.parse(row.shopping_list) : (row.shopping_list || []),
      prep_timeline: typeof row.prep_timeline === 'string' ? JSON.parse(row.prep_timeline) : (row.prep_timeline || []),
    };
  }
}

export const holidayPlannerService = new HolidayPlannerService();
