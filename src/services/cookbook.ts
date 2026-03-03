// Family Cookbook Service
// Manage family recipes — save from Mira, manual entry, or import

import { supabase } from './supabase';
import { logger } from '../utils/logger';

export interface CookbookRecipe {
  id: string;
  household_id: string;
  created_by?: string;
  title: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  prep_time?: string;
  cook_time?: string;
  servings?: number;
  calories?: number;
  protein?: string;
  carbs?: string;
  fat?: string;
  cuisine?: string;
  dietary_tags: string[];
  photo_urls: string[];
  source: 'manual' | 'mira' | 'import';
  source_memory_id?: string;
  is_favorite: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export const CUISINE_OPTIONS = [
  'American', 'Italian', 'Mexican', 'Chinese', 'Indian',
  'Japanese', 'Thai', 'Mediterranean', 'French', 'Korean',
  'Middle Eastern', 'African', 'Caribbean', 'Vietnamese', 'Other',
] as const;

export const DIETARY_TAG_OPTIONS = [
  'vegetarian', 'vegan', 'gluten-free', 'dairy-free',
  'nut-free', 'halal', 'kosher', 'keto', 'low-carb',
  'high-protein', 'paleo', 'whole30',
] as const;

const PAGE_SIZE = 20;

class CookbookService {
  // Get recipes with pagination and optional filters
  async getRecipes(
    householdId: string,
    options?: {
      page?: number;
      cuisine?: string;
      source?: string;
      favoritesOnly?: boolean;
      search?: string;
    }
  ): Promise<{ recipes: CookbookRecipe[]; hasMore: boolean }> {
    try {
      const page = options?.page || 0;

      let query = supabase
        .from('cookbook_recipes')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (options?.cuisine) {
        query = query.eq('cuisine', options.cuisine);
      }
      if (options?.source) {
        query = query.eq('source', options.source);
      }
      if (options?.favoritesOnly) {
        query = query.eq('is_favorite', true);
      }
      if (options?.search) {
        query = query.or(
          `title.ilike.%${options.search}%,description.ilike.%${options.search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;

      const recipes = (data || []).map(this.mapRecipe);
      return { recipes, hasMore: recipes.length === PAGE_SIZE };
    } catch (error: any) {
      logger.error('Error fetching cookbook recipes:', error);
      return { recipes: [], hasMore: false };
    }
  }

  // Get a single recipe by ID
  async getRecipe(recipeId: string): Promise<CookbookRecipe | null> {
    try {
      const { data, error } = await supabase
        .from('cookbook_recipes')
        .select('*')
        .eq('id', recipeId)
        .single();

      if (error) throw error;
      return data ? this.mapRecipe(data) : null;
    } catch (error: any) {
      logger.error('Error fetching recipe:', error);
      return null;
    }
  }

  // Save a recipe (manual entry or from Mira)
  async saveRecipe(
    householdId: string,
    recipe: Omit<CookbookRecipe, 'id' | 'household_id' | 'created_at' | 'updated_at' | 'is_favorite'>,
    userId?: string
  ): Promise<{ success: boolean; recipe?: CookbookRecipe; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('cookbook_recipes')
        .insert({
          household_id: householdId,
          created_by: userId,
          title: recipe.title,
          description: recipe.description,
          ingredients: JSON.stringify(recipe.ingredients),
          instructions: JSON.stringify(recipe.instructions),
          prep_time: recipe.prep_time,
          cook_time: recipe.cook_time,
          servings: recipe.servings,
          calories: recipe.calories,
          protein: recipe.protein,
          carbs: recipe.carbs,
          fat: recipe.fat,
          cuisine: recipe.cuisine,
          dietary_tags: recipe.dietary_tags || [],
          photo_urls: recipe.photo_urls || [],
          source: recipe.source || 'manual',
          source_memory_id: recipe.source_memory_id,
          notes: recipe.notes,
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, recipe: this.mapRecipe(data) };
    } catch (error: any) {
      logger.error('Error saving cookbook recipe:', error);
      return { success: false, error: error.message };
    }
  }

  // Save a Mira recipe directly to cookbook
  async saveFromMira(
    householdId: string,
    miraRecipe: {
      name: string;
      description?: string;
      prepTime?: string;
      cookTime?: string;
      servings?: number;
      calories?: number;
      protein?: string;
      carbs?: string;
      fat?: string;
      ingredients: string[];
      instructions: string[];
      tips?: string[];
    },
    userId?: string
  ): Promise<{ success: boolean; recipe?: CookbookRecipe; error?: string }> {
    return this.saveRecipe(householdId, {
      title: miraRecipe.name,
      description: miraRecipe.description,
      ingredients: miraRecipe.ingredients,
      instructions: miraRecipe.instructions,
      prep_time: miraRecipe.prepTime,
      cook_time: miraRecipe.cookTime,
      servings: miraRecipe.servings,
      calories: miraRecipe.calories,
      protein: miraRecipe.protein,
      carbs: miraRecipe.carbs,
      fat: miraRecipe.fat,
      dietary_tags: [],
      photo_urls: [],
      source: 'mira',
      notes: miraRecipe.tips?.join('\n'),
    }, userId);
  }

  // Update a recipe
  async updateRecipe(
    recipeId: string,
    updates: Partial<CookbookRecipe>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: Record<string, any> = {};
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.ingredients !== undefined) updateData.ingredients = JSON.stringify(updates.ingredients);
      if (updates.instructions !== undefined) updateData.instructions = JSON.stringify(updates.instructions);
      if (updates.prep_time !== undefined) updateData.prep_time = updates.prep_time;
      if (updates.cook_time !== undefined) updateData.cook_time = updates.cook_time;
      if (updates.servings !== undefined) updateData.servings = updates.servings;
      if (updates.calories !== undefined) updateData.calories = updates.calories;
      if (updates.protein !== undefined) updateData.protein = updates.protein;
      if (updates.carbs !== undefined) updateData.carbs = updates.carbs;
      if (updates.fat !== undefined) updateData.fat = updates.fat;
      if (updates.cuisine !== undefined) updateData.cuisine = updates.cuisine;
      if (updates.dietary_tags !== undefined) updateData.dietary_tags = updates.dietary_tags;
      if (updates.photo_urls !== undefined) updateData.photo_urls = updates.photo_urls;
      if (updates.is_favorite !== undefined) updateData.is_favorite = updates.is_favorite;
      if (updates.notes !== undefined) updateData.notes = updates.notes;

      const { error } = await supabase
        .from('cookbook_recipes')
        .update(updateData)
        .eq('id', recipeId);

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      logger.error('Error updating cookbook recipe:', error);
      return { success: false, error: error.message };
    }
  }

  // Toggle favorite
  async toggleFavorite(recipeId: string, isFavorite: boolean): Promise<boolean> {
    const result = await this.updateRecipe(recipeId, { is_favorite: isFavorite } as any);
    return result.success;
  }

  // Delete a recipe
  async deleteRecipe(recipeId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('cookbook_recipes')
        .delete()
        .eq('id', recipeId);

      if (error) throw error;
      return true;
    } catch (error: any) {
      logger.error('Error deleting cookbook recipe:', error);
      return false;
    }
  }

  // Get recipe count for household
  async getRecipeCount(householdId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('cookbook_recipes')
        .select('*', { count: 'exact', head: true })
        .eq('household_id', householdId);

      if (error) throw error;
      return count || 0;
    } catch {
      return 0;
    }
  }

  // Get unique cuisines in household's cookbook
  async getCuisines(householdId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('cookbook_recipes')
        .select('cuisine')
        .eq('household_id', householdId)
        .not('cuisine', 'is', null);

      if (error) throw error;
      const unique = [...new Set((data || []).map(r => r.cuisine).filter(Boolean))];
      return unique.sort();
    } catch {
      return [];
    }
  }

  // Map DB row to typed recipe
  private mapRecipe(row: any): CookbookRecipe {
    return {
      ...row,
      ingredients: typeof row.ingredients === 'string'
        ? JSON.parse(row.ingredients)
        : (row.ingredients || []),
      instructions: typeof row.instructions === 'string'
        ? JSON.parse(row.instructions)
        : (row.instructions || []),
      dietary_tags: row.dietary_tags || [],
      photo_urls: row.photo_urls || [],
    };
  }
}

export const cookbookService = new CookbookService();
