import { supabase } from './supabase';
import type { Recipe, RecipeIngredient } from '../types';
import type { MiraRecipe } from './mira';
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

// Save a Mira-generated recipe to the household's recipes
export async function saveMiraRecipe(
  householdId: string,
  recipe: MiraRecipe
): Promise<Recipe | null> {
  
  // BUG FIX: Handle the new {display, cleanName} object from the AI
  // We smuggle the cleanName into the database JSON so we can use it later!
  const ingredients = recipe.ingredients.map((ing: any) => ({
    item: typeof ing === 'string' ? ing : ing.display,
    cleanName: typeof ing === 'string' ? ing : ing.cleanName, // Smuggled property
    amount: '',
  }));

  return createRecipe(householdId, {
    name: recipe.name,
    description: recipe.description,
    prep_time: recipe.prepTime,
    cook_time: recipe.cookTime,
    servings: recipe.servings,
    ingredients: ingredients as any, // Bypass strict type complaining
    instructions: recipe.instructions,
    source: 'mira',
  });
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
    
    // We cast to any[] to safely check for our smuggled cleanName property
    for (const ingredient of recipe.ingredients as any[]) {
      // Prioritize the AI's clean name, fallback to manual item name
      const baseName = ingredient.cleanName || ingredient.item;

      // Only format with amount if it's a manual entry without a cleanName
      const itemName = ingredient.amount && !ingredient.cleanName
        ? `${baseName} (${ingredient.amount})`
        : baseName;

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