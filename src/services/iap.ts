// In-App Purchases Service -- StoreKit 2 via react-native-iap v14
// Handles iOS subscriptions through App Store.
//
// ARCHITECTURE: StoreKit 2 on-device verification + server-side activation.
// iOS verifies transactions at the OS level. After a verified purchase,
// the client sends transaction data to apple-verify-receipt Edge Function
// which writes subscription status using service_role (bypassing RLS).
// Apple Server Notifications V2 webhook is the ultimate source of truth
// for renewals, expirations, refunds, and revocations.

import { Platform } from 'react-native';
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  getAvailablePurchases,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  ErrorCode,
  type Purchase,
  type PurchaseError,
  type EventSubscription,
} from 'react-native-iap';
import { supabase } from './supabase';
import { logger } from '../utils/logger';

// Product IDs — must match App Store Connect exactly
export const IAP_PRODUCTS = {
  PREMIUM_YEARLY: 'com.memoryaisle.app.premium.yearly',
} as const;

const SUBSCRIPTION_SKUS = [IAP_PRODUCTS.PREMIUM_YEARLY];

// Subscription tier definitions
export const SUBSCRIPTION_TIERS = {
  free: {
    id: 'free',
    name: 'Free',
    price: { monthly: 0, yearly: 0 },
    features: {
      maxLists: 2,
      maxItemsPerList: 50,
      miraQueriesPerDay: 10,
      recipesPerDay: 3,
      mealPlans: false,
      familyMembers: 1,
      voiceCommands: true,
      receiptScanning: false,
      tripPlanning: false,
      traditions: 2,
      favorites: 10,
      storeGeofencing: 1,
      smartCalendar: false,
      prioritySupport: false,
    },
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    price: { monthly: 9.99, yearly: 49.99 },
    features: {
      maxLists: -1,
      maxItemsPerList: -1,
      miraQueriesPerDay: -1,
      recipesPerDay: -1,
      mealPlans: true,
      familyMembers: 7,
      voiceCommands: true,
      receiptScanning: true,
      tripPlanning: true,
      traditions: -1,
      favorites: -1,
      storeGeofencing: -1,
      smartCalendar: true,
      prioritySupport: true,
    },
  },
} as const;

export type SubscriptionTier = keyof typeof SUBSCRIPTION_TIERS;
export type FeatureKey = keyof typeof SUBSCRIPTION_TIERS.free.features;
export type BillingInterval = 'month' | 'year';

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'none';
  billingInterval?: BillingInterval;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  productId?: string;
  transactionId?: string;
}

export interface IAPProduct {
  productId: string;
  title: string;
  description: string;
  localizedPrice: string;
  price: string;
  currency: string;
}

// Purchase result returned to callers
export type PurchaseResult =
  | { status: 'success' }
  | { status: 'cancelled' }
  | { status: 'pending' }
  | { status: 'error'; message: string };

class IAPService {
  private initialized = false;
  private purchaseUpdateSub: EventSubscription | null = null;
  private purchaseErrorSub: EventSubscription | null = null;
  private purchaseResolver: ((result: PurchaseResult) => void) | null = null;

  // ─── Connection ──────────────────────────────────────────────

  async initialize(): Promise<boolean> {
    if (this.initialized) return true;
    if (Platform.OS !== 'ios') {
      logger.warn('IAP: only supported on iOS');
      return false;
    }

    try {
      // Clear any stale native connection (e.g. after hot reload)
      try { await endConnection(); } catch {}
      await initConnection();
      this.initialized = true;
      logger.log('IAP: connected to App Store');
      return true;
    } catch (error) {
      logger.error('IAP: failed to connect', error);
      return false;
    }
  }

  // ─── Transaction Listeners ───────────────────────────────────

  startTransactionListener(
    userId: string,
    onStatusChange: () => void
  ): void {
    this.removeTransactionListeners();

    this.purchaseUpdateSub = purchaseUpdatedListener(
      async (purchase: Purchase) => {
        logger.log('IAP: purchase update received', purchase.productId);

        try {
          // StoreKit 2 verifies transactions at the OS level.
          // Write the subscription status directly to the DB.
          const activated = await this.activateSubscription(purchase);

          // Finish the transaction with Apple regardless — so it's not re-delivered
          await finishTransaction({ purchase, isConsumable: false });

          if (this.purchaseResolver) {
            if (activated) {
              this.purchaseResolver({ status: 'success' });
            } else {
              this.purchaseResolver({
                status: 'error',
                message: 'Could not activate subscription. Please try Restore Purchases.',
              });
            }
            this.purchaseResolver = null;
          }

          // Notify caller to refresh subscription state from DB
          onStatusChange();
        } catch (error) {
          logger.error('IAP: failed to process purchase', error);
          // Still finish the transaction so Apple doesn't redeliver
          try { await finishTransaction({ purchase, isConsumable: false }); } catch {}

          if (this.purchaseResolver) {
            this.purchaseResolver({
              status: 'error',
              message: 'Failed to activate subscription. Please try Restore Purchases.',
            });
            this.purchaseResolver = null;
          }
        }
      }
    );

    this.purchaseErrorSub = purchaseErrorListener(
      (error: PurchaseError) => {
        if (error.code === ErrorCode.UserCancelled) {
          logger.log('IAP: purchase cancelled by user');
          if (this.purchaseResolver) {
            this.purchaseResolver({ status: 'cancelled' });
            this.purchaseResolver = null;
          }
          return;
        }

        if (error.code === ErrorCode.DeferredPayment || error.code === ErrorCode.Pending) {
          logger.log('IAP: purchase deferred/pending');
          if (this.purchaseResolver) {
            this.purchaseResolver({ status: 'pending' });
            this.purchaseResolver = null;
          }
          return;
        }

        logger.error('IAP: purchase error', error.code, error.message);
        if (this.purchaseResolver) {
          this.purchaseResolver({
            status: 'error',
            message: error.message || 'Purchase failed. Please try again.',
          });
          this.purchaseResolver = null;
        }
      }
    );

    logger.log('IAP: transaction listeners started');
  }

  // ─── Server-Side Activation ─────────────────────────────────

  /**
   * Send the StoreKit 2 verified purchase to the server for activation.
   * The apple-verify-receipt Edge Function writes to the subscriptions table
   * using service_role, ensuring the client never writes directly.
   */
  private async activateSubscription(purchase: Purchase): Promise<boolean> {
    const transactionId = purchase.transactionId;
    if (!transactionId) {
      logger.error('IAP: no transactionId on purchase');
      return false;
    }

    try {
      const expirationDate = (purchase as any).expirationDateIOS
        ? new Date(Number((purchase as any).expirationDateIOS)).toISOString()
        : null;

      const { data, error } = await supabase.functions.invoke('apple-verify-receipt', {
        body: {
          productId: purchase.productId,
          transactionId,
          originalTransactionId:
            (purchase as any).originalTransactionIdentifierIOS || transactionId,
          expiresDate: expirationDate,
          environment: (purchase as any).environmentIOS || null,
          autoRenewStatus: (purchase as any).autoRenewingIOS ?? true,
        },
      });

      if (error) {
        logger.error('IAP: server activation failed', error);
        return false;
      }

      logger.log('IAP: subscription activated via server');
      return true;
    } catch (error) {
      logger.error('IAP: activation error', error);
      return false;
    }
  }

  // ─── Products ────────────────────────────────────────────────

  async getSubscriptionProduct(): Promise<IAPProduct | null> {
    if (!this.initialized) {
      const connected = await this.initialize();
      if (!connected) return null;
    }

    try {
      let products;
      try {
        products = await fetchProducts({ skus: SUBSCRIPTION_SKUS, type: 'subs' });
      } catch (initError: any) {
        // Retry once with a fresh connection if native state is stale
        if (initError?.code === 'init-connection' || initError?.message?.includes('not initialized')) {
          logger.log('IAP: retrying with fresh connection');
          this.initialized = false;
          const reconnected = await this.initialize();
          if (!reconnected) return null;
          products = await fetchProducts({ skus: SUBSCRIPTION_SKUS, type: 'subs' });
        } else {
          throw initError;
        }
      }

      if (!products || products.length === 0) {
        logger.warn('IAP: no products returned from App Store');
        return null;
      }

      const product = products[0];
      return {
        productId: product.id,
        title: product.title,
        description: product.description,
        localizedPrice: product.displayPrice,
        price: String(product.price ?? ''),
        currency: product.currency,
      };
    } catch (error) {
      logger.error('IAP: failed to fetch products', error);
      return null;
    }
  }

  // ─── Purchase ────────────────────────────────────────────────

  async purchaseSubscription(): Promise<PurchaseResult> {
    if (!this.initialized) {
      const connected = await this.initialize();
      if (!connected) {
        return { status: 'error', message: 'Could not connect to the App Store. Please try again.' };
      }
    }

    try {
      const resultPromise = new Promise<PurchaseResult>((resolve) => {
        this.purchaseResolver = resolve;

        // Safety timeout — if nothing happens in 2 minutes, clean up
        setTimeout(() => {
          if (this.purchaseResolver === resolve) {
            this.purchaseResolver = null;
            resolve({
              status: 'error',
              message: 'Purchase timed out. If you were charged, use Restore Purchases.',
            });
          }
        }, 120_000);
      });

      await requestPurchase({
        request: { apple: { sku: IAP_PRODUCTS.PREMIUM_YEARLY } },
        type: 'subs',
      });

      return resultPromise;
    } catch (error: any) {
      if (error?.code === ErrorCode.UserCancelled) {
        return { status: 'cancelled' };
      }
      logger.error('IAP: purchase request failed', error);
      return { status: 'error', message: 'Could not start purchase. Please try again.' };
    }
  }

  // ─── Restore ─────────────────────────────────────────────────

  async restorePurchases(): Promise<boolean> {
    if (!this.initialized) {
      const connected = await this.initialize();
      if (!connected) return false;
    }

    try {
      const purchases = await getAvailablePurchases();

      if (!purchases || purchases.length === 0) {
        logger.log('IAP: no purchases to restore');
        return false;
      }

      // Find our subscription
      const subscriptionPurchase = purchases.find(
        (p) => p.productId === IAP_PRODUCTS.PREMIUM_YEARLY
      );

      if (!subscriptionPurchase) {
        logger.log('IAP: no matching subscription found');
        return false;
      }

      // Write the subscription status directly to DB
      const activated = await this.activateSubscription(subscriptionPurchase);

      // Finish all transactions
      for (const purchase of purchases) {
        try { await finishTransaction({ purchase, isConsumable: false }); } catch {}
      }

      logger.log(`IAP: restore ${activated ? 'succeeded' : 'failed'}`);
      return activated;
    } catch (error) {
      logger.error('IAP: failed to restore purchases', error);
      return false;
    }
  }

  // ─── Sync on Launch ──────────────────────────────────────────

  /**
   * Check active entitlements via StoreKit 2 and sync to DB.
   * Called on app launch to keep DB in sync with on-device state.
   */
  async syncSubscriptionOnLaunch(): Promise<void> {
    if (!this.initialized) return;

    try {
      const purchases = await getAvailablePurchases();
      const activeSub = purchases?.find(
        (p) => p.productId === IAP_PRODUCTS.PREMIUM_YEARLY
      );

      if (activeSub) {
        await this.activateSubscription(activeSub);
      }
    } catch (error) {
      // Non-critical — Apple Server Notifications are the source of truth
      logger.error('IAP: launch sync failed', error);
    }
  }

  // ─── Subscription Status (read-only from DB) ────────────────

  async getSubscription(userId: string): Promise<SubscriptionInfo> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return { tier: 'free', status: 'none' };
      }

      // Check expiration client-side as a fast guard
      // (server is the source of truth via Apple notifications)
      if (
        data.tier === 'premium' &&
        data.status === 'active' &&
        data.current_period_end
      ) {
        const periodEnd = new Date(data.current_period_end);
        if (periodEnd < new Date()) {
          return { tier: 'free', status: 'none' };
        }
      }

      return {
        tier: (data.tier || 'free') as SubscriptionTier,
        status: data.status || 'none',
        billingInterval: data.billing_interval as BillingInterval | undefined,
        currentPeriodEnd: data.current_period_end,
        cancelAtPeriodEnd: data.cancel_at_period_end,
        productId: data.apple_product_id,
        transactionId: data.apple_transaction_id,
      };
    } catch (error) {
      logger.error('IAP: error reading subscription', error);
      return { tier: 'free', status: 'none' };
    }
  }

  // ─── Feature Gating ──────────────────────────────────────────

  canAccessFeature(subscription: SubscriptionInfo, feature: FeatureKey): boolean {
    const isActive = subscription.status === 'active' || subscription.status === 'trialing';
    const tier = isActive ? subscription.tier : 'free';
    const value = SUBSCRIPTION_TIERS[tier].features[feature];

    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === -1 || value > 0;
    return false;
  }

  getFeatureLimit(subscription: SubscriptionInfo, feature: FeatureKey): number {
    const isActive = subscription.status === 'active' || subscription.status === 'trialing';
    const tier = isActive ? subscription.tier : 'free';
    const value = SUBSCRIPTION_TIERS[tier].features[feature];
    return typeof value === 'number' ? value : value ? -1 : 0;
  }

  isPremium(subscription: SubscriptionInfo): boolean {
    return (
      subscription.tier === 'premium' &&
      (subscription.status === 'active' || subscription.status === 'trialing')
    );
  }

  // ─── Usage Tracking ──────────────────────────────────────────

  async getRemainingQuota(
    userId: string,
    subscription: SubscriptionInfo,
    feature: 'miraQueriesPerDay' | 'recipesPerDay'
  ): Promise<{ used: number; limit: number; remaining: number; unlimited: boolean }> {
    const limit = this.getFeatureLimit(subscription, feature);

    if (limit === -1) {
      return { used: 0, limit: -1, remaining: -1, unlimited: true };
    }

    try {
      const featureKey = feature === 'miraQueriesPerDay' ? 'mira_queries' : 'recipes';
      const today = new Date().toISOString().split('T')[0];

      const { data } = await supabase
        .from('usage_tracking')
        .select('count')
        .eq('user_id', userId)
        .eq('feature', featureKey)
        .eq('date', today)
        .single();

      const used = data?.count || 0;
      return {
        used,
        limit,
        remaining: Math.max(0, limit - used),
        unlimited: false,
      };
    } catch {
      return { used: 0, limit, remaining: limit, unlimited: false };
    }
  }

  async incrementUsage(
    userId: string,
    feature: 'miraQueriesPerDay' | 'recipesPerDay'
  ): Promise<number> {
    try {
      const featureKey = feature === 'miraQueriesPerDay' ? 'mira_queries' : 'recipes';
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase.rpc('increment_daily_usage', {
        p_user_id: userId,
        p_feature: featureKey,
        p_date: today,
      });

      if (error) throw error;
      return data || 1;
    } catch (error) {
      logger.error('IAP: error incrementing usage', error);
      return 0;
    }
  }

  // ─── Cleanup ─────────────────────────────────────────────────

  removeTransactionListeners(): void {
    this.purchaseUpdateSub?.remove();
    this.purchaseErrorSub?.remove();
    this.purchaseUpdateSub = null;
    this.purchaseErrorSub = null;
  }

  async disconnect(): Promise<void> {
    this.removeTransactionListeners();
    if (this.initialized) {
      try { await endConnection(); } catch {}
      this.initialized = false;
    }
  }
}

export const iapService = new IAPService();

export const FREE_TIER = SUBSCRIPTION_TIERS.free;
export const PREMIUM_TIER = SUBSCRIPTION_TIERS.premium;
