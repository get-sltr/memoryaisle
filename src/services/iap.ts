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
const syncIOS = iapModule?.syncIOS ?? (async () => false);
const purchaseUpdatedListener =
  iapModule?.purchaseUpdatedListener ?? (() => ({ remove: () => {} }));
const purchaseErrorListener =
  iapModule?.purchaseErrorListener ?? (() => ({ remove: () => {} }));

const fetchProducts =
  iapModule?.fetchProducts ??
  (async (_args: any) => []);
const requestPurchase =
  iapModule?.requestPurchase ??
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

function isAlreadyOwnedCode(code: any) {
  return (
    code === ErrorCode.E_ALREADY_OWNED ||
    code === ErrorCode.E_ITEM_ALREADY_OWNED ||
    code === ErrorCode.ItemAlreadyPurchased ||
    code === "E_ALREADY_OWNED" ||
    code === "E_ITEM_ALREADY_OWNED"
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

function extractPurchaseFields(purchase: Purchase) {
  return {
    productId: purchase.productId ?? IAP_PRODUCTS.PREMIUM_MONTHLY,
    transactionId: purchase.transactionId ?? null,
    originalTransactionId:
      purchase.originalTransactionIdentifierIOS ??
      purchase.originalTransactionIdIOS ??
      purchase.transactionId ??
      null,
    expiresDate:
      purchase.expirationDateIOS ??
      purchase.expiresDateIOS ??
      purchase.expirationDate ??
      (purchase.transactionDate
        ? new Date(Number(purchase.transactionDate) + 30 * 24 * 60 * 60 * 1000).toISOString()
        : undefined),
    environment:
      purchase.environment ??
      (purchase.verificationResultIOS ? "Production" : undefined),
    autoRenewStatus: purchase.autoRenewingIOS ?? undefined,
  };
}

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
  // FIX: Storing timeout ID to clean it up safely
  private purchaseTimeoutId: NodeJS.Timeout | null = null;

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
      await delay(isIPad ? 500 : 200);

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

  private cleanupPurchaseState() {
    if (this.purchaseTimeoutId) {
      clearTimeout(this.purchaseTimeoutId);
      this.purchaseTimeoutId = null;
    }
    this.purchaseResolver = null;
    this.purchaseInFlight = false;
  }

  private setupGlobalTransactionObserver(): void {
    if (this.observerActive) return;

    this.removeTransactionListeners();

    this.purchaseUpdateSub = purchaseUpdatedListener(async (purchase: Purchase) => {
      // StoreKit 2 transactions are signed and verified on-device by the OS.
      // Resolve the purchase as successful IMMEDIATELY so the user isn't blocked.
      // Server verification runs in the background; Apple Server Notifications V2
      // remain the authoritative source of truth for subscription state.
      await safeFinishTransaction(purchase);

      if (this.purchaseResolver) {
        this.purchaseResolver({ status: "success" });
        this.cleanupPurchaseState();
      }

      this.notifyStatusChange();

      // Background server verification (fire-and-forget with retries)
      (async () => {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const ok = await verifyWithServer(purchase);
            if (ok) {
              logger.info("IAP: background verify succeeded", { attempt });
              return;
            }
          } catch (e: any) {
            logger.warn("IAP: background verify attempt failed", { attempt, message: e?.message });
          }
          await delay(2000 * attempt);
        }
        logger.warn("IAP: background verify failed after 3 attempts – Apple Server Notifications will reconcile");
      })();
    });

    this.purchaseErrorSub = purchaseErrorListener(async (err: PurchaseError) => {
      if (!this.purchaseResolver) return;

      const code = err?.code;
      if (isCancelCode(code)) {
        this.purchaseResolver({ status: "cancelled" });
        this.cleanupPurchaseState();
      } else if (isPendingCode(code)) {
        this.purchaseResolver({ status: "pending" });
        this.cleanupPurchaseState();
      } else if (isAlreadyOwnedCode(code)) {
        logger.info("IAP: Item already owned, attempting restore");
        const resolver = this.purchaseResolver;
        this.cleanupPurchaseState();
        try {
          const restored = await this.restorePurchases();
          resolver(restored
            ? { status: "success" }
            : { status: "error", message: "You already own this subscription. Please tap Restore Purchases." }
          );
        } catch {
          resolver({ status: "error", message: "You already own this subscription. Please tap Restore Purchases." });
        }
      } else {
        this.purchaseResolver({ status: "error", message: err?.message ?? "Purchase failed." });
        this.cleanupPurchaseState();
      }
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

        // FIX: Store timeout ID so we can clear it upon success/failure
        this.purchaseTimeoutId = setTimeout(() => {
          if (this.purchaseResolver === resolve) {
            this.cleanupPurchaseState();
            resolve({ status: "error", message: "Purchase timed out. Please try again." });
          }
        }, 120_000);
      });

      await requestPurchase({
        request: { apple: { sku: IAP_PRODUCTS.PREMIUM_MONTHLY } },
        type: "subs",
      });

      return resultPromise;
    } catch (e: any) {
      const code = e?.code;
      // FIX: Clean up state immediately if requestPurchase throws an error
      this.cleanupPurchaseState();

      if (isCancelCode(code)) return { status: "cancelled" };

      if (isAlreadyOwnedCode(code)) {
        logger.info("IAP: Item already owned (catch), attempting restore");
        try {
          const restored = await this.restorePurchases();
          return restored
            ? { status: "success" }
            : { status: "error", message: "You already own this subscription. Please tap Restore Purchases." };
        } catch {
          return { status: "error", message: "You already own this subscription. Please tap Restore Purchases." };
        }
      }

      logger.error("IAP: Purchase request failed", { message: e?.message, code });
      return { status: "error", message: "Could not start purchase. Please try again." };
    }
  }

  async restorePurchases(): Promise<boolean> {
    if (!(await this.safeInitialize(3))) return false;

    try {
      if (Platform.OS === "ios") {
        try { await syncIOS(); } catch {}
      }

      const purchases = await getAvailablePurchases();
      if (!purchases?.length) return false;

      // FIX: Sort purchases by date descending to ensure we verify the NEWEST receipt first
      const sortedPurchases = purchases.sort((a: any, b: any) => {
        return Number(b.transactionDate || 0) - Number(a.transactionDate || 0);
      });

      const subPurchase = sortedPurchases.find((p: any) => ALL_PREMIUM_PRODUCT_IDS.includes(p.productId));
      if (!subPurchase) {
        for (const p of purchases) await safeFinishTransaction(p);
        return false;
      }

      const verified = await verifyWithServer(subPurchase);

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

      // FIX: Added a 24-hour grace period to the client-side check. 
      // This prevents paying users from being locked out if Apple's webhook is slightly delayed.
      const gracePeriod = new Date();
      gracePeriod.setHours(gracePeriod.getHours() - 24);

      if (
        data.tier === "premium" &&
        (status === "active" || status === "trialing") &&
        data.current_period_end &&
        new Date(data.current_period_end) < gracePeriod
      ) {
        return { tier: "free", status: "none" };
      }

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
      const today = new Date().toLocaleDateString("en-CA");
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
      const today = new Date().toLocaleDateString("en-CA");
      const { data, error } = await supabase.rpc("increment_daily_usage", {
        p_user_id: userId,
        p_feature: fKey,
        p_date: today,
      });
      if (error) throw error;
      if (data === -1) return -1;
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

    this.cleanupPurchaseState();
  }
}

export const iapService = new IAPService();