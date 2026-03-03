import { create } from 'zustand';
import { pantryService, type PantryItem } from '../services/pantry';
import { logger } from '../utils/logger';

interface PantryState {
  items: PantryItem[];
  expiringItems: PantryItem[];
  replenishItems: PantryItem[];
  isLoading: boolean;
  requestSeq: number;

  initialize: (householdId: string) => Promise<void>;
  refresh: (householdId: string) => Promise<void>;
  addItem: (item: PantryItem) => void;
  removeItem: (itemId: string) => void;
  updateItem: (itemId: string, updates: Partial<PantryItem>) => void;
  cleanup: () => void;
}

export const usePantryStore = create<PantryState>((set, get) => ({
  items: [],
  expiringItems: [],
  replenishItems: [],
  isLoading: false,
  requestSeq: 0,

  initialize: async (householdId: string) => {
    const seq = get().requestSeq + 1;
    set({ isLoading: true, requestSeq: seq });

    try {
      const [itemsResult, expiringResult, replenishResult] = await Promise.all([
        pantryService.getItems(householdId),
        pantryService.getExpiringItems(householdId, 3),
        pantryService.getReplenishItems(householdId),
      ]);

      if (get().requestSeq !== seq) return;

      set({
        items: itemsResult.items,
        expiringItems: expiringResult.items,
        replenishItems: replenishResult.items,
        isLoading: false,
      });
    } catch (error) {
      logger.error('Error initializing pantry:', error);
      if (get().requestSeq === seq) {
        set({ isLoading: false });
      }
    }
  },

  refresh: async (householdId: string) => {
    try {
      const [itemsResult, expiringResult, replenishResult] = await Promise.all([
        pantryService.getItems(householdId),
        pantryService.getExpiringItems(householdId, 3),
        pantryService.getReplenishItems(householdId),
      ]);

      set({
        items: itemsResult.items,
        expiringItems: expiringResult.items,
        replenishItems: replenishResult.items,
      });
    } catch (error) {
      logger.error('Error refreshing pantry:', error);
    }
  },

  addItem: (item: PantryItem) => {
    set((state) => ({
      items: [...state.items.filter(i => i.id !== item.id), item]
        .sort((a, b) => a.item_name.localeCompare(b.item_name)),
    }));
  },

  removeItem: (itemId: string) => {
    set((state) => ({
      items: state.items.filter((i) => i.id !== itemId),
      expiringItems: state.expiringItems.filter((i) => i.id !== itemId),
      replenishItems: state.replenishItems.filter((i) => i.id !== itemId),
    }));
  },

  updateItem: (itemId: string, updates: Partial<PantryItem>) => {
    set((state) => ({
      items: state.items.map((i) => i.id === itemId ? { ...i, ...updates } : i),
    }));
  },

  cleanup: () => {
    set({
      items: [],
      expiringItems: [],
      replenishItems: [],
      isLoading: false,
    });
  },
}));
