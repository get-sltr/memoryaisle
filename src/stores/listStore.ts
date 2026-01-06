import { create } from 'zustand';
import type { ListItem, GroceryList } from '../types';

interface ListState {
  // Current active list
  currentList: GroceryList | null;
  items: ListItem[];

  // Loading states
  isLoading: boolean;
  isSyncing: boolean;

  // Actions
  setCurrentList: (list: GroceryList | null) => void;
  setItems: (items: ListItem[]) => void;
  addItem: (item: ListItem) => void;
  removeItem: (itemId: string) => void;
  completeItem: (itemId: string) => void;
  uncompleteItem: (itemId: string) => void;
  updateItemQuantity: (itemId: string, quantity: number) => void;

  // Sync
  setLoading: (loading: boolean) => void;
  setSyncing: (syncing: boolean) => void;

  // Computed
  incompleteItems: () => ListItem[];
  completedItems: () => ListItem[];
}

export const useListStore = create<ListState>((set, get) => ({
  currentList: null,
  items: [],
  isLoading: false,
  isSyncing: false,

  setCurrentList: (list) => set({ currentList: list }),

  setItems: (items) => set({ items }),

  addItem: (item) => set((state) => ({
    items: [...state.items, item],
  })),

  removeItem: (itemId) => set((state) => ({
    items: state.items.filter((item) => item.id !== itemId),
  })),

  completeItem: (itemId) => set((state) => ({
    items: state.items.map((item) =>
      item.id === itemId
        ? { ...item, is_completed: true, completed_at: new Date().toISOString() }
        : item
    ),
  })),

  uncompleteItem: (itemId) => set((state) => ({
    items: state.items.map((item) =>
      item.id === itemId
        ? { ...item, is_completed: false, completed_at: null }
        : item
    ),
  })),

  updateItemQuantity: (itemId, quantity) => set((state) => ({
    items: state.items.map((item) =>
      item.id === itemId ? { ...item, quantity } : item
    ),
  })),

  setLoading: (isLoading) => set({ isLoading }),
  setSyncing: (isSyncing) => set({ isSyncing }),

  incompleteItems: () => get().items.filter((item) => !item.is_completed),
  completedItems: () => get().items.filter((item) => item.is_completed),
}));
