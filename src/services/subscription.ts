import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  getAvailablePurchases,
  purchaseUpdatedListener,
  purchaseErrorListener,
  ErrorCode,
  type Purchase,
  type ProductOrSubscription,
} from 'react-native-iap';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { PRODUCT_ID } from '../constants/subscription';

const productIds = [PRODUCT_ID];

// Initialize IAP connection
export async function initIAP(): Promise<boolean> {
  try {
    await initConnection();
    console.log('IAP connection initialized');
    return true;
  } catch (error) {
    console.error('IAP init error:', error);
    return false;
  }
}

// Cleanup IAP connection
export async function endIAP(): Promise<void> {
  try {
    await endConnection();
    console.log('IAP connection ended');
  } catch (error) {
    console.error('IAP end error:', error);
  }
}

// Fetch product details from StoreKit (real price, title, duration)
export async function getProduct(): Promise<ProductOrSubscription | null> {
  try {
    const products = await fetchProducts({ skus: productIds, type: 'subs' });
    if (products && products.length > 0) {
      console.log('Product fetched:', products[0].title, products[0].displayPrice);
      return products[0];
    }
    console.warn('No products found for IDs:', productIds);
    return null;
  } catch (error) {
    console.error('Get product error:', error);
    return null;
  }
}

// Request purchase → get transaction → send to Edge Function for validation
export async function purchaseSubscription(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const purchase = await requestPurchase({
      request: {
        apple: { sku: PRODUCT_ID },
      },
      type: 'subs',
    });

    if (!purchase) {
      return { success: false, error: 'Purchase cancelled' };
    }

    // purchase may be a single Purchase or array
    const p = Array.isArray(purchase) ? purchase[0] : purchase;
    if (!p) {
      return { success: false, error: 'Purchase cancelled' };
    }

    // Validate receipt server-side
    const validated = await validateReceipt(p);
    return validated;
  } catch (error: any) {
    console.error('Purchase error:', error);
    if (error.code === ErrorCode.UserCancelled) {
      return { success: false, error: 'Purchase cancelled' };
    }
    return { success: false, error: error.message || 'Purchase failed' };
  }
}

// Validate receipt with Edge Function
async function validateReceipt(
  purchase: Purchase
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const transactionId = purchase.transactionId || purchase.id;

    const { data, error } = await supabase.functions.invoke('validate-receipt', {
      body: {
        transactionId,
        productId: PRODUCT_ID,
        platform: Platform.OS as 'ios' | 'android',
      },
    });

    if (error) {
      console.error('Validate receipt error:', error);
      return { success: false, error: 'Validation failed' };
    }

    return { success: data?.success ?? false, error: data?.error };
  } catch (error: any) {
    console.error('Receipt validation error:', error);
    return { success: false, error: error.message };
  }
}

// Restore previous purchases, validate each with Edge Function
export async function restorePurchases(): Promise<{
  success: boolean;
  restored: boolean;
  error?: string;
}> {
  try {
    const purchases = await getAvailablePurchases();

    if (!purchases || purchases.length === 0) {
      return { success: true, restored: false };
    }

    // Find our subscription among restored purchases
    const ourPurchase = purchases.find(
      (p) => p.productId === PRODUCT_ID
    );

    if (!ourPurchase) {
      return { success: true, restored: false };
    }

    // Validate the restored purchase
    const validated = await validateReceipt(ourPurchase);
    return {
      success: validated.success,
      restored: validated.success,
      error: validated.error,
    };
  } catch (error: any) {
    console.error('Restore purchases error:', error);
    return { success: false, restored: false, error: error.message };
  }
}

// Read subscription status from Supabase (server-authoritative)
export async function getSubscriptionStatus(): Promise<{
  isPremium: boolean;
  expiresAt: string | null;
  status: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { isPremium: false, expiresAt: null, status: 'inactive' };
    }

    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('status, expires_at')
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return { isPremium: false, expiresAt: null, status: 'inactive' };
    }

    const isPremium = data.status === 'active' || data.status === 'grace_period';
    return {
      isPremium,
      expiresAt: data.expires_at,
      status: data.status,
    };
  } catch (error) {
    console.error('Get subscription status error:', error);
    return { isPremium: false, expiresAt: null, status: 'inactive' };
  }
}

// Setup purchase listeners (call in root layout)
export function setupPurchaseListeners(
  onPurchaseSuccess: () => void,
  onPurchaseError: (error: string) => void
): () => void {
  const updateSubscription = purchaseUpdatedListener(async (purchase) => {
    console.log('Purchase updated:', purchase.productId);
    const result = await validateReceipt(purchase);
    if (result.success) {
      onPurchaseSuccess();
    } else {
      onPurchaseError(result.error || 'Validation failed');
    }
  });

  const errorSubscription = purchaseErrorListener((error) => {
    console.error('Purchase error:', error);
    if (error.code !== ErrorCode.UserCancelled) {
      onPurchaseError(error.message || 'Purchase failed');
    }
  });

  return () => {
    updateSubscription.remove();
    errorSubscription.remove();
  };
}
