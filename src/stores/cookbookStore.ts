import { create } from 'zustand';
import { cookbookService, type CookbookRecipe } from '../services/cookbook';
import { logger } from '../utils/logger';

interface CookbookState {
  recipes: CookbookRecipe[];
  isLoading: boolean;
  hasMore: boolean;
  page: number;
  selectedCuisine: string | null;
  favoritesOnly: boolean;
  searchQuery: string;
  recipeCount: number;
  requestSeq: number;

  initialize: (householdId: string) => Promise<void>;
  loadMore: (householdId: string) => Promise<void>;
  setCuisine: (householdId: string, cuisine: string | null) => Promise<void>;
  setFavoritesOnly: (householdId: string, favoritesOnly: boolean) => Promise<void>;
  setSearch: (householdId: string, query: string) => Promise<void>;
  addRecipe: (recipe: CookbookRecipe) => void;
  removeRecipe: (recipeId: string) => void;
  updateRecipe: (recipeId: string, updates: Partial<CookbookRecipe>) => void;
  refreshCount: (householdId: string) => Promise<void>;
  cleanup: () => void;
}

export const useCookbookStore = create<CookbookState>((set, get) => ({
  recipes: [],
  isLoading: false,
  hasMore: true,
  page: 0,
  selectedCuisine: null,
  favoritesOnly: false,
  searchQuery: '',
  recipeCount: 0,
  requestSeq: 0,

  initialize: async (householdId: string) => {
    const seq = get().requestSeq + 1;
    set({ isLoading: true, requestSeq: seq, page: 0 });

    try {
      const [result, count] = await Promise.all([
        cookbookService.getRecipes(householdId, {
          page: 0,
          cuisine: get().selectedCuisine || undefined,
          favoritesOnly: get().favoritesOnly,
          search: get().searchQuery || undefined,
        }),
        cookbookService.getRecipeCount(householdId),
      ]);

      if (get().requestSeq !== seq) return;

      set({
        recipes: result.recipes,
        hasMore: result.hasMore,
        recipeCount: count,
        isLoading: false,
      });
    } catch (error) {
      logger.error('Error initializing cookbook:', error);
      if (get().requestSeq === seq) {
        set({ isLoading: false });
      }
    }
  },

  loadMore: async (householdId: string) => {
    if (get().isLoading || !get().hasMore) return;

    const nextPage = get().page + 1;
    set({ isLoading: true, page: nextPage });

    try {
      const result = await cookbookService.getRecipes(householdId, {
        page: nextPage,
        cuisine: get().selectedCuisine || undefined,
        favoritesOnly: get().favoritesOnly,
        search: get().searchQuery || undefined,
      });

      set((state) => ({
        recipes: [...state.recipes, ...result.recipes],
        hasMore: result.hasMore,
        isLoading: false,
      }));
    } catch (error) {
      logger.error('Error loading more recipes:', error);
      set({ isLoading: false });
    }
  },

  setCuisine: async (householdId: string, cuisine: string | null) => {
    set({ selectedCuisine: cuisine, page: 0, recipes: [], hasMore: true });
    await get().initialize(householdId);
  },

  setFavoritesOnly: async (householdId: string, favoritesOnly: boolean) => {
    set({ favoritesOnly, page: 0, recipes: [], hasMore: true });
    await get().initialize(householdId);
  },

  setSearch: async (householdId: string, query: string) => {
    set({ searchQuery: query, page: 0, recipes: [], hasMore: true });
    await get().initialize(householdId);
  },

  addRecipe: (recipe: CookbookRecipe) => {
    set((state) => ({
      recipes: [recipe, ...state.recipes],
      recipeCount: state.recipeCount + 1,
    }));
  },

  removeRecipe: (recipeId: string) => {
    set((state) => ({
      recipes: state.recipes.filter((r) => r.id !== recipeId),
      recipeCount: Math.max(0, state.recipeCount - 1),
    }));
  },

  updateRecipe: (recipeId: string, updates: Partial<CookbookRecipe>) => {
    set((state) => ({
      recipes: state.recipes.map((r) =>
        r.id === recipeId ? { ...r, ...updates } : r
      ),
    }));
  },

  refreshCount: async (householdId: string) => {
    const count = await cookbookService.getRecipeCount(householdId);
    set({ recipeCount: count });
  },

  cleanup: () => {
    set({
      recipes: [],
      isLoading: false,
      hasMore: true,
      page: 0,
      selectedCuisine: null,
      favoritesOnly: false,
      searchQuery: '',
      recipeCount: 0,
    });
  },
}));
