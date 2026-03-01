import { create } from "zustand";
import { supabase } from "../services/supabase";
import { iapService, type SubscriptionInfo } from "../services/iap";
import { adminService } from "../services/admin";
import { logger } from "../utils/logger";

type CleanupFn = () => void;

interface SubscriptionState {
  currentUserId: string | null;
  subscription: SubscriptionInfo;
  isLoading: boolean;

  // internal
  activeCleanup: CleanupFn | null;
  requestSeq: number;

  fetchSubscription: (userId?: string) => Promise<void>;
  initialize: (userId: string) => Promise<void>;
  cleanup: () => void;
}

const FREE: SubscriptionInfo = { tier: "free", status: "none" };

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  currentUserId: null,
  subscription: FREE,
  isLoading: false,

  activeCleanup: null,
  requestSeq: 0,

  fetchSubscription: async (userId?: string) => {
    const resolvedUserId = userId ?? get().currentUserId ?? undefined;

    // If no user, hard reset
    if (!resolvedUserId) {
      set({ subscription: FREE, isLoading: false });
      return;
    }

    // request sequence guard to prevent race overwrites
    const seq = get().requestSeq + 1;
    set({ isLoading: true, requestSeq: seq });

    try {
      // IMPORTANT: Admin override should never be a production entitlement mechanism.
      // If you keep it, make it dev-only or behind a secure server-verified flag.
      let allowAdminPremium = false;
      if (__DEV__) {
        try {
          allowAdminPremium = await adminService.isAdmin();
        } catch {
          allowAdminPremium = false;
        }
      }

      if (allowAdminPremium) {
        // Only for local dev/testing
        if (get().requestSeq === seq) {
          set({ subscription: { tier: "premium", status: "active" }, isLoading: false });
        }
        return;
      }

      const sub = await iapService.getSubscription(resolvedUserId);

      // Ignore stale responses
      if (get().requestSeq !== seq) return;

      set({ subscription: sub, isLoading: false });
    } catch (err) {
      logger.error("Subscription fetch failed, defaulting to free", { message: (err as any)?.message });
      if (get().requestSeq === seq) {
        set({ subscription: FREE, isLoading: false });
      }
    }
  },

  initialize: async (userId: string) => {
    // Tear down any existing listeners first (prevents duplicates)
    get().cleanup();

    set({ currentUserId: userId, isLoading: true });

    // First fetch
    await get().fetchSubscription(userId);

    // Setup listeners (use currentUserId from state, not captured variable)
    const unsubscribeIAP = iapService.onStatusChange(() => {
      const id = get().currentUserId;
      if (id) get().fetchSubscription(id);
    });

    const channel = supabase
      .channel(`subscription-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${userId}` },
        () => {
          const id = get().currentUserId;
          if (id) get().fetchSubscription(id);
        }
      )
      .subscribe((status) => {
        // Helpful visibility in prod debugging
        if (status === "CHANNEL_ERROR") {
          logger.warn("Subscription realtime channel error");
        }
      });

    const activeCleanup: CleanupFn = () => {
      try { unsubscribeIAP(); } catch {}
      try { supabase.removeChannel(channel); } catch {}
    };

    set({ activeCleanup });
  },

  cleanup: () => {
    const cleanup = get().activeCleanup;
    if (cleanup) {
      try { cleanup(); } catch {}
    }

    set({
      currentUserId: null,
      subscription: FREE,
      isLoading: false,
      activeCleanup: null,
    });
  },
}));