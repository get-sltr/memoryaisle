// Apple In-App Purchases Service
// Handles subscriptions via App Store

let InAppPurchases: typeof import('expo-in-app-purchases') | null = null;
try {
  InAppPurchases = require('expo-in-app-purchases');
} catch (e) {
  // Native module not available (Expo Go)
  console.log('IAP native module not available - running in Expo Go mode');
}

import { Platform } from 'react-native';
import { supabase } from './supabase';
import { logger } from '../utils/logger';

// Product IDs - must match App Store Connect
export const IAP_PRODUCTS = {
  PREMIUM_MONTHLY: 'com.memoryaisle.premium.monthly',
  PREMIUM_YEARLY: 'com.memoryaisle.premium.yearly',
} as const;

export const PRODUCT_IDS = [
  IAP_PRODUCTS.PREMIUM_MONTHLY,
  IAP_PRODUCTS.PREMIUM_YEARLY,
];

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
      familyMembers: 2,
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
    price: { monthly: 9.99, yearly: 47.88 },
    features: {
      maxLists: -1, // unlimited
      maxItemsPerList: -1,
      miraQueriesPerDay: -1,
      recipesPerDay: -1,
      mealPlans: true,
      familyMembers: 12,
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
  price: string;
  priceAmountMicros: number;
  priceCurrencyCode: string;
}

class IAPService {
  private initialized = false;
  private products: IAPProduct[] = [];
  private purchaseSubscription$: { remove: () => void } | null = null;

  // Initialize IAP
  async initialize(): Promise<boolean> {
    if (this.initialized) return true;
    if (Platform.OS !== 'ios') {
      logger.warn('IAP only supported on iOS');
      return false;
    }
    if (!InAppPurchases) {
      logger.warn('IAP native module not available (Expo Go mode)');
      return false;
    }

    try {
      await InAppPurchases.connectAsync();
      this.initialized = true;
      logger.log('IAP initialized');
      return true;
    } catch (error) {
      logger.error('Failed to initialize IAP:', error);
      return false;
    }
  }

  // Get available products
  async getProducts(): Promise<IAPProduct[]> {
    if (!InAppPurchases) return [];
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const { results } = await InAppPurchases.getProductsAsync(PRODUCT_IDS);
      if (results) {
        this.products = results.map(product => ({
          productId: product.productId,
          title: product.title,
          description: product.description,
          price: product.price,
          priceAmountMicros: product.priceAmountMicros,
          priceCurrencyCode: product.priceCurrencyCode,
        }));
      }
      return this.products;
    } catch (error) {
      logger.error('Failed to get products:', error);
      return [];
    }
  }

  // Purchase a subscription
  async purchaseSubscription(
    productId: string,
    userId: string
  ): Promise<boolean> {
    if (!InAppPurchases) {
      logger.warn('IAP not available in Expo Go');
      return false;
    }
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Set up purchase listener
      this.purchaseSubscription$ = InAppPurchases.setPurchaseListener(
        async ({ responseCode, results, errorCode }) => {
          if (responseCode === InAppPurchases.IAPResponseCode.OK && results) {
            for (const purchase of results) {
              if (!purchase.acknowledged) {
                // Verify and save the purchase
                await this.verifyAndSavePurchase(userId, purchase);

                // Finish the transaction
                await InAppPurchases.finishTransactionAsync(purchase, true);
              }
            }
          } else if (responseCode === InAppPurchases.IAPResponseCode.USER_CANCELED) {
            logger.log('Purchase canceled by user');
          } else {
            logger.error('Purchase failed:', errorCode);
          }
        }
      );

      // Initiate purchase
      await InAppPurchases.purchaseItemAsync(productId);
      return true;
    } catch (error) {
      logger.error('Purchase error:', error);
      return false;
    }
  }

  // Verify and save purchase to database
  private async verifyAndSavePurchase(
    userId: string,
    purchase: InAppPurchases.InAppPurchase
  ): Promise<boolean> {
    try {
      // Determine billing interval from product ID
      const isYearly = purchase.productId === IAP_PRODUCTS.PREMIUM_YEARLY;
      const billingInterval: BillingInterval = isYearly ? 'year' : 'month';

      // Calculate period end (approximate - Apple doesn't provide exact date)
      const periodEnd = new Date();
      if (isYearly) {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      // Save to database
      // Note: iOS transaction properties are accessed via `any` since expo-in-app-purchases types don't expose them all
      const purchaseAny = purchase as any;
      const { error } = await supabase.from('subscriptions').upsert({
        user_id: userId,
        tier: 'premium',
        status: 'active',
        billing_interval: billingInterval,
        current_period_end: periodEnd.toISOString(),
        apple_product_id: purchase.productId,
        apple_transaction_id: purchaseAny.transactionId || purchaseAny.orderId || null,
        apple_original_transaction_id: purchaseAny.originalTransactionId || null,
        apple_receipt: purchase.transactionReceipt,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

      if (error) throw error;

      logger.log('Purchase saved successfully');
      return true;
    } catch (error) {
      logger.error('Failed to save purchase:', error);
      return false;
    }
  }

  // Restore purchases
  async restorePurchases(userId: string): Promise<boolean> {
    if (!InAppPurchases) {
      logger.warn('IAP not available in Expo Go');
      return false;
    }
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const { results } = await InAppPurchases.getPurchaseHistoryAsync();

      if (results && results.length > 0) {
        // Find most recent valid subscription
        const validPurchase = results.find(
          p => PRODUCT_IDS.includes(p.productId as typeof PRODUCT_IDS[number])
        );

        if (validPurchase) {
          await this.verifyAndSavePurchase(userId, validPurchase);
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('Failed to restore purchases:', error);
      return false;
    }
  }

  // Get current subscription info from database
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
      logger.error('Error getting subscription:', error);
      return { tier: 'free', status: 'none' };
    }
  }

  // Check if user has access to a feature
  canAccessFeature(subscription: SubscriptionInfo, feature: FeatureKey): boolean {
    const isActive = subscription.status === 'active' || subscription.status === 'trialing';
    const tier = isActive ? subscription.tier : 'free';
    const value = SUBSCRIPTION_TIERS[tier].features[feature];

    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === -1 || value > 0;
    return false;
  }

  // Get feature limit
  getFeatureLimit(subscription: SubscriptionInfo, feature: FeatureKey): number {
    const isActive = subscription.status === 'active' || subscription.status === 'trialing';
    const tier = isActive ? subscription.tier : 'free';
    const value = SUBSCRIPTION_TIERS[tier].features[feature];
    return typeof value === 'number' ? value : (value ? -1 : 0);
  }

  // Check if user is premium
  isPremium(subscription: SubscriptionInfo): boolean {
    return (
      subscription.tier === 'premium' &&
      (subscription.status === 'active' || subscription.status === 'trialing')
    );
  }

  // Get remaining quota for daily features
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
    } catch (error) {
      return { used: 0, limit, remaining: limit, unlimited: false };
    }
  }

  // Increment usage counter
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
      logger.error('Error incrementing usage:', error);
      return 0;
    }
  }

  // Disconnect
  async disconnect(): Promise<void> {
    if (this.initialized && InAppPurchases) {
      await InAppPurchases.disconnectAsync();
      this.initialized = false;
    }
  }
}

export const iapService = new IAPService();

// Export tier info for UI
export const FREE_TIER = SUBSCRIPTION_TIERS.free;
export const PREMIUM_TIER = SUBSCRIPTION_TIERS.premium;
