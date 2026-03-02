// Apple Verify Receipt — Server-side subscription activation
// Called by the client after a StoreKit 2 purchase or restore.
// Writes subscription status to DB using service_role (bypasses RLS).
// Apple Server Notifications V2 remain the ultimate source of truth.
//
// NOTE ON SERVER-SIDE VERIFICATION:
// StoreKit 2 transactions are signed JWS verified on-device. For additional
// server-side verification, consider calling Apple's App Store Server API:
//   GET https://api.storekit.itunes.apple.com/inApps/v1/transactions/{transactionId}
// This requires an App Store Server API key configured in App Store Connect.
// The current implementation trusts client-submitted data as an initial write,
// with Apple Server Notifications V2 as the authoritative source of truth.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

const VALID_PRODUCT_IDS = ['com.memoryaisle.premium.yearly001', 'com.memoryaisle.premium.yearly'];

// Maximum request body size (50KB — more than enough for purchase data)
const MAX_BODY_SIZE = 50_000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

  try {
    // --- Authenticate the user via their JWT ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: jsonHeaders },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Use the user's JWT to identify them (anon client validates the JWT)
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: jsonHeaders },
      );
    }

    // --- Parse and validate request body ---
    const rawBody = await req.text();
    if (rawBody.length > MAX_BODY_SIZE) {
      return new Response(
        JSON.stringify({ error: 'Request body too large' }),
        { status: 413, headers: jsonHeaders },
      );
    }

    const body = JSON.parse(rawBody);
    const {
      productId,
      transactionId,
      originalTransactionId,
      expiresDate,
      environment,
      autoRenewStatus,
    } = body;

    if (!productId || !transactionId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: productId, transactionId' }),
        { status: 400, headers: jsonHeaders },
      );
    }

    // Validate product ID matches our known products
    if (!VALID_PRODUCT_IDS.includes(productId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid product ID' }),
        { status: 400, headers: jsonHeaders },
      );
    }

    // Use service_role to write subscription status (bypasses RLS)
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const effectiveOriginalTxnId = originalTransactionId || transactionId;

    // --- Check if this transaction already belongs to a different user ---
    const { data: existingOwner } = await serviceClient
      .from('subscriptions')
      .select('user_id')
      .eq('apple_original_transaction_id', effectiveOriginalTxnId)
      .not('user_id', 'eq', user.id)
      .maybeSingle();

    if (existingOwner) {
      console.error(JSON.stringify({
        event: 'transaction_ownership_conflict',
        requesting_user: user.id,
        existing_owner: existingOwner.user_id,
        original_transaction_id: effectiveOriginalTxnId,
      }));
      return new Response(
        JSON.stringify({ error: 'This subscription is associated with another account' }),
        { status: 409, headers: jsonHeaders },
      );
    }

    // --- Check if this transaction was blacklisted from a deleted account ---
    const { data: blacklisted } = await serviceClient
      .from('deleted_subscription_transactions')
      .select('subscription_expiry')
      .eq('original_transaction_id', effectiveOriginalTxnId)
      .maybeSingle();

    if (blacklisted) {
      const isExpired = !blacklisted.subscription_expiry
        || new Date(blacklisted.subscription_expiry) < new Date();

      if (isExpired) {
        // Subscription from deleted account is expired — block restore
        return new Response(
          JSON.stringify({ error: 'This subscription was associated with a deleted account' }),
          { status: 403, headers: jsonHeaders },
        );
      }

      // Still active (Apple requires honoring paid time) — allow restore.
      // Keep the blacklist record; it will be cleaned up when the subscription
      // expires via apple-server-notifications EXPIRED handler.
      console.log(JSON.stringify({
        event: 'blacklisted_txn_still_active_allowing_restore',
        user_id: user.id,
        original_transaction_id: effectiveOriginalTxnId,
        expiry: blacklisted.subscription_expiry,
      }));
    }

    // --- Normalize expiresDate to ISO string ---
    // StoreKit 2 sends millisecond timestamps; guard against other formats
    let normalizedExpiresDate: string | null = null;
    if (expiresDate) {
      if (typeof expiresDate === 'number') {
        // Apple uses millisecond timestamps
        normalizedExpiresDate = new Date(expiresDate).toISOString();
      } else if (typeof expiresDate === 'string') {
        // Already an ISO string or parseable date
        const parsed = new Date(expiresDate);
        if (!isNaN(parsed.getTime())) {
          normalizedExpiresDate = parsed.toISOString();
        }
      }
    }

    // --- Build subscription data ---
    const now = new Date().toISOString();

    const subscriptionData: Record<string, unknown> = {
      user_id: user.id,
      tier: 'premium',
      status: 'active',
      billing_interval: deriveBillingInterval(productId),
      apple_product_id: productId,
      apple_transaction_id: transactionId,
      apple_original_transaction_id: effectiveOriginalTxnId,
      cancel_at_period_end: false,
      last_updated_source: 'client_verify',
      updated_at: now,
    };

    if (normalizedExpiresDate) {
      subscriptionData.apple_expires_date = normalizedExpiresDate;
      subscriptionData.current_period_end = normalizedExpiresDate;
      subscriptionData.current_period_start = now;
    }

    if (environment) {
      subscriptionData.apple_environment = environment;
    }

    if (autoRenewStatus !== undefined) {
      subscriptionData.apple_auto_renew_status = autoRenewStatus;
    }

    // --- Upsert with source priority ---
    // If a server notification has already written this subscription,
    // don't overwrite with potentially less complete client data.
    const { data: currentSub } = await serviceClient
      .from('subscriptions')
      .select('last_updated_source, updated_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (currentSub?.last_updated_source === 'apple_notification') {
      // Server notification already processed — skip client overwrite
      // but ensure the user has premium access (the notification already set it)
      console.log(JSON.stringify({
        event: 'client_verify_skipped_server_notification_exists',
        user_id: user.id,
      }));
      return new Response(
        JSON.stringify({ success: true, source: 'server_notification' }),
        { status: 200, headers: jsonHeaders },
      );
    }

    const { error: upsertError } = await serviceClient
      .from('subscriptions')
      .upsert(subscriptionData, { onConflict: 'user_id' });

    if (upsertError) {
      console.error(JSON.stringify({
        event: 'subscription_upsert_failed',
        user_id: user.id,
        error: upsertError.message,
      }));
      return new Response(
        JSON.stringify({ error: 'Failed to activate subscription' }),
        { status: 500, headers: jsonHeaders },
      );
    }

    console.log(JSON.stringify({
      event: 'subscription_activated',
      user_id: user.id,
      product_id: productId,
      transaction_id: transactionId,
      environment,
    }));

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (error) {
    console.error(JSON.stringify({
      event: 'apple_verify_receipt_error',
      error: String(error),
    }));
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

// ============================================
// Helpers
// ============================================

/**
 * Derive billing interval from product ID.
 * Extend this when adding monthly or other plans.
 */
function deriveBillingInterval(productId: string): string {
  if (productId.includes('yearly') || productId.includes('annual')) {
    return 'year';
  }
  if (productId.includes('monthly')) {
    return 'month';
  }
  if (productId.includes('weekly')) {
    return 'week';
  }
  // Default to year for current single-product setup
  return 'year';
}