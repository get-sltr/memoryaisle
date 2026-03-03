import { create } from 'zustand';
import { mealMemoriesService, type MealMemory } from '../services/mealMemories';
import { logger } from '../utils/logger';

interface MealMemoriesState {
  memories: MealMemory[];
  recentMemories: MealMemory[];
  isLoading: boolean;
  hasMore: boolean;
  page: number;
  monthlyCount: number;

  // internal
  requestSeq: number;

  initialize: (householdId: string) => Promise<void>;
  loadMore: (householdId: string) => Promise<void>;
  addMemory: (memory: MealMemory) => void;
  removeMemory: (memoryId: string) => void;
  refreshRecent: (householdId: string) => Promise<void>;
  refreshMonthlyCount: (householdId: string) => Promise<void>;
  cleanup: () => void;
}

export const useMealMemoriesStore = create<MealMemoriesState>((set, get) => ({
  memories: [],
  recentMemories: [],
  isLoading: false,
  hasMore: true,
  page: 0,
  monthlyCount: 0,
  requestSeq: 0,

  initialize: async (householdId: string) => {
    const seq = get().requestSeq + 1;
    set({ isLoading: true, requestSeq: seq, memories: [], page: 0, hasMore: true });

    try {
      const [memoriesResult, recentResult, monthlyCount] = await Promise.all([
        mealMemoriesService.getMemories(householdId, 0),
        mealMemoriesService.getRecentMemories(householdId),
        mealMemoriesService.getMonthlyCount(householdId),
      ]);

      if (get().requestSeq !== seq) return;

      set({
        memories: memoriesResult.memories,
        recentMemories: recentResult.memories,
        hasMore: memoriesResult.hasMore,
        monthlyCount,
        isLoading: false,
        page: 0,
      });
    } catch (error) {
      logger.error('Error initializing meal memories:', error);
      if (get().requestSeq === seq) {
        set({ isLoading: false });
      }
    }
  },

  loadMore: async (householdId: string) => {
    if (get().isLoading || !get().hasMore) return;

    const nextPage = get().page + 1;
    set({ isLoading: true });

    try {
      const result = await mealMemoriesService.getMemories(householdId, nextPage);

      set((state) => ({
        memories: [...state.memories, ...result.memories],
        hasMore: result.hasMore,
        page: nextPage,
        isLoading: false,
      }));
    } catch (error) {
      logger.error('Error loading more memories:', error);
      set({ isLoading: false });
    }
  },

  addMemory: (memory: MealMemory) => {
    set((state) => ({
      memories: [memory, ...state.memories],
      recentMemories: [memory, ...state.recentMemories].slice(0, 5),
      monthlyCount: state.monthlyCount + 1,
    }));
  },

  removeMemory: (memoryId: string) => {
    set((state) => ({
      memories: state.memories.filter((m) => m.id !== memoryId),
      recentMemories: state.recentMemories.filter((m) => m.id !== memoryId),
      monthlyCount: Math.max(0, state.monthlyCount - 1),
    }));
  },

  refreshRecent: async (householdId: string) => {
    try {
      const result = await mealMemoriesService.getRecentMemories(householdId);
      set({ recentMemories: result.memories });
    } catch (error) {
      logger.error('Error refreshing recent memories:', error);
    }
  },

  refreshMonthlyCount: async (householdId: string) => {
    try {
      const count = await mealMemoriesService.getMonthlyCount(householdId);
      set({ monthlyCount: count });
    } catch (error) {
      logger.error('Error refreshing monthly count:', error);
    }
  },

  cleanup: () => {
    set({
      memories: [],
      recentMemories: [],
      isLoading: false,
      hasMore: true,
      page: 0,
      monthlyCount: 0,
    });
  },
}));
