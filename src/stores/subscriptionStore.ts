import { create } from 'zustand';
import { getSubscriptionStatus } from '../services/subscription';

interface SubscriptionState {
  isPremium: boolean;
  isLoading: boolean;
  expiresAt: string | null;
  checkSubscription: () => Promise<void>;
  setPremium: (isPremium: boolean) => void;
  setLoading: (loading: boolean) => void;
}

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  isPremium: false,
  isLoading: true,
  expiresAt: null,

  checkSubscription: async () => {
    try {
      set({ isLoading: true });
      const { isPremium, expiresAt } = await getSubscriptionStatus();
      set({ isPremium, expiresAt, isLoading: false });
    } catch (error) {
      console.error('Check subscription error:', error);
      set({ isPremium: false, expiresAt: null, isLoading: false });
    }
  },

  setPremium: (isPremium) => set({ isPremium }),

  setLoading: (isLoading) => set({ isLoading }),
}));
