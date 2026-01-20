// useSubscription hook
// Provides subscription state and feature gating throughout the app

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import {
  iapService,
  SubscriptionInfo,
  FeatureKey,
  BillingInterval,
  SUBSCRIPTION_TIERS,
  IAP_PRODUCTS,
} from '../services/iap';
import { supabase } from '../services/supabase';
import { adminService } from '../services/admin';

interface UseSubscriptionReturn {
  // Subscription state
  subscription: SubscriptionInfo | null;
  isLoading: boolean;
  isPremium: boolean;

  // Feature gating
  canAccess: (feature: FeatureKey) => boolean;
  getLimit: (feature: FeatureKey) => number;

  // Actions
  refresh: () => Promise<void>;
  purchaseMonthly: () => Promise<boolean>;
  purchaseYearly: () => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
}

export function useSubscription(): UseSubscriptionReturn {
  const { user } = useAuthStore();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize IAP on mount
  useEffect(() => {
    iapService.initialize();
  }, []);

  // Fetch subscription on mount and when user changes
  const fetchSubscription = useCallback(async () => {
    if (!user?.id) {
      setSubscription({ tier: 'free', status: 'none' });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Check if user is admin/founder - they get premium for free
      const isAdmin = await adminService.isAdmin();
      if (isAdmin) {
        setSubscription({ tier: 'premium', status: 'active' });
        setIsLoading(false);
        return;
      }

      // Check if user is founder family member - they get premium for free
      const { data: isFounderFamily } = await supabase.rpc('is_founder_family');
      if (isFounderFamily) {
        setSubscription({ tier: 'premium', status: 'active' });
        setIsLoading(false);
        return;
      }

      const sub = await iapService.getSubscription(user.id);
      setSubscription(sub);
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setSubscription({ tier: 'free', status: 'none' });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Initial fetch
  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('subscription-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchSubscription();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchSubscription]);

  // Check if user is premium
  const isPremium = subscription ? iapService.isPremium(subscription) : false;

  // Feature access check
  const canAccess = useCallback(
    (feature: FeatureKey): boolean => {
      if (!subscription) return false;
      return iapService.canAccessFeature(subscription, feature);
    },
    [subscription]
  );

  // Get feature limit
  const getLimit = useCallback(
    (feature: FeatureKey): number => {
      if (!subscription) return SUBSCRIPTION_TIERS.free.features[feature] as number;
      return iapService.getFeatureLimit(subscription, feature);
    },
    [subscription]
  );

  // Purchase monthly subscription
  const purchaseMonthly = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;
    const success = await iapService.purchaseSubscription(
      IAP_PRODUCTS.PREMIUM_MONTHLY,
      user.id
    );
    if (success) {
      // Wait a moment for the purchase to process
      setTimeout(() => fetchSubscription(), 2000);
    }
    return success;
  }, [user?.id, fetchSubscription]);

  // Purchase yearly subscription
  const purchaseYearly = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;
    const success = await iapService.purchaseSubscription(
      IAP_PRODUCTS.PREMIUM_YEARLY,
      user.id
    );
    if (success) {
      setTimeout(() => fetchSubscription(), 2000);
    }
    return success;
  }, [user?.id, fetchSubscription]);

  // Restore purchases
  const restorePurchases = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;
    const success = await iapService.restorePurchases(user.id);
    if (success) {
      await fetchSubscription();
    }
    return success;
  }, [user?.id, fetchSubscription]);

  return {
    subscription,
    isLoading,
    isPremium,
    canAccess,
    getLimit,
    refresh: fetchSubscription,
    purchaseMonthly,
    purchaseYearly,
    restorePurchases,
  };
}

// Lightweight hook for just checking feature access
export function useFeatureAccess(feature: FeatureKey): {
  hasAccess: boolean;
  isLoading: boolean;
  limit: number;
  isPremium: boolean;
} {
  const { subscription, isLoading, canAccess, getLimit, isPremium } = useSubscription();

  return {
    hasAccess: canAccess(feature),
    isLoading,
    limit: getLimit(feature),
    isPremium,
  };
}

// Hook for checking quota-based features
export function useFeatureQuota(feature: 'miraQueriesPerDay' | 'recipesPerDay') {
  const { user } = useAuthStore();
  const { subscription, isLoading: subLoading, isPremium } = useSubscription();
  const [usage, setUsage] = useState({ used: 0, remaining: 0, limit: 0, unlimited: false });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchUsage() {
      if (!user?.id || !subscription) return;

      setIsLoading(true);
      const quota = await iapService.getRemainingQuota(user.id, subscription, feature);
      setUsage({
        used: quota.used,
        remaining: quota.remaining,
        limit: quota.limit,
        unlimited: quota.unlimited,
      });
      setIsLoading(false);
    }

    if (!subLoading) {
      fetchUsage();
    }
  }, [user?.id, subscription, subLoading, feature]);

  const increment = useCallback(async () => {
    if (!user?.id) return;
    const newCount = await iapService.incrementUsage(user.id, feature);

    // Update local state
    setUsage(prev => ({
      ...prev,
      used: newCount,
      remaining: prev.unlimited ? -1 : Math.max(0, prev.limit - newCount),
    }));
  }, [user?.id, feature]);

  return {
    ...usage,
    isLoading: isLoading || subLoading,
    increment,
    canUse: usage.unlimited || usage.remaining > 0,
    isPremium,
  };
}

// Hook for checking count-based limits (lists, family members, etc.)
export function useCountLimit(
  feature: 'maxLists' | 'familyMembers' | 'favorites' | 'traditions' | 'storeGeofencing',
  currentCount: number
) {
  const { subscription, isLoading, isPremium, getLimit } = useSubscription();
  const limit = getLimit(feature);
  const isUnlimited = limit === -1;
  const canAddMore = isUnlimited || currentCount < limit;
  const remaining = isUnlimited ? -1 : Math.max(0, limit - currentCount);

  return {
    limit,
    currentCount,
    remaining,
    isUnlimited,
    canAddMore,
    isLoading,
    isPremium,
    isAtLimit: !isUnlimited && currentCount >= limit,
  };
}
