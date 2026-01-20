// Stripe Premium Service
// Handles subscriptions, payments, and premium feature gating

import { supabase } from './supabase';
import { logger } from '../utils/logger';

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
      smartCalendar: false, // View only
      prioritySupport: false,
    },
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    price: { monthly: 9.99, yearly: 47.88 },
    trialDays: 3,
    // Stripe Price IDs from Stripe Dashboard
    priceIds: {
      monthly: 'price_1SomW73FbtW6sYG8KZUh7paR', // $9.99/month
      yearly: 'price_1Soml13FbtW6sYG8pBy4RcKz',  // $47.88/year (Premium Plus Yearly)
    },
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
export type BillingInterval = 'month' | 'year';

export type FeatureKey = keyof typeof SUBSCRIPTION_TIERS.free.features;

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'none';
  billingInterval?: BillingInterval;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

export interface CheckoutSession {
  sessionId: string;
  url: string;
}

export interface UsageInfo {
  feature: string;
  used: number;
  limit: number;
  unlimited: boolean;
  remaining: number;
}

class StripeService {
  private publishableKey: string = '';
  private initialized = false;

  // Initialize Stripe
  async initialize(publishableKey: string): Promise<void> {
    this.publishableKey = publishableKey;
    this.initialized = true;
    logger.log('Stripe initialized');
  }

  // Get current subscription info
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
        stripeCustomerId: data.stripe_customer_id,
        stripeSubscriptionId: data.stripe_subscription_id,
      };
    } catch (error) {
      logger.error('Error getting subscription:', error);
      return { tier: 'free', status: 'none' };
    }
  }

  // Create checkout session for subscription
  async createCheckoutSession(
    userId: string,
    interval: BillingInterval
  ): Promise<CheckoutSession | null> {
    try {
      const priceId = interval === 'month'
        ? SUBSCRIPTION_TIERS.premium.priceIds.monthly
        : SUBSCRIPTION_TIERS.premium.priceIds.yearly;

      const { data, error } = await supabase.functions.invoke('stripe-create-checkout', {
        body: {
          userId,
          priceId,
          tier: 'premium',
          interval,
          successUrl: 'memoryaisle://subscription/success',
          cancelUrl: 'memoryaisle://subscription/cancel',
        },
      });

      if (error) throw error;

      return {
        sessionId: data.sessionId,
        url: data.url,
      };
    } catch (error) {
      logger.error('Error creating checkout session:', error);
      return null;
    }
  }

  // Create customer portal session (manage subscription)
  async createPortalSession(userId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase.functions.invoke('stripe-create-portal', {
        body: {
          userId,
          returnUrl: 'memoryaisle://settings',
        },
      });

      if (error) throw error;

      return data.url;
    } catch (error) {
      logger.error('Error creating portal session:', error);
      return null;
    }
  }

  // Check if user has access to a feature
  canAccessFeature(
    subscription: SubscriptionInfo,
    feature: FeatureKey
  ): boolean {
    // If premium but not active, fall back to free tier
    if (subscription.tier !== 'free' && subscription.status !== 'active' && subscription.status !== 'trialing') {
      const freeValue = SUBSCRIPTION_TIERS.free.features[feature];
      if (typeof freeValue === 'boolean') return freeValue;
      if (typeof freeValue === 'number') return freeValue === -1 || freeValue > 0;
      return false;
    }

    const tier = SUBSCRIPTION_TIERS[subscription.tier];
    const value = tier.features[feature];

    // For boolean features
    if (typeof value === 'boolean') {
      return value;
    }

    // For numeric limits, -1 means unlimited
    if (typeof value === 'number') {
      return value === -1 || value > 0;
    }

    return false;
  }

  // Get feature limit
  getFeatureLimit(subscription: SubscriptionInfo, feature: FeatureKey): number {
    // If premium but not active, fall back to free tier
    if (subscription.tier !== 'free' && subscription.status !== 'active' && subscription.status !== 'trialing') {
      const value = SUBSCRIPTION_TIERS.free.features[feature];
      return typeof value === 'number' ? value : (value ? -1 : 0);
    }

    const tier = SUBSCRIPTION_TIERS[subscription.tier];
    const value = tier.features[feature];
    return typeof value === 'number' ? value : (value ? -1 : 0);
  }

  // Get remaining quota for a feature
  async getRemainingQuota(
    userId: string,
    subscription: SubscriptionInfo,
    feature: 'miraQueriesPerDay' | 'recipesPerDay'
  ): Promise<UsageInfo> {
    const limit = this.getFeatureLimit(subscription, feature);

    // Unlimited
    if (limit === -1) {
      return { feature, used: 0, limit: -1, unlimited: true, remaining: -1 };
    }

    // Get current usage from database
    try {
      const featureKey = feature === 'miraQueriesPerDay' ? 'mira_queries' : 'recipes';
      const { data } = await supabase.rpc('get_usage', {
        p_user_id: userId,
        p_feature: featureKey,
      });

      const used = data || 0;
      return {
        feature,
        used,
        limit,
        unlimited: false,
        remaining: Math.max(0, limit - used),
      };
    } catch (error) {
      logger.error('Error getting usage:', error);
      return { feature, used: 0, limit, unlimited: false, remaining: limit };
    }
  }

  // Increment usage for a feature
  async incrementUsage(
    userId: string,
    feature: 'miraQueriesPerDay' | 'recipesPerDay' | 'mealPlans'
  ): Promise<number> {
    try {
      const featureKey = feature === 'miraQueriesPerDay' ? 'mira_queries'
        : feature === 'recipesPerDay' ? 'recipes'
        : 'meal_plans';

      const { data, error } = await supabase.rpc('increment_usage', {
        p_user_id: userId,
        p_feature: featureKey,
      });

      if (error) throw error;
      return data || 1;
    } catch (error) {
      logger.error('Error incrementing usage:', error);
      return 0;
    }
  }

  // Cancel subscription
  async cancelSubscription(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase.functions.invoke('stripe-cancel-subscription', {
        body: { userId },
      });

      if (error) throw error;
      return true;
    } catch (error) {
      logger.error('Error canceling subscription:', error);
      return false;
    }
  }

  // Resume canceled subscription
  async resumeSubscription(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase.functions.invoke('stripe-resume-subscription', {
        body: { userId },
      });

      if (error) throw error;
      return true;
    } catch (error) {
      logger.error('Error resuming subscription:', error);
      return false;
    }
  }

  // Format price for display
  formatPrice(amount: number, interval?: BillingInterval): string {
    if (amount === 0) return 'Free';
    const formatted = `$${amount.toFixed(2)}`;
    if (interval === 'month') return `${formatted}/mo`;
    if (interval === 'year') return `${formatted}/yr`;
    return formatted;
  }

  // Calculate savings percentage for yearly
  getYearlySavings(): { percentage: number; amount: number } {
    const monthlyTotal = SUBSCRIPTION_TIERS.premium.price.monthly * 12;
    const yearlyPrice = SUBSCRIPTION_TIERS.premium.price.yearly;
    const savings = monthlyTotal - yearlyPrice;
    const percentage = Math.round((savings / monthlyTotal) * 100);
    return { percentage, amount: savings };
  }
}

export const stripeService = new StripeService();

// Export tier info for UI
export const FREE_TIER = SUBSCRIPTION_TIERS.free;
export const PREMIUM_TIER = SUBSCRIPTION_TIERS.premium;
