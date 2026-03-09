// src/services/iap.ts
import { Platform, Dimensions } from "react-native";
import { supabase } from "./supabase";
import { logger as iapLogger } from "../utils/logger";

const logger = iapLogger;

// Guard native module import — Expo Go / missing native module
let iapModule: any = null;
try {
  iapModule = require("react-native-iap");
} catch {
  logger.warn("react-native-iap not available (Expo Go). IAP disabled.");
}

type Purchase = any;
type PurchaseError = any;
type EventSubscription = { remove: () => void };

const initConnection = iapModule?.initConnection ?? (async () => false);
const endConnection = iapModule?.endConnection ?? (async () => {});
const finishTransaction = iapModule?.finishTransaction ?? (async () => {});
const getAvailablePurchases = iapModule?.getAvailablePurchases ?? (async () => []);
const restorePurchasesIOS = iapModule?.clearTransactionIOS ?? null;
const purchaseUpdatedListener =
  iapModule?.purchaseUpdatedListener ?? (() => ({ remove: () => {} }));
const purchaseErrorListener =
  iapModule?.purchaseErrorListener ?? (() => ({ remove: () => {} }));

const fetchProducts =
  iapModule?.fetchProducts ??
  iapModule?.getSubscriptions ??
  (async (_args: any) => []);
const requestPurchase =
  iapModule?.requestPurchase ??
  iapModule?.requestSubscription ??
  (async (_args: any) => {});

const ErrorCode = iapModule?.ErrorCode ?? {};

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const IAP_PRODUCTS = {
  PREMIUM_MONTHLY: "com.memoryaisle.premium.MOSUB2",
} as const;

const SUBSCRIPTION_SKUS = [IAP_PRODUCTS.PREMIUM_MONTHLY];

const ALL_PREMIUM_PRODUCT_IDS = [
  IAP_PRODUCTS.PREMIUM_MONTHLY,
];

export const SUBSCRIPTION_TIERS = {
  free: {
    id: "free",
    name: "Free",
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
    id: "premium",
    name: "Premium",
    price: { monthly: 9.99 },
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
export type BillingInterval = "month" | "year";

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  status: "active" | "canceled" | "past_due" | "trialing" | "expired" | "revoked" | "refunded" | "none";
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
  | { status: "success" }
  | { status: "cancelled" }
  | { status: "pending" }
  | { status: "error"; message: string };

type StatusChangeCallback = () => void;

function isCancelCode(code: any) {
  return (
    code === ErrorCode.E_USER_CANCELLED ||
    code === ErrorCode.UserCancelled ||
    code === "E_USER_CANCELLED" ||
    code === "USER_CANCELLED"
  );
}

function isPendingCode(code: any) {
  return (
    code === ErrorCode.E_DEFERRED_PAYMENT ||
    code === ErrorCode.DeferredPayment ||
    code === ErrorCode.E_PENDING ||
    code === ErrorCode.Pending ||
    code === "E_DEFERRED_PAYMENT" ||
    code === "E_PENDING"
  );
}

async function safeFinishTransaction(purchase: Purchase) {
  try {
    await finishTransaction({ purchase, isConsumable: false });
  } catch (e: any) {
    // Finish can fail if already finished; never crash.
    logger.warn("IAP: finishTransaction failed", { message: e?.message });
  }
}

/**
 * Extract StoreKit 2 fields from a purchase object.
 * react-native-iap versions differ in field names — this normalizes them.
 */
function extractPurchaseFields(purchase: Purchase) {
  return {
    productId: purchase.productId ?? IAP_PRODUCTS.PREMIUM_MONTHLY,
    transactionId: purchase.transactionId ?? null,
    originalTransactionId:
      purchase.originalTransactionIdentifierIOS ??
      purchase.originalTransactionIdIOS ??
      purchase.transactionId ??
      null,
    // StoreKit 2 expiration — try known field names from react-native-iap
    expiresDate:
      purchase.expirationDateIOS ??
      purchase.expiresDateIOS ??
      purchase.expirationDate ??
      // Fallback: if no expiry field, estimate 30 days from purchase date
      (purchase.transactionDate
        ? new Date(Number(purchase.transactionDate) + 30 * 24 * 60 * 60 * 1000).toISOString()
        : undefined),
    // react-native-iap may expose these on newer versions
    environment:
      purchase.environment ??
      (purchase.verificationResultIOS ? "Production" : undefined),
    autoRenewStatus: purchase.autoRenewingIOS ?? undefined,
  };
}

/**
 * Send purchase data to the apple-verify-receipt Edge Function.
 * The Edge Function validates, writes to subscriptions, and returns success/failure.
 * Apple Server Notifications V2 remain the ultimate source of truth.
 */
async function verifyWithServer(purchase: Purchase): Promise<boolean> {
  try {
    const fields = extractPurchaseFields(purchase);

    if (!fields.transactionId) {
      logger.error("IAP: No transactionId to verify");
      return false;
    }

    const { data, error } = await supabase.functions.invoke("apple-verify-receipt", {
      body: {
        productId: fields.productId,
        transactionId: fields.transactionId,
        originalTransactionId: fields.originalTransactionId,
        expiresDate: fields.expiresDate,
        environment: fields.environment,
        autoRenewStatus: fields.autoRenewStatus,
      },
    });

    if (error) {
      logger.error("IAP: verify edge error", {
        message: error.message,
        context: error.context,
      });
      return false;
    }

    return data?.success === true;
  } catch (e: any) {
    logger.error("IAP: verify exception", { message: e?.message });
    return false;
  }
}

class IAPService {
  private initialized = false;
  private initializing: Promise<boolean> | null = null;
  private hasConnectedBefore = false;

  private observerActive = false;
  private purchaseUpdateSub: EventSubscription | null = null;
  private purchaseErrorSub: EventSubscription | null = null;

  private purchaseInFlight = false;
  private purchaseResolver: ((result: PurchaseResult) => void) | null = null;

  private statusChangeListeners = new Set<StatusChangeCallback>();

  onStatusChange(callback: StatusChangeCallback): () => void {
    this.statusChangeListeners.add(callback);
    return () => this.statusChangeListeners.delete(callback);
  }

  private notifyStatusChange(): void {
    for (const cb of this.statusChangeListeners) {
      try {
        cb();
      } catch (e) {
        logger.error("IAP: status change listener error", { message: (e as any)?.message });
      }
    }
  }

  async initialize(): Promise<boolean> {
    if (!iapModule) return false;
    if (Platform.OS !== "ios") return false;
    if (this.initialized) return true;

    if (this.initializing) return this.initializing;
    this.initializing = this._doInitialize();
    try {
      return await this.initializing;
    } finally {
      this.initializing = null;
    }
  }

  private async _doInitialize(): Promise<boolean> {
    try {
      if (this.hasConnectedBefore) {
        try { await endConnection(); } catch {}
      }

      const isIPad = (Platform as any).isPad || Dimensions.get("window").width >= 768;
      await delay(isIPad ? 1500 : 300);

      await initConnection();
      this.initialized = true;
      this.hasConnectedBefore = true;

      this.setupGlobalTransactionObserver();

      logger.info("IAP: Connection initialized", { isIPad });
      return true;
    } catch (e: any) {
      logger.error("IAP: initConnection failed", { message: e?.message });
      this.initialized = false;
      return false;
    }
  }

  private async safeInitialize(retries = 3): Promise<boolean> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      if (await this.initialize()) return true;
      await delay(500 * attempt);
    }
    return false;
  }

  private async fetchProductsWithRetry(maxAttempts = 3): Promise<any[]> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const products = await fetchProducts({ skus: SUBSCRIPTION_SKUS, type: "subs" });
        if (products?.length) return products;
      } catch (e: any) {
        logger.warn("IAP: fetchProducts attempt failed", {
          attempt,
          message: e?.message,
        });
      }

      if (attempt < maxAttempts) {
        await delay(800 * attempt);
      }
    }
    return [];
  }

  private setupGlobalTransactionObserver(): void {
    if (this.observerActive) return;

    this.removeTransactionListeners();

    this.purchaseUpdateSub = purchaseUpdatedListener(async (purchase: Purchase) => {
      // StoreKit 2 transactions are signed and verified on-device by the OS.
      // Resolve the purchase as successful immediately so the user isn't blocked.
      // Server verification happens in the background — Apple Server Notifications
      // V2 remain the authoritative source of truth for subscription state.
      if (this.purchaseResolver) {
        this.purchaseResolver({ status: "success" });
        this.purchaseResolver = null;
        this.purchaseInFlight = false;
      }

      this.notifyStatusChange();

      // Background: finish the transaction and verify with server (best-effort)
      try {
        await verifyWithServer(purchase);
      } catch (e: any) {
        logger.warn("IAP: background verify failed (non-blocking)", { message: e?.message });
      } finally {
        await safeFinishTransaction(purchase);
      }
    });

    this.purchaseErrorSub = purchaseErrorListener((err: PurchaseError) => {
      if (!this.purchaseResolver) return;

      const code = err?.code;
      if (isCancelCode(code)) {
        this.purchaseResolver({ status: "cancelled" });
      } else if (isPendingCode(code)) {
        this.purchaseResolver({ status: "pending" });
      } else {
        this.purchaseResolver({ status: "error", message: err?.message ?? "Purchase failed." });
      }

      this.purchaseResolver = null;
      this.purchaseInFlight = false;
    });

    this.observerActive = true;
  }

  async setup(): Promise<void> {
    await this.safeInitialize(2);
  }

  async getSubscriptionProduct(): Promise<IAPProduct | null> {
    if (!(await this.safeInitialize(3))) return null;

    try {
      const products = await this.fetchProductsWithRetry(3);
      if (!products?.length) {
        logger.warn("IAP: No products returned for SKUs", {
          skus: SUBSCRIPTION_SKUS,
        });
        return null;
      }

      const p = products[0];
      return {
        productId: p.id ?? p.productId ?? IAP_PRODUCTS.PREMIUM_MONTHLY,
        title: p.title ?? "",
        description: p.description ?? "",
        localizedPrice: p.displayPrice ?? p.localizedPrice ?? "",
        price: String(p.price ?? ""),
        currency: p.currency ?? "",
      };
    } catch (e: any) {
      logger.error("IAP: getSubscriptionProduct failed", { message: e?.message });
      return null;
    }
  }

  async purchaseSubscription(): Promise<PurchaseResult> {
    if (!(await this.safeInitialize(3))) {
      return { status: "error", message: "Could not connect to the App Store. Please check your internet connection and try again." };
    }
    if (!this.observerActive) this.setupGlobalTransactionObserver();

    if (this.purchaseInFlight) {
      return { status: "error", message: "A purchase is already in progress." };
    }

    try {
      const products = await this.fetchProductsWithRetry(4);
      if (!products?.length) {
        logger.error("IAP: No products found after retries", {
          skus: SUBSCRIPTION_SKUS,
        });
        return {
          status: "error",
          message: "Unable to load subscription. Please close the app completely and try again.",
        };
      }

      this.purchaseInFlight = true;

      const resultPromise = new Promise<PurchaseResult>((resolve) => {
        this.purchaseResolver = resolve;

        setTimeout(() => {
          if (this.purchaseResolver === resolve) {
            this.purchaseResolver = null;
            this.purchaseInFlight = false;
            resolve({ status: "error", message: "Purchase timed out. Please try again." });
          }
        }, 120_000);
      });

      await requestPurchase({
        request: {
          apple: { sku: IAP_PRODUCTS.PREMIUM_MONTHLY },
        },
        type: "subs",
      });

      return resultPromise;
    } catch (e: any) {
      const code = e?.code;
      this.purchaseResolver = null;
      this.purchaseInFlight = false;

      if (isCancelCode(code)) return { status: "cancelled" };

      logger.error("IAP: Purchase request failed", { message: e?.message, code });
      return { status: "error", message: "Could not start purchase. Please try again." };
    }
  }

  async restorePurchases(): Promise<boolean> {
    if (!(await this.safeInitialize(3))) return false;

    try {
      // Some versions need an explicit restore call on iOS
      if (restorePurchasesIOS) {
        try { await restorePurchasesIOS(); } catch {}
      }

      const purchases = await getAvailablePurchases();
      if (!purchases?.length) return false;

      const subPurchase = purchases.find((p: any) => ALL_PREMIUM_PRODUCT_IDS.includes(p.productId));
      if (!subPurchase) {
        // still finish any dangling transactions
        for (const p of purchases) await safeFinishTransaction(p);
        return false;
      }

      const verified = await verifyWithServer(subPurchase);

      // Always finish transactions best effort
      for (const p of purchases) await safeFinishTransaction(p);

      if (verified) this.notifyStatusChange();
      return verified;
    } catch (e: any) {
      logger.error("IAP: restorePurchases failed", { message: e?.message });
      return false;
    }
  }

  async getSubscription(userId: string): Promise<SubscriptionInfo> {
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error || !data) return { tier: "free", status: "none" };

      const status = data.status || "none";

      // Client-side expiry sanity check (server should already handle this via notifications)
      if (
        data.tier === "premium" &&
        (status === "active" || status === "trialing") &&
        data.current_period_end &&
        new Date(data.current_period_end) < new Date()
      ) {
        return { tier: "free", status: "none" };
      }

      // Map revoked/refunded/expired to "none" tier on client side
      const effectiveTier: SubscriptionTier =
        (status === "revoked" || status === "refunded" || status === "expired")
          ? "free"
          : (data.tier || "free") as SubscriptionTier;

      return {
        tier: effectiveTier,
        status,
        billingInterval: data.billing_interval,
        currentPeriodEnd: data.current_period_end,
        cancelAtPeriodEnd: data.cancel_at_period_end,
        productId: data.apple_product_id,
        transactionId: data.apple_transaction_id,
      };
    } catch (e: any) {
      logger.error("IAP: getSubscription fetch failed", { message: e?.message });
      return { tier: "free", status: "none" };
    }
  }

  canAccessFeature(subscription: SubscriptionInfo, feature: FeatureKey): boolean {
    const isActive = subscription.status === "active" || subscription.status === "trialing";
    const tier = isActive ? subscription.tier : "free";
    const val = SUBSCRIPTION_TIERS[tier].features[feature];

    if (typeof val === "boolean") return val;
    if (typeof val === "number") return val === -1 || val > 0;
    return false;
  }

  getFeatureLimit(subscription: SubscriptionInfo, feature: FeatureKey): number {
    const isActive = subscription.status === "active" || subscription.status === "trialing";
    const tier = isActive ? subscription.tier : "free";
    const val = SUBSCRIPTION_TIERS[tier].features[feature];
    return typeof val === "number" ? val : val ? -1 : 0;
  }

  isPremium(subscription: SubscriptionInfo): boolean {
    return (
      subscription.tier === "premium" &&
      (subscription.status === "active" || subscription.status === "trialing")
    );
  }

  async getRemainingQuota(
    userId: string,
    subscription: SubscriptionInfo,
    feature: "miraQueriesPerDay" | "recipesPerDay"
  ) {
    const limit = this.getFeatureLimit(subscription, feature);
    if (limit === -1) return { used: 0, limit: -1, remaining: -1, unlimited: true };

    try {
      const fKey = feature === "miraQueriesPerDay" ? "mira_queries" : "recipes";
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("usage_tracking")
        .select("count")
        .eq("user_id", userId)
        .eq("feature", fKey)
        .eq("date", today)
        .single();

      const used = data?.count || 0;
      return { used, limit, remaining: Math.max(0, limit - used), unlimited: false };
    } catch {
      return { used: 0, limit, remaining: limit, unlimited: false };
    }
  }

  async incrementUsage(
    userId: string,
    feature: "miraQueriesPerDay" | "recipesPerDay"
  ): Promise<number> {
    try {
      const fKey = feature === "miraQueriesPerDay" ? "mira_queries" : "recipes";
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase.rpc("increment_daily_usage", {
        p_user_id: userId,
        p_feature: fKey,
        p_date: today,
      });
      if (error) throw error;
      return data || 1;
    } catch (e: any) {
      logger.error("IAP: incrementUsage failed", { message: e?.message });
      return 0;
    }
  }

  async disconnect(): Promise<void> {
    this.removeTransactionListeners();
    this.statusChangeListeners.clear();

    if (this.initialized) {
      try { await endConnection(); } catch {}
      this.initialized = false;
      this.hasConnectedBefore = false;
    }
  }

  private removeTransactionListeners(): void {
    try { this.purchaseUpdateSub?.remove(); } catch {}
    try { this.purchaseErrorSub?.remove(); } catch {}
    this.purchaseUpdateSub = null;
    this.purchaseErrorSub = null;
    this.observerActive = false;

    // also clear in-flight resolver to avoid dangling state on sign-out
    this.purchaseResolver = null;
    this.purchaseInFlight = false;
  }
}

export const iapService = new IAPService();