import { create } from 'zustand';
import { blogService, type BlogPost } from '../services/blog';
import { logger } from '../utils/logger';

interface BlogState {
  posts: BlogPost[];
  latestPosts: BlogPost[];
  isLoading: boolean;
  hasMore: boolean;
  page: number;
  selectedCategory: string;

  requestSeq: number;

  initialize: () => Promise<void>;
  loadMore: () => Promise<void>;
  setCategory: (category: string) => Promise<void>;
  refreshLatest: () => Promise<void>;
  cleanup: () => void;
}

export const useBlogStore = create<BlogState>((set, get) => ({
  posts: [],
  latestPosts: [],
  isLoading: false,
  hasMore: true,
  page: 0,
  selectedCategory: 'all',
  requestSeq: 0,

  initialize: async () => {
    const seq = get().requestSeq + 1;
    set({ isLoading: true, requestSeq: seq, posts: [], page: 0, hasMore: true });

    try {
      const [postsResult, latestResult] = await Promise.all([
        blogService.getPosts(0),
        blogService.getLatestPosts(),
      ]);

      if (get().requestSeq !== seq) return;

      set({
        posts: postsResult.posts,
        latestPosts: latestResult.posts,
        hasMore: postsResult.hasMore,
        isLoading: false,
        page: 0,
      });
    } catch (error) {
      logger.error('Error initializing blog:', error);
      if (get().requestSeq === seq) {
        set({ isLoading: false });
      }
    }
  },

  loadMore: async () => {
    if (get().isLoading || !get().hasMore) return;

    const nextPage = get().page + 1;
    const category = get().selectedCategory;
    set({ isLoading: true });

    try {
      const result = await blogService.getPosts(nextPage, category);

      set((state) => ({
        posts: [...state.posts, ...result.posts],
        hasMore: result.hasMore,
        page: nextPage,
        isLoading: false,
      }));
    } catch (error) {
      logger.error('Error loading more blog posts:', error);
      set({ isLoading: false });
    }
  },

  setCategory: async (category: string) => {
    const seq = get().requestSeq + 1;
    set({ selectedCategory: category, isLoading: true, requestSeq: seq, posts: [], page: 0, hasMore: true });

    try {
      const result = await blogService.getPosts(0, category);

      if (get().requestSeq !== seq) return;

      set({
        posts: result.posts,
        hasMore: result.hasMore,
        isLoading: false,
        page: 0,
      });
    } catch (error) {
      logger.error('Error filtering blog posts:', error);
      if (get().requestSeq === seq) {
        set({ isLoading: false });
      }
    }
  },

  refreshLatest: async () => {
    try {
      const result = await blogService.getLatestPosts();
      set({ latestPosts: result.posts });
    } catch (error) {
      logger.error('Error refreshing latest posts:', error);
    }
  },

  cleanup: () => {
    set({
      posts: [],
      latestPosts: [],
      isLoading: false,
      hasMore: true,
      page: 0,
      selectedCategory: 'all',
    });
  },
}));
