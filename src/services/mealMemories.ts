// Meal Memories Service
// CRUD operations for family food photo album

import { supabase } from './supabase';
import { photoUploadService } from './photoUpload';
import { logger } from '../utils/logger';

export interface MealMemory {
  id: string;
  household_id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  recipe_id: string | null;
  meal_plan_id: string | null;
  holiday: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface SaveMemoryInput {
  imageUri: string;
  caption?: string;
  recipeId?: string;
  mealPlanId?: string;
  holiday?: string;
  tags?: string[];
}

const PAGE_SIZE = 20;

class MealMemoriesService {
  // Save a new meal memory (upload photo + create record)
  async saveMemory(
    householdId: string,
    userId: string,
    input: SaveMemoryInput
  ): Promise<{ success: boolean; memory?: MealMemory; error?: string }> {
    try {
      // Upload photo to S3
      const uploadResult = await photoUploadService.uploadPhoto(
        input.imageUri,
        'meal_memory',
        `memory_${Date.now()}.jpg`
      );

      if (!uploadResult.success || !uploadResult.cdnUrl) {
        return { success: false, error: uploadResult.error || 'Photo upload failed' };
      }

      // Save record to Supabase
      const { data, error } = await supabase
        .from('meal_memories')
        .insert({
          household_id: householdId,
          user_id: userId,
          image_url: uploadResult.cdnUrl,
          caption: input.caption || null,
          recipe_id: input.recipeId || null,
          meal_plan_id: input.mealPlanId || null,
          holiday: input.holiday || null,
          tags: input.tags || [],
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, memory: data };
    } catch (error: any) {
      logger.error('Error saving meal memory:', error);
      return { success: false, error: error.message };
    }
  }

  // Get memories with pagination (newest first)
  async getMemories(
    householdId: string,
    page = 0,
    filters?: { holiday?: string; userId?: string; tag?: string }
  ): Promise<{ success: boolean; memories: MealMemory[]; hasMore: boolean; error?: string }> {
    try {
      let query = supabase
        .from('meal_memories')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filters?.holiday) {
        query = query.eq('holiday', filters.holiday);
      }
      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters?.tag) {
        query = query.contains('tags', [filters.tag]);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        memories: data || [],
        hasMore: (data?.length || 0) === PAGE_SIZE,
      };
    } catch (error: any) {
      logger.error('Error fetching memories:', error);
      return { success: false, memories: [], hasMore: false, error: error.message };
    }
  }

  // Get recent memories for home screen preview
  async getRecentMemories(
    householdId: string,
    limit = 5
  ): Promise<{ success: boolean; memories: MealMemory[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('meal_memories')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return { success: true, memories: data || [] };
    } catch (error: any) {
      logger.error('Error fetching recent memories:', error);
      return { success: false, memories: [], error: error.message };
    }
  }

  // Update a memory (caption, tags, holiday)
  async updateMemory(
    memoryId: string,
    updates: { caption?: string; holiday?: string; tags?: string[] }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('meal_memories')
        .update(updates)
        .eq('id', memoryId);

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      logger.error('Error updating memory:', error);
      return { success: false, error: error.message };
    }
  }

  // Delete a memory
  async deleteMemory(memoryId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('meal_memories')
        .delete()
        .eq('id', memoryId);

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      logger.error('Error deleting memory:', error);
      return { success: false, error: error.message };
    }
  }

  // Get memory count for the current month (for free tier limiting)
  async getMonthlyCount(householdId: string): Promise<number> {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count, error } = await supabase
        .from('meal_memories')
        .select('*', { count: 'exact', head: true })
        .eq('household_id', householdId)
        .gte('created_at', startOfMonth.toISOString());

      if (error) throw error;
      return count || 0;
    } catch (error: any) {
      logger.error('Error getting monthly count:', error);
      return 0;
    }
  }
}

export const mealMemoriesService = new MealMemoriesService();
