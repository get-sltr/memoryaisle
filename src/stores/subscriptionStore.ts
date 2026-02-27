// src/stores/subscriptionStore.ts
import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { iapService, SubscriptionInfo } from '../services/iap';
import { adminService } from '../services/admin';
import { logger } from '../utils/logger';

interface SubscriptionState {
  subscription: SubscriptionInfo | null;
  isLoading: boolean;
  activeCleanup: (() => void) | null;
  fetchSubscription: (userId: string | undefined) => Promise<void>;
  setupListeners: (userId: string) => () => void;
  initialize: (userId: string) => void;
  cleanup: () => void;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  subscription: null,
  isLoading: true,
  activeCleanup: null,

  fetchSubscription: async (userId) => {
    if (!userId) {
      set({ subscription: { tier: 'free', status: 'none' }, isLoading: false });
      return;
    }
    set({ isLoading: true });
    try {
      const isAdmin = await adminService.isAdmin();
      if (isAdmin) {
        set({ subscription: { tier: 'premium', status: 'active' }, isLoading: false });
        return;
      }
      const sub = await iapService.getSubscription(userId);
      set({ subscription: sub, isLoading: false });
    } catch (error) {
      logger.error('Subscription fetch failed, defaulting to free', error);
      set({ subscription: { tier: 'free', status: 'none' }, isLoading: false });
    }
  },

  setupListeners: (userId: string) => {
    const unsubscribeIAP = iapService.onStatusChange(() => {
      get().fetchSubscription(userId);
    });
    const channel = supabase
      .channel(`subscription-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subscriptions', filter: `user_id=eq.${userId}` },
        () => get().fetchSubscription(userId)
      )
      .subscribe();

    return () => {
      unsubscribeIAP();
      supabase.removeChannel(channel);
    };
  },

  initialize: (userId: string) => {
    get().fetchSubscription(userId);
    const cleanupListeners = get().setupListeners(userId);
    set({ activeCleanup: cleanupListeners });
  },

  cleanup: () => {
    const { activeCleanup } = get();
    if (activeCleanup) activeCleanup();
    set({ subscription: { tier: 'free', status: 'none' }, isLoading: false, activeCleanup: null });
  },
}));
