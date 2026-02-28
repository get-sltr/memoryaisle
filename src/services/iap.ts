// src/services/iap.ts
import { Platform, AppState, Dimensions } from 'react-native';
import { logger as iapLogger } from '../utils/logger';

// Guard native module import — crashes in Expo Go where NitroModules aren't available
let iapModule: any = null;
try {
  iapModule = require('react-native-iap');
} catch {
  iapLogger.warn('react-native-iap not available (Expo Go). IAP disabled.');
}

const initConnection = iapModule?.initConnection ?? (async () => {});
const endConnection = iapModule?.endConnection ?? (async () => {});
const fetchProducts = iapModule?.fetchProducts ?? (async () => []);
const requestPurchase = iapModule?.requestPurchase ?? (async () => {});
const getAvailablePurchases = iapModule?.getAvailablePurchases ?? (async () => []);
const finishTransaction = iapModule?.finishTransaction ?? (async () => {});
const purchaseUpdatedListener = iapModule?.purchaseUpdatedListener ?? (() => ({ remove: () => {} }));
const purchaseErrorListener = iapModule?.purchaseErrorListener ?? (() => ({ remove: () => {} }));
const ErrorCode = iapModule?.ErrorCode ?? {};

type Purchase = any;
type PurchaseError = any;
type EventSubscription = { remove: () => void };
import { supabase } from './supabase';
const logger = iapLogger;

export const IAP_PRODUCTS = {
  PREMIUM_YEARLY: 'com.memoryaisle.premium.yearly',
} as const;

const SUBSCRIPTION_SKUS = [IAP_PRODUCTS.PREMIUM_YEARLY];

export const SUBSCRIPTION_TIERS = {
  free: {
    id: 'free',
    name: 'Free',
    price: { monthly: 0, yearly: 0 },
    features: {
      maxLists: 2, maxItemsPerList: 50, miraQueriesPerDay: 10, recipesPerDay: 3,
      mealPlans: false, familyMembers: 1, voiceCommands: true, receiptScanning: false,
      tripPlanning: false, traditions: 2, favorites: 10, storeGeofencing: 1,
      smartCalendar: false, prioritySupport: false,
    },
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    price: { monthly: 9.99, yearly: 49.99 },
    features: {
      maxLists: -1, maxItemsPerList: -1, miraQueriesPerDay: -1, recipesPerDay: -1,
      mealPlans: true, familyMembers: 7, voiceCommands: true, receiptScanning: true,
      tripPlanning: true, traditions: -1, favorites: -1, storeGeofencing: -1,
      smartCalendar: true, prioritySupport: true,
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

export type PurchaseResult =
  | { status: 'success' }
  | { status: 'cancelled' }
  | { status: 'pending' }
  | { status: 'error'; message: string };

type StatusChangeCallback = () => void;
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

class IAPService {
  private initialized = false;
  private initializing: Promise<boolean> | null = null;
  private observerActive = false;
  private purchaseUpdateSub: EventSubscription | null = null;
  private purchaseErrorSub: EventSubscription | null = null;
  private purchaseResolver: ((result: PurchaseResult) => void) | null = null;
  private statusChangeListeners = new Set<StatusChangeCallback>();

  onStatusChange(callback: StatusChangeCallback): () => void {
    this.statusChangeListeners.add(callback);
    return () => this.statusChangeListeners.delete(callback);
  }

  private notifyStatusChange(): void {
    for (const cb of this.statusChangeListeners) {
      try { cb(); } catch (error) { logger.error('IAP: status change listener error', error); }
    }
  }

  /** Initialize IAP safely */
  async initialize(): Promise<boolean> {
    if (this.initialized) return true;
    if (Platform.OS !== 'ios') return false;

    if (!AppState.currentState) {
      logger.warn('IAP: native bridge not ready, deferring initialization');
      return false;
    }

    if (this.initializing) return this.initializing;
    this.initializing = this._doInitialize();
    try { return await this.initializing; } finally { this.initializing = null; }
  }

  /** Internal init with M-series delay */
  private async _doInitialize(): Promise<boolean> {
    try {
      try { await endConnection(); } catch {}
      const isIPad = (Platform as any).isPad || Dimensions.get('window').width >= 768;
      await delay(isIPad ? 4000 : 500); // Safe M-series delay
      await initConnection();
      this.initialized = true;
      logger.info('IAP: Connection initialized', { isIPad });
      return true;
    } catch (error) {
      logger.error('IAP: initConnection failed', error);
      this.initialized = false;
      return false;
    }
  }

  private async safeInitialize(retries = 2): Promise<boolean> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      if (await this.initialize()) return true;
      if (attempt < retries) {
        this.initialized = false;
        await delay(500 * attempt);
      }
    }
    return false;
  }

  /** Sets up observers for StoreKit */
  private setupGlobalTransactionObserver(): void {
    if (this.observerActive) return;
    this.removeTransactionListeners();

    this.purchaseUpdateSub = purchaseUpdatedListener(async (purchase: Purchase) => {
      let activated = false;
      try { activated = await this.activateSubscription(purchase); } catch (e) {
        logger.error('IAP: activateSubscription failed after purchase', e);
      }

      if (activated) {
        try { await finishTransaction({ purchase, isConsumable: false }); } catch (e) {
          logger.error('IAP: finishTransaction failed', e);
        }
      }

      if (this.purchaseResolver) {
        this.purchaseResolver(activated ? { status: 'success' } : {
          status: 'error',
          message: 'Server verification failed. Please try Restore Purchases.'
        });
        this.purchaseResolver = null;
      }

      if (activated) this.notifyStatusChange();
    });

    this.purchaseErrorSub = purchaseErrorListener((error: PurchaseError) => {
      if (!this.purchaseResolver) return;
      switch (error.code) {
        case ErrorCode.UserCancelled:
          this.purchaseResolver({ status: 'cancelled' });
          break;
        case ErrorCode.DeferredPayment:
        case ErrorCode.Pending:
          this.purchaseResolver({ status: 'pending' });
          break;
        default:
          this.purchaseResolver({ status: 'error', message: error.message });
      }
      this.purchaseResolver = null;
    });

    this.observerActive = true;
  }

  /** Backend subscription activation */
  private async activateSubscription(purchase: Purchase): Promise<boolean> {
    const transactionId = purchase.transactionId;
    if (!transactionId) return false;

    try {
      const expirationDate = (purchase as any).expirationDateIOS
        ? new Date(Number((purchase as any).expirationDateIOS)).toISOString()
        : null;
      const { error } = await supabase.functions.invoke('apple-verify-receipt', {
        body: {
          productId: purchase.productId,
          transactionId,
          originalTransactionId: (purchase as any).originalTransactionIdentifierIOS || transactionId,
          expiresDate: expirationDate,
          environment: (purchase as any).environmentIOS || null,
          autoRenewStatus: (purchase as any).autoRenewingIOS ?? true,
        },
      });
      if (error) logger.error('IAP: Verification Edge Function returned error', error);
      return !error;
    } catch (err) {
      logger.error('IAP: Exception thrown during activateSubscription:', err);
      return false;
    }
  }

  /** Setup on app cold start — only initializes connection + observer.
   *  Does NOT auto-activate from device receipts, because StoreKit
   *  returns receipts tied to the Apple ID, not the app account.
   *  Activation only happens from explicit purchase or Restore Purchases. */
  async setup(): Promise<void> {
    if (!(await this.safeInitialize(2))) return;
    this.setupGlobalTransactionObserver();
  }

  async getSubscriptionProduct(): Promise<IAPProduct | null> {
    if (!(await this.safeInitialize(2))) return null;
    try {
      let products = await fetchProducts({ skus: SUBSCRIPTION_SKUS, type: 'subs' });
      if (!products || products.length === 0) return null;
      const p = products[0];
      return { productId: p.id, title: p.title, description: p.description, localizedPrice: p.displayPrice, price: String(p.price ?? ''), currency: p.currency };
    } catch (error) {
      logger.error('IAP: getSubscriptionProduct failed', error);
      return null;
    }
  }

  async purchaseSubscription(): Promise<PurchaseResult> {
    if (!this.initialized && !(await this.safeInitialize(2))) return { status: 'error', message: 'Could not connect to the App Store.' };
    if (!this.observerActive) this.setupGlobalTransactionObserver();

    try {
      const products = await fetchProducts({ skus: SUBSCRIPTION_SKUS, type: 'subs' });
      if (!products || products.length === 0) return { status: 'error', message: 'Subscription product not available. Please try again.' };

      const resultPromise = new Promise<PurchaseResult>((resolve) => {
        this.purchaseResolver = resolve;
        setTimeout(() => {
          if (this.purchaseResolver === resolve) {
            this.purchaseResolver = null;
            resolve({ status: 'error', message: 'Purchase timed out.' });
          }
        }, 120_000);
      });

      await requestPurchase({
        request: Platform.OS === 'ios'
          ? { apple: { sku: IAP_PRODUCTS.PREMIUM_YEARLY } }
          : { google: { skus: [IAP_PRODUCTS.PREMIUM_YEARLY] } },
        type: 'subs',
      });
      return resultPromise;
    } catch (error: any) {
      this.purchaseResolver = null;
      if (error?.code === ErrorCode.UserCancelled) return { status: 'cancelled' };
      logger.error('IAP: Purchase request failed', error);
      return { status: 'error', message: 'Could not start purchase.' };
    }
  }

  async restorePurchases(): Promise<boolean> {
    if (!this.initialized && !(await this.safeInitialize(2))) return false;
    try {
      const purchases = await getAvailablePurchases();
      const subPurchase = purchases?.find((p: any) => p.productId === IAP_PRODUCTS.PREMIUM_YEARLY);
      if (!subPurchase) return false;

      const activated = await this.activateSubscription(subPurchase);
      for (const p of purchases) {
        try { await finishTransaction({ purchase: p, isConsumable: false }); } catch {}
      }
      if (activated) this.notifyStatusChange();
      return activated;
    } catch (error) {
      logger.error('IAP: restorePurchases failed', error);
      return false;
    }
  }

  async getSubscription(userId: string): Promise<SubscriptionInfo> {
    try {
      const { data, error } = await supabase.from('subscriptions').select('*').eq('user_id', userId).single();
      if (error || !data) return { tier: 'free', status: 'none' };
      if (data.tier === 'premium' && (data.status === 'active' || data.status === 'trialing') && data.current_period_end) {
        if (new Date(data.current_period_end) < new Date()) return { tier: 'free', status: 'none' };
      }
      return { 
        tier: (data.tier || 'free') as SubscriptionTier, 
        status: data.status || 'none', 
        billingInterval: data.billing_interval, 
        currentPeriodEnd: data.current_period_end, 
        cancelAtPeriodEnd: data.cancel_at_period_end, 
        productId: data.apple_product_id, 
        transactionId: data.apple_transaction_id 
      };
    } catch (error) {
      logger.error('IAP: getSubscription fetch failed', error);
      return { tier: 'free', status: 'none' };
    }
  }

  canAccessFeature(subscription: SubscriptionInfo, feature: FeatureKey): boolean {
    const isActive = subscription.status === 'active' || subscription.status === 'trialing';
    const tier = isActive ? subscription.tier : 'free';
    const val = SUBSCRIPTION_TIERS[tier].features[feature];
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val === -1 || val > 0;
    return false;
  }

  getFeatureLimit(subscription: SubscriptionInfo, feature: FeatureKey): number {
    const isActive = subscription.status === 'active' || subscription.status === 'trialing';
    const tier = isActive ? subscription.tier : 'free';
    const val = SUBSCRIPTION_TIERS[tier].features[feature];
    return typeof val === 'number' ? val : val ? -1 : 0;
  }

  isPremium(subscription: SubscriptionInfo): boolean {
    return subscription.tier === 'premium' && (subscription.status === 'active' || subscription.status === 'trialing');
  }

  async getRemainingQuota(userId: string, subscription: SubscriptionInfo, feature: 'miraQueriesPerDay' | 'recipesPerDay') {
    const limit = this.getFeatureLimit(subscription, feature);
    if (limit === -1) return { used: 0, limit: -1, remaining: -1, unlimited: true };
    try {
      const fKey = feature === 'miraQueriesPerDay' ? 'mira_queries' : 'recipes';
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase.from('usage_tracking').select('count').eq('user_id', userId).eq('feature', fKey).eq('date', today).single();
      const used = data?.count || 0;
      return { used, limit, remaining: Math.max(0, limit - used), unlimited: false };
    } catch { return { used: 0, limit, remaining: limit, unlimited: false }; }
  }

  async incrementUsage(userId: string, feature: 'miraQueriesPerDay' | 'recipesPerDay'): Promise<number> {
    try {
      const fKey = feature === 'miraQueriesPerDay' ? 'mira_queries' : 'recipes';
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase.rpc('increment_daily_usage', { p_user_id: userId, p_feature: fKey, p_date: today });
      if (error) throw error;
      return data || 1;
    } catch (error) { 
      logger.error('IAP: incrementUsage failed', error);
      return 0; 
    }
  }

  async disconnect(): Promise<void> {
    this.removeTransactionListeners();
    this.statusChangeListeners.clear();
    if (this.initialized) {
      try { await endConnection(); } catch {}
      this.initialized = false;
    }
  }

  private removeTransactionListeners(): void {
    this.purchaseUpdateSub?.remove();
    this.purchaseErrorSub?.remove();
    this.purchaseUpdateSub = null;
    this.purchaseErrorSub = null;
    this.observerActive = false;
  }
}

export const iapService = new IAPService();