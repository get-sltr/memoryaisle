// src/hooks/useSubscription.ts
//
// All hooks read from the shared subscriptionStore (Zustand).
// Zero duplicate DB queries, zero duplicate realtime channels.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import {
  iapService,
  FeatureKey,
  SUBSCRIPTION_TIERS,
  IAPProduct,
  type PurchaseResult,
} from '../services/iap';

// -----------------------------------------------------------------------
// Main hook: full subscription management including IAP product & purchase
//
// Only use on screens that need product info or purchase actions
// (e.g. the upgrade/paywall screen). For feature gating, use the
// lightweight hooks below.
// -----------------------------------------------------------------------

export function useSubscription() {
  const { user } = useAuthStore();
  const subscription = useSubscriptionStore((s) => s.subscription);
  const isLoading = useSubscriptionStore((s) => s.isLoading);
  const fetchSubscription = useSubscriptionStore((s) => s.fetchSubscription);
  const [product, setProduct] = useState<IAPProduct | null>(null);
  const productFetched = useRef(false);

  // Fetch product info from Apple -- delayed, error-isolated, once only.
  // This is the only hook that triggers StoreKit.
  useEffect(() => {
    if (!user?.id || productFetched.current) return;

    let cancelled = false;

    const loadProduct = async () => {
      try {
        const p = await iapService.getSubscriptionProduct();
        if (!cancelled && p) {
          setProduct(p);
          productFetched.current = true;
        }
      } catch {
        // Non-fatal: upgrade screen falls back to SUBSCRIPTION_TIERS price
      }
    };

    const timer = setTimeout(loadProduct, 1000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [user?.id]);

  const isPremium = subscription ? iapService.isPremium(subscription) : false;

  const canAccess = useCallback(
    (feature: FeatureKey): boolean => {
      return subscription ? iapService.canAccessFeature(subscription, feature) : false;
    },
    [subscription]
  );

  const getLimit = useCallback(
    (feature: FeatureKey): number => {
      return subscription
        ? iapService.getFeatureLimit(subscription, feature)
        : (SUBSCRIPTION_TIERS.free.features[feature] as number);
    },
    [subscription]
  );

  const purchaseYearly = useCallback(async (): Promise<PurchaseResult> => {
    if (!user?.id) return { status: 'error', message: 'Please sign in.' };
    return iapService.purchaseSubscription();
  }, [user?.id]);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;
    const success = await iapService.restorePurchases();
    if (success) await fetchSubscription(user.id);
    return success;
  }, [user?.id, fetchSubscription]);

  const refresh = useCallback(() => {
    return fetchSubscription(user?.id);
  }, [user?.id, fetchSubscription]);

  return {
    subscription,
    isLoading,
    isPremium,
    product,
    canAccess,
    getLimit,
    refresh,
    purchaseYearly,
    restorePurchases,
  };
}

// -----------------------------------------------------------------------
// Lightweight hook for checking feature access (NO StoreKit)
// -----------------------------------------------------------------------

export function useFeatureAccess(feature: FeatureKey) {
  const subscription = useSubscriptionStore((s) => s.subscription);
  const isLoading = useSubscriptionStore((s) => s.isLoading);

  const isPremium = subscription ? iapService.isPremium(subscription) : false;
  const hasAccess = subscription ? iapService.canAccessFeature(subscription, feature) : false;
  const limit = subscription
    ? iapService.getFeatureLimit(subscription, feature)
    : (SUBSCRIPTION_TIERS.free.features[feature] as number);

  return { hasAccess, isLoading, limit, isPremium };
}

// -----------------------------------------------------------------------
// Hook for checking quota-based features (NO StoreKit)
//
// Subscription state from shared store. Usage fetch is per-component
// since it's per-feature and changes on each use.
// -----------------------------------------------------------------------

export function useFeatureQuota(feature: 'miraQueriesPerDay' | 'recipesPerDay') {
  const { user } = useAuthStore();
  const subscription = useSubscriptionStore((s) => s.subscription);
  const subLoading = useSubscriptionStore((s) => s.isLoading);

  const isPremium = subscription ? iapService.isPremium(subscription) : false;
  const [usage, setUsage] = useState({ used: 0, remaining: 0, limit: 0, unlimited: false });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchUsage() {
      if (!user?.id || !subscription) return;

      setIsLoading(true);
      try {
        const quota = await iapService.getRemainingQuota(user.id, subscription, feature);
        setUsage(quota);
      } catch {
        // Keep existing usage state on error
      } finally {
        setIsLoading(false);
      }
    }

    if (!subLoading) fetchUsage();
  }, [user?.id, subscription, subLoading, feature]);

  const increment = useCallback(async () => {
    if (!user?.id) return;
    const newCount = await iapService.incrementUsage(user.id, feature);

    setUsage((prev) => ({
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

// -----------------------------------------------------------------------
// Hook for checking count-based limits (NO StoreKit)
// Pure read from the shared store. Zero side effects.
// -----------------------------------------------------------------------

export function useCountLimit(
  feature: 'maxLists' | 'familyMembers' | 'favorites' | 'traditions' | 'storeGeofencing',
  currentCount: number
) {
  const subscription = useSubscriptionStore((s) => s.subscription);
  const isLoading = useSubscriptionStore((s) => s.isLoading);

  const isPremium = subscription ? iapService.isPremium(subscription) : false;
  const limit = subscription
    ? iapService.getFeatureLimit(subscription, feature)
    : (SUBSCRIPTION_TIERS.free.features[feature] as number);

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