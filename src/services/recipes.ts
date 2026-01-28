import { supabase } from './supabase';
import type { Recipe, RecipeIngredient } from '../types';
import { logger } from '../utils/logger';
import { getActiveList, addItem } from './lists';

// Get all recipes for a household
export async function getRecipes(householdId: string): Promise<Recipe[]> {
  try {
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Parse JSONB fields
    return (data || []).map((recipe: any) => ({
      ...recipe,
      ingredients: recipe.ingredients || [],
      instructions: recipe.instructions || [],
    }));
  } catch (error) {
    logger.error('Error getting recipes:', error);
    return [];
  }
}

// Get a single recipe by ID
export async function getRecipeById(recipeId: string): Promise<Recipe | null> {
  try {
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', recipeId)
      .single();

    if (error) throw error;

    return {
      ...data,
      ingredients: data.ingredients || [],
      instructions: data.instructions || [],
    };
  } catch (error) {
    logger.error('Error getting recipe:', error);
    return null;
  }
}

// Create a new recipe
export async function createRecipe(
  householdId: string,
  recipe: {
    name: string;
    emoji?: string;
    description?: string;
    prep_time?: string;
    cook_time?: string;
    total_time?: string;
    servings?: number;
    ingredients?: RecipeIngredient[];
    instructions?: string[];
    source?: 'manual' | 'mira';
  }
): Promise<Recipe | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('recipes')
      .insert({
        household_id: householdId,
        name: recipe.name,
        emoji: recipe.emoji || '🍽️',
        description: recipe.description,
        prep_time: recipe.prep_time,
        cook_time: recipe.cook_time,
        total_time: recipe.total_time,
        servings: recipe.servings || 4,
        ingredients: recipe.ingredients || [],
        instructions: recipe.instructions || [],
        source: recipe.source || 'manual',
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      ...data,
      ingredients: data.ingredients || [],
      instructions: data.instructions || [],
    };
  } catch (error) {
    logger.error('Error creating recipe:', error);
    return null;
  }
}

// Update an existing recipe
export async function updateRecipe(
  recipeId: string,
  updates: Partial<{
    name: string;
    emoji: string;
    description: string;
    prep_time: string;
    cook_time: string;
    total_time: string;
    servings: number;
    ingredients: RecipeIngredient[];
    instructions: string[];
  }>
): Promise<Recipe | null> {
  try {
    const { data, error } = await supabase
      .from('recipes')
      .update(updates)
      .eq('id', recipeId)
      .select()
      .single();

    if (error) throw error;

    return {
      ...data,
      ingredients: data.ingredients || [],
      instructions: data.instructions || [],
    };
  } catch (error) {
    logger.error('Error updating recipe:', error);
    return null;
  }
}

// Delete a recipe
export async function deleteRecipe(recipeId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('recipes')
      .delete()
      .eq('id', recipeId);

    if (error) throw error;
    return true;
  } catch (error) {
    logger.error('Error deleting recipe:', error);
    return false;
  }
}

// Add all ingredients from a recipe to the active shopping list
export async function addRecipeToList(
  householdId: string,
  recipe: Recipe
): Promise<{ success: boolean; addedCount: number }> {
  try {
    const list = await getActiveList(householdId);
    if (!list) {
      throw new Error('Could not find active list');
    }

    let addedCount = 0;
    for (const ingredient of recipe.ingredients) {
      // Format ingredient name with amount
      const itemName = ingredient.amount
        ? `${ingredient.item} (${ingredient.amount})`
        : ingredient.item;

      const added = await addItem(list.id, itemName, undefined, 1, 'ai_suggested');
      if (added) {
        addedCount++;
      }
    }

    return { success: true, addedCount };
  } catch (error) {
    logger.error('Error adding recipe to list:', error);
    return { success: false, addedCount: 0 };
  }
}
