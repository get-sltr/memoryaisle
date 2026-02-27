import { supabase } from './supabase';
import { logger } from '../utils/logger';
import type { DietaryPreference, CulturalPreference } from '../types';

/**
 * Saves the family's dietary, allergen, and cultural preferences to the database.
 * Updates the 'households' table.
 */
export async function saveDietaryPreferences(
  householdId: string,
  dietaryPreferences: DietaryPreference[],
  culturalPreferences: CulturalPreference[],
  familyProfile: any // Replace 'any' with your FamilyProfile type if you have one exported
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('households')
      .update({
        dietary_preferences: dietaryPreferences,
        cultural_preferences: culturalPreferences,
        family_profile: familyProfile,
      })
      .eq('id', householdId);

    if (error) {
      logger.error('Supabase error saving dietary preferences:', error);
      return { success: false, error: 'Could not save preferences to the database.' };
    }

    return { success: true };
  } catch (err: any) {
    logger.error('Unexpected error saving dietary preferences:', err);
    return {
      success: false,
      error: err?.message || 'An unexpected error occurred while saving.'
    };
  }
}

/**
 * Reads dietary_preferences, cultural_preferences, and family_profile
 * from the households table for the given householdId.
 */
export async function getDietaryPreferences(
  householdId: string
): Promise<{
  dietaryPreferences: DietaryPreference[];
  culturalPreferences: CulturalPreference[];
  familyProfile: any;
} | null> {
  try {
    const { data, error } = await supabase
      .from('households')
      .select('dietary_preferences, cultural_preferences, family_profile')
      .eq('id', householdId)
      .single();

    if (error) {
      logger.error('Supabase error fetching dietary preferences:', error);
      return null;
    }

    return {
      dietaryPreferences: data.dietary_preferences ?? [],
      culturalPreferences: data.cultural_preferences ?? [],
      familyProfile: data.family_profile ?? null,
    };
  } catch (err: any) {
    logger.error('Unexpected error fetching dietary preferences:', err);
    return null;
  }
}
