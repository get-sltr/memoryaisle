// Apple Verify Receipt — Server-side subscription activation
// Called by the client after a StoreKit 2 purchase or restore.
// Writes subscription status to DB using service_role (bypasses RLS).
// Apple Server Notifications V2 remain the ultimate source of truth.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Verify the user is authenticated via their JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
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
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Parse the purchase data from the client
    const body = await req.json();
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
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Validate product ID matches our known product
    const VALID_PRODUCT_IDS = ['com.memoryaisle.app.premium.yearly'];
    if (!VALID_PRODUCT_IDS.includes(productId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid product ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Use service_role to write subscription status (bypasses RLS)
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if this transaction was blacklisted from a deleted account
    const txnIdToCheck = originalTransactionId || transactionId;
    const { data: blacklisted } = await serviceClient
      .from('deleted_subscription_transactions')
      .select('subscription_expiry')
      .eq('original_transaction_id', txnIdToCheck)
      .maybeSingle();

    if (blacklisted) {
      const isExpired = !blacklisted.subscription_expiry
        || new Date(blacklisted.subscription_expiry) < new Date();

      if (isExpired) {
        // Subscription from a deleted account and it's expired — block restore
        return new Response(
          JSON.stringify({ error: 'This subscription was associated with a deleted account' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Still active (Apple requires honoring paid time) — allow and remove from blacklist
      await serviceClient
        .from('deleted_subscription_transactions')
        .delete()
        .eq('original_transaction_id', txnIdToCheck);
    }

    const subscriptionData: Record<string, unknown> = {
      user_id: user.id,
      tier: 'premium',
      status: 'active',
      billing_interval: 'year',
      apple_product_id: productId,
      apple_transaction_id: transactionId,
      apple_original_transaction_id: originalTransactionId || transactionId,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    };

    if (expiresDate) {
      subscriptionData.apple_expires_date = expiresDate;
      subscriptionData.current_period_end = expiresDate;
    }

    if (environment) {
      subscriptionData.apple_environment = environment;
    }

    if (autoRenewStatus !== undefined) {
      subscriptionData.apple_auto_renew_status = autoRenewStatus;
    }

    const { error: upsertError } = await serviceClient
      .from('subscriptions')
      .upsert(subscriptionData, { onConflict: 'user_id' });

    if (upsertError) {
      console.error('Subscription upsert error:', upsertError);
      return new Response(
        JSON.stringify({ error: 'Failed to activate subscription' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('apple-verify-receipt error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
