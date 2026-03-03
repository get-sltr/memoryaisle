// Blog Service
// Fetches curated blog content for in-app feed

import { supabase } from './supabase';
import { logger } from '../utils/logger';

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content_url: string | null;
  cover_image_url: string | null;
  category: string;
  tags: string[];
  author: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
}

export const BLOG_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'seasonal_recipes', label: 'Seasonal' },
  { id: 'meal_prep', label: 'Meal Prep' },
  { id: 'holiday_planning', label: 'Holidays' },
  { id: 'allergy_guides', label: 'Allergies' },
  { id: 'cultural_food', label: 'Culture' },
  { id: 'family_wellness', label: 'Wellness' },
] as const;

const PAGE_SIZE = 10;

class BlogService {
  // Get published blog posts with pagination
  async getPosts(
    page = 0,
    category?: string
  ): Promise<{ success: boolean; posts: BlogPost[]; hasMore: boolean; error?: string }> {
    try {
      let query = supabase
        .from('blog_posts')
        .select('*')
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (category && category !== 'all') {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        posts: data || [],
        hasMore: (data?.length || 0) === PAGE_SIZE,
      };
    } catch (error: any) {
      logger.error('Error fetching blog posts:', error);
      return { success: false, posts: [], hasMore: false, error: error.message };
    }
  }

  // Get a single post by slug
  async getPostBySlug(slug: string): Promise<{ success: boolean; post?: BlogPost; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .single();

      if (error) throw error;

      return { success: true, post: data };
    } catch (error: any) {
      logger.error('Error fetching blog post:', error);
      return { success: false, error: error.message };
    }
  }

  // Fetch markdown content from S3/CDN URL
  async getPostContent(contentUrl: string): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const response = await fetch(contentUrl);
      if (!response.ok) throw new Error(`Failed to fetch content: ${response.status}`);
      const content = await response.text();
      return { success: true, content };
    } catch (error: any) {
      logger.error('Error fetching blog content:', error);
      return { success: false, error: error.message };
    }
  }

  // Get latest posts for home screen preview
  async getLatestPosts(limit = 3): Promise<{ success: boolean; posts: BlogPost[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return { success: true, posts: data || [] };
    } catch (error: any) {
      logger.error('Error fetching latest posts:', error);
      return { success: false, posts: [], error: error.message };
    }
  }
}

export const blogService = new BlogService();
