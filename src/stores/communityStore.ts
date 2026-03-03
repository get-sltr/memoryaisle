import { create } from 'zustand';
import { communityService, type CommunityRecipe } from '../services/community';
import { logger } from '../utils/logger';

interface CommunityState {
  recipes: CommunityRecipe[];
  savedRecipes: CommunityRecipe[];
  isLoading: boolean;
  hasMore: boolean;
  page: number;
  selectedCuisine: string | null;
  selectedDietary: string | null;
  sortBy: 'popular' | 'newest' | 'top_rated';
  searchQuery: string;
  tab: 'browse' | 'saved';

  initialize: () => Promise<void>;
  loadMore: () => Promise<void>;
  setCuisine: (cuisine: string | null) => void;
  setDietary: (dietary: string | null) => void;
  setSortBy: (sortBy: 'popular' | 'newest' | 'top_rated') => void;
  setSearch: (query: string) => void;
  setTab: (tab: 'browse' | 'saved') => void;
  loadSaved: (userId: string) => Promise<void>;
  toggleSave: (userId: string, recipeId: string, isSaved: boolean) => Promise<void>;
  rateRecipe: (userId: string, recipeId: string, rating: number) => Promise<void>;
  cleanup: () => void;
}

export const useCommunityStore = create<CommunityState>((set, get) => ({
  recipes: [],
  savedRecipes: [],
  isLoading: false,
  hasMore: true,
  page: 0,
  selectedCuisine: null,
  selectedDietary: null,
  sortBy: 'popular',
  searchQuery: '',
  tab: 'browse',

  initialize: async () => {
    set({ isLoading: true, page: 0 });
    try {
      const { selectedCuisine, selectedDietary, sortBy, searchQuery } = get();
      const { recipes, hasMore } = await communityService.browse({
        page: 0,
        cuisine: selectedCuisine || undefined,
        dietary: selectedDietary || undefined,
        sortBy,
        search: searchQuery || undefined,
      });
      set({ recipes, hasMore, isLoading: false });
    } catch (error) {
      logger.error('Error initializing community:', error);
      set({ isLoading: false });
    }
  },

  loadMore: async () => {
    const { hasMore, isLoading, page, selectedCuisine, selectedDietary, sortBy, searchQuery } = get();
    if (!hasMore || isLoading) return;

    set({ isLoading: true });
    try {
      const nextPage = page + 1;
      const { recipes, hasMore: more } = await communityService.browse({
        page: nextPage,
        cuisine: selectedCuisine || undefined,
        dietary: selectedDietary || undefined,
        sortBy,
        search: searchQuery || undefined,
      });
      set((state) => ({
        recipes: [...state.recipes, ...recipes],
        hasMore: more,
        page: nextPage,
        isLoading: false,
      }));
    } catch (error) {
      logger.error('Error loading more community recipes:', error);
      set({ isLoading: false });
    }
  },

  setCuisine: (cuisine) => {
    set({ selectedCuisine: cuisine, page: 0, recipes: [] });
    get().initialize();
  },

  setDietary: (dietary) => {
    set({ selectedDietary: dietary, page: 0, recipes: [] });
    get().initialize();
  },

  setSortBy: (sortBy) => {
    set({ sortBy, page: 0, recipes: [] });
    get().initialize();
  },

  setSearch: (query) => {
    set({ searchQuery: query, page: 0, recipes: [] });
    get().initialize();
  },

  setTab: (tab) => {
    set({ tab });
  },

  loadSaved: async (userId: string) => {
    set({ isLoading: true });
    try {
      const { recipes } = await communityService.getSavedRecipes(userId);
      set({ savedRecipes: recipes, isLoading: false });
    } catch (error) {
      logger.error('Error loading saved recipes:', error);
      set({ isLoading: false });
    }
  },

  toggleSave: async (userId: string, recipeId: string, isSaved: boolean) => {
    // Optimistic update
    set((state) => ({
      recipes: state.recipes.map((r) =>
        r.id === recipeId
          ? { ...r, is_saved: !isSaved, save_count: r.save_count + (isSaved ? -1 : 1) }
          : r
      ),
      savedRecipes: isSaved
        ? state.savedRecipes.filter((r) => r.id !== recipeId)
        : state.savedRecipes,
    }));

    const success = isSaved
      ? await communityService.unsaveRecipe(userId, recipeId)
      : await communityService.saveRecipe(userId, recipeId);

    if (!success) {
      // Revert on failure
      set((state) => ({
        recipes: state.recipes.map((r) =>
          r.id === recipeId
            ? { ...r, is_saved: isSaved, save_count: r.save_count + (isSaved ? 1 : -1) }
            : r
        ),
      }));
    }
  },

  rateRecipe: async (userId: string, recipeId: string, rating: number) => {
    await communityService.rateRecipe(userId, recipeId, rating);
    // Update local state
    set((state) => ({
      recipes: state.recipes.map((r) =>
        r.id === recipeId ? { ...r, user_rating: rating } : r
      ),
    }));
  },

  cleanup: () => {
    set({
      recipes: [],
      savedRecipes: [],
      isLoading: false,
      hasMore: true,
      page: 0,
      selectedCuisine: null,
      selectedDietary: null,
      sortBy: 'popular',
      searchQuery: '',
      tab: 'browse',
    });
  },
}));
