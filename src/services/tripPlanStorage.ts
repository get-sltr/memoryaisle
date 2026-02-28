import { supabase } from './supabase';
import { logger } from '../utils/logger';
import type { TripPlan, TripMeal, TripChecklistCategory } from '../types';

// Database row type (snake_case, matches Supabase schema)
export interface TripPlanRow {
  id: string;
  household_id: string;
  name: string;
  type: string;
  destination: string | null;
  start_date: string;
  end_date: string;
  duration: number;
  travelers: number;
  status: string;
  meals: TripMeal[];
  checklists: TripChecklistCategory[];
  shopping_list: string[];
  estimated_budget: TripPlan['estimatedBudget'] | null;
  mira_note: string | null;
  allergen_notes: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Convert TripPlan (camelCase) → DB insert payload (snake_case)
function toDbRow(
  plan: TripPlan,
  householdId: string,
  userId?: string
): Omit<TripPlanRow, 'id' | 'created_at' | 'updated_at'> {
  return {
    household_id: householdId,
    name: plan.name,
    type: plan.type,
    destination: plan.destination || null,
    start_date: plan.startDate,
    end_date: plan.endDate,
    duration: plan.duration,
    travelers: plan.travelers,
    status: plan.status,
    meals: plan.meals,
    checklists: plan.checklists,
    shopping_list: plan.shoppingList,
    estimated_budget: plan.estimatedBudget || null,
    mira_note: plan.miraNote || null,
    allergen_notes: plan.allergyNotes || [],
    created_by: userId || null,
  };
}

// Convert DB row (snake_case) → TripPlan (camelCase)
function fromDbRow(row: TripPlanRow): TripPlan {
  return {
    id: row.id,
    name: row.name,
    type: row.type as TripPlan['type'],
    destination: row.destination || undefined,
    startDate: row.start_date,
    endDate: row.end_date,
    duration: row.duration,
    travelers: row.travelers,
    status: row.status as TripPlan['status'],
    meals: row.meals || [],
    checklists: row.checklists || [],
    shoppingList: row.shopping_list || [],
    estimatedBudget: row.estimated_budget || undefined,
    miraNote: row.mira_note || undefined,
    allergyNotes: row.allergen_notes || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Save a new trip plan
export async function saveTripPlan(
  householdId: string,
  plan: TripPlan,
  userId?: string
): Promise<TripPlan> {
  try {
    const { data, error } = await supabase
      .from('trip_plans')
      .insert(toDbRow(plan, householdId, userId))
      .select()
      .single();

    if (error) {
      logger.error('Failed to save trip plan:', error);
      throw error;
    }

    return fromDbRow(data);
  } catch (error) {
    logger.error('saveTripPlan error:', error);
    throw error;
  }
}

// Get all trip plans for a household
export async function getTripPlans(householdId: string): Promise<TripPlan[]> {
  try {
    const { data, error } = await supabase
      .from('trip_plans')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch trip plans:', error);
      throw error;
    }

    return (data || []).map(fromDbRow);
  } catch (error) {
    logger.error('getTripPlans error:', error);
    throw error;
  }
}

// Get the active (non-completed) trip plan for a household
export async function getActiveTripPlan(
  householdId: string
): Promise<TripPlan | null> {
  try {
    const { data, error } = await supabase
      .from('trip_plans')
      .select('*')
      .eq('household_id', householdId)
      .neq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error('Failed to fetch active trip plan:', error);
      throw error;
    }

    return data ? fromDbRow(data) : null;
  } catch (error) {
    logger.error('getActiveTripPlan error:', error);
    return null;
  }
}

// Update a trip plan (partial updates supported)
export async function updateTripPlan(
  planId: string,
  updates: Partial<TripPlan>
): Promise<TripPlan> {
  try {
    // Convert camelCase updates to snake_case DB columns
    const dbUpdates: Record<string, any> = {};

    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.destination !== undefined) dbUpdates.destination = updates.destination;
    if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
    if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate;
    if (updates.duration !== undefined) dbUpdates.duration = updates.duration;
    if (updates.travelers !== undefined) dbUpdates.travelers = updates.travelers;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.meals !== undefined) dbUpdates.meals = updates.meals;
    if (updates.checklists !== undefined) dbUpdates.checklists = updates.checklists;
    if (updates.shoppingList !== undefined) dbUpdates.shopping_list = updates.shoppingList;
    if (updates.estimatedBudget !== undefined) dbUpdates.estimated_budget = updates.estimatedBudget;
    if (updates.miraNote !== undefined) dbUpdates.mira_note = updates.miraNote;
    if (updates.allergyNotes !== undefined) dbUpdates.allergen_notes = updates.allergyNotes;

    const { data, error } = await supabase
      .from('trip_plans')
      .update(dbUpdates)
      .eq('id', planId)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update trip plan:', error);
      throw error;
    }

    return fromDbRow(data);
  } catch (error) {
    logger.error('updateTripPlan error:', error);
    throw error;
  }
}

// Delete a trip plan
export async function deleteTripPlan(planId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('trip_plans')
      .delete()
      .eq('id', planId);

    if (error) {
      logger.error('Failed to delete trip plan:', error);
      throw error;
    }
  } catch (error) {
    logger.error('deleteTripPlan error:', error);
    throw error;
  }
}
