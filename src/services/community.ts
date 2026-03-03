// Community Recipes Service
// Public recipe sharing, saves, ratings, and discovery

import { supabase } from './supabase';
import { logger } from '../utils/logger';
import type { CookbookRecipe } from './cookbook';

export interface CommunityRecipe extends CookbookRecipe {
  is_public: boolean;
  author_name?: string;
  save_count: number;
  rating_avg: number;
  rating_count: number;
  is_saved?: boolean;
  user_rating?: number;
}

export interface RecipeRating {
  id: string;
  user_id: string;
  recipe_id: string;
  rating: number;
  review?: string;
  created_at: string;
}

const PAGE_SIZE = 20;

class CommunityService {
  // Browse public community recipes
  async browse(options?: {
    page?: number;
    cuisine?: string;
    dietary?: string;
    search?: string;
    sortBy?: 'popular' | 'newest' | 'top_rated';
  }): Promise<{ recipes: CommunityRecipe[]; hasMore: boolean }> {
    try {
      const page = options?.page || 0;
      const sortBy = options?.sortBy || 'popular';

      let query = supabase
        .from('cookbook_recipes')
        .select('*')
        .eq('is_public', true)
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (sortBy === 'popular') {
        query = query.order('save_count', { ascending: false });
      } else if (sortBy === 'newest') {
        query = query.order('created_at', { ascending: false });
      } else if (sortBy === 'top_rated') {
        query = query.order('rating_avg', { ascending: false });
      }

      if (options?.cuisine) {
        query = query.eq('cuisine', options.cuisine);
      }
      if (options?.dietary) {
        query = query.contains('dietary_tags', [options.dietary]);
      }
      if (options?.search) {
        query = query.or(
          `title.ilike.%${options.search}%,description.ilike.%${options.search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;

      const recipes = (data || []).map(this.mapCommunityRecipe);
      return { recipes, hasMore: recipes.length === PAGE_SIZE };
    } catch (error: any) {
      logger.error('Error browsing community recipes:', error);
      return { recipes: [], hasMore: false };
    }
  }

  // Get a single community recipe with user's save/rating status
  async getRecipe(recipeId: string, userId?: string): Promise<CommunityRecipe | null> {
    try {
      const { data, error } = await supabase
        .from('cookbook_recipes')
        .select('*')
        .eq('id', recipeId)
        .single();

      if (error) throw error;
      if (!data) return null;

      const recipe = this.mapCommunityRecipe(data);

      if (userId) {
        const [saveResult, ratingResult] = await Promise.all([
          supabase.from('recipe_saves').select('id').eq('user_id', userId).eq('recipe_id', recipeId).maybeSingle(),
          supabase.from('recipe_ratings').select('rating').eq('user_id', userId).eq('recipe_id', recipeId).maybeSingle(),
        ]);
        recipe.is_saved = !!saveResult.data;
        recipe.user_rating = ratingResult.data?.rating;
      }

      return recipe;
    } catch (error: any) {
      logger.error('Error fetching community recipe:', error);
      return null;
    }
  }

  // Publish a recipe to the community
  async publishRecipe(recipeId: string, authorName: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('cookbook_recipes')
        .update({ is_public: true, author_name: authorName })
        .eq('id', recipeId);

      if (error) throw error;
      return true;
    } catch (error: any) {
      logger.error('Error publishing recipe:', error);
      return false;
    }
  }

  // Unpublish a recipe
  async unpublishRecipe(recipeId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('cookbook_recipes')
        .update({ is_public: false })
        .eq('id', recipeId);

      if (error) throw error;
      return true;
    } catch (error: any) {
      logger.error('Error unpublishing recipe:', error);
      return false;
    }
  }

  // Save a community recipe
  async saveRecipe(userId: string, recipeId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('recipe_saves')
        .insert({ user_id: userId, recipe_id: recipeId });

      if (error) throw error;
      return true;
    } catch (error: any) {
      logger.error('Error saving recipe:', error);
      return false;
    }
  }

  // Unsave a recipe
  async unsaveRecipe(userId: string, recipeId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('recipe_saves')
        .delete()
        .eq('user_id', userId)
        .eq('recipe_id', recipeId);

      if (error) throw error;
      return true;
    } catch (error: any) {
      logger.error('Error unsaving recipe:', error);
      return false;
    }
  }

  // Get user's saved recipes
  async getSavedRecipes(userId: string, page = 0): Promise<{ recipes: CommunityRecipe[]; hasMore: boolean }> {
    try {
      const { data: saves, error: savesError } = await supabase
        .from('recipe_saves')
        .select('recipe_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (savesError) throw savesError;
      if (!saves?.length) return { recipes: [], hasMore: false };

      const recipeIds = saves.map(s => s.recipe_id);
      const { data, error } = await supabase
        .from('cookbook_recipes')
        .select('*')
        .in('id', recipeIds);

      if (error) throw error;

      const recipes = (data || []).map(r => ({ ...this.mapCommunityRecipe(r), is_saved: true }));
      return { recipes, hasMore: saves.length === PAGE_SIZE };
    } catch (error: any) {
      logger.error('Error fetching saved recipes:', error);
      return { recipes: [], hasMore: false };
    }
  }

  // Rate a recipe
  async rateRecipe(userId: string, recipeId: string, rating: number, review?: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('recipe_ratings')
        .upsert({
          user_id: userId,
          recipe_id: recipeId,
          rating,
          review,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      return true;
    } catch (error: any) {
      logger.error('Error rating recipe:', error);
      return false;
    }
  }

  // Get ratings for a recipe
  async getRecipeRatings(recipeId: string): Promise<RecipeRating[]> {
    try {
      const { data, error } = await supabase
        .from('recipe_ratings')
        .select('*')
        .eq('recipe_id', recipeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      logger.error('Error fetching ratings:', error);
      return [];
    }
  }

  private mapCommunityRecipe(row: any): CommunityRecipe {
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
      is_public: row.is_public || false,
      save_count: row.save_count || 0,
      rating_avg: parseFloat(row.rating_avg) || 0,
      rating_count: row.rating_count || 0,
    };
  }
}

export const communityService = new CommunityService();
