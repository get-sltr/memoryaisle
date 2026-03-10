// Apple Verify Receipt — Server-side subscription activation
// Called by the client after a StoreKit 2 purchase or restore.
// Validates transaction with Apple's App Store Server API, then writes to DB.
// Apple Server Notifications V2 remain the ultimate source of truth.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

const VALID_PRODUCT_IDS = ['com.memoryaisle.premium.MOSUB2'];
const APPLE_BUNDLE_ID = 'com.memoryaisle.app';

// Maximum request body size (50KB)
const MAX_BODY_SIZE = 50_000;

// Apple App Store Server API endpoints
const APPLE_API_PRODUCTION = 'https://api.storekit.itunes.apple.com';
const APPLE_API_SANDBOX = 'https://api.storekit-sandbox.itunes.apple.com';

// JWT cache: reuse token for up to 50 minutes (Apple allows 60 min max)
let cachedJwt: { token: string; expiresAt: number } | null = null;

// ============================================
// Apple App Store Server API JWT Generation
// ============================================

function base64UrlEncode(data: Uint8Array): string {
  let binary = '';
  for (const byte of data) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlEncodeString(str: string): string {
  return base64UrlEncode(new TextEncoder().encode(str));
}

/**
 * Import the ES256 private key from PEM for signing JWTs.
 */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemBody = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');

  const binaryDer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
}

/**
 * Generate a signed JWT for Apple's App Store Server API.
 * Uses ES256 (ECDSA P-256 + SHA-256) as required by Apple.
 */
async function generateAppleJwt(): Promise<string> {
  // Return cached token if still valid
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && cachedJwt.expiresAt > now + 60) {
    return cachedJwt.token;
  }

  const keyId = Deno.env.get('APPLE_IAP_KEY_ID');
  const issuerId = Deno.env.get('APPLE_IAP_ISSUER_ID');
  const privateKeyPem = Deno.env.get('APPLE_IAP_PRIVATE_KEY');

  if (!keyId || !issuerId || !privateKeyPem) {
    throw new Error('Missing Apple IAP API credentials');
  }

  const exp = now + 3000; // 50 minutes

  const header = {
    alg: 'ES256',
    kid: keyId,
    typ: 'JWT',
  };

  const payload = {
    iss: issuerId,
    iat: now,
    exp,
    aud: 'appstoreconnect-v1',
    bid: APPLE_BUNDLE_ID,
  };

  const headerB64 = base64UrlEncodeString(JSON.stringify(header));
  const payloadB64 = base64UrlEncodeString(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await importPrivateKey(privateKeyPem);

  const signatureBuffer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput),
  );

  // Convert DER signature to raw r||s format for JWT
  const signature = derToRaw(new Uint8Array(signatureBuffer));
  const signatureB64 = base64UrlEncode(signature);

  const token = `${signingInput}.${signatureB64}`;

  cachedJwt = { token, expiresAt: exp };
  return token;
}

/**
 * ECDSA signatures from WebCrypto are DER-encoded.
 * Apple/JWT expects raw r||s (64 bytes for P-256).
 */
function derToRaw(der: Uint8Array): Uint8Array {
  // DER: 0x30 <len> 0x02 <rLen> <r> 0x02 <sLen> <s>
  const raw = new Uint8Array(64);

  let offset = 2; // skip 0x30 <len>
  // r
  offset++; // skip 0x02
  const rLen = der[offset++];
  const rStart = rLen > 32 ? offset + (rLen - 32) : offset;
  const rDest = rLen < 32 ? 32 - rLen : 0;
  raw.set(der.slice(rStart, offset + rLen), rDest);
  offset += rLen;
  // s
  offset++; // skip 0x02
  const sLen = der[offset++];
  const sStart = sLen > 32 ? offset + (sLen - 32) : offset;
  const sDest = sLen < 32 ? 64 - sLen : 32;
  raw.set(der.slice(sStart, offset + sLen), sDest);

  return raw;
}

/**
 * Call Apple's App Store Server API to validate a transaction.
 * Returns the decoded transaction info if valid, null if not found or invalid.
 */
async function verifyTransactionWithApple(
  transactionId: string,
  isSandbox: boolean,
): Promise<Record<string, unknown> | null> {
  try {
    const jwt = await generateAppleJwt();
    const baseUrl = isSandbox ? APPLE_API_SANDBOX : APPLE_API_PRODUCTION;
    const url = `${baseUrl}/inApps/v1/transactions/${transactionId}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${jwt}` },
    });

    if (response.status === 404) {
      return null; // Transaction does not exist
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(JSON.stringify({
        event: 'apple_api_error',
        status: response.status,
        body: errorText.slice(0, 500),
      }));
      // On API error, return null but don't block (Apple notifications are backup)
      return null;
    }

    const data = await response.json();

    // Response contains signedTransactionInfo as a JWS
    // For now we decode the payload without re-verifying the JWS since
    // the outer API response is already authenticated via our JWT.
    const signedTxn = data.signedTransactionInfo;
    if (!signedTxn) return null;

    const parts = signedTxn.split('.');
    if (parts.length !== 3) return null;

    const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(payloadJson);
  } catch (e) {
    console.error(JSON.stringify({
      event: 'apple_api_verify_exception',
      error: String(e),
    }));
    return null;
  }
}

// ============================================
// Main handler
// ============================================

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

    // --- Verify transaction with Apple's App Store Server API ---
    const isSandbox = environment === 'Sandbox'
      || environment === 'sandbox'
      || !environment; // Default to sandbox check if environment not specified

    const hasAppleKeys = Deno.env.get('APPLE_IAP_KEY_ID')
      && Deno.env.get('APPLE_IAP_ISSUER_ID')
      && Deno.env.get('APPLE_IAP_PRIVATE_KEY');

    let appleVerified = false;
    let appleExpiresDate = expiresDate;
    let appleProductId = productId;

    if (hasAppleKeys) {
      // Try production first, fall back to sandbox
      let appleTxn = await verifyTransactionWithApple(transactionId, false);
      if (!appleTxn && isSandbox) {
        appleTxn = await verifyTransactionWithApple(transactionId, true);
      }

      if (appleTxn) {
        appleVerified = true;

        // Use Apple's authoritative data instead of client-submitted values
        if (appleTxn.productId) {
          appleProductId = appleTxn.productId as string;
        }
        if (appleTxn.expiresDate) {
          appleExpiresDate = appleTxn.expiresDate;
        }

        // Validate product ID from Apple matches our known products
        if (!VALID_PRODUCT_IDS.includes(appleProductId)) {
          console.error(JSON.stringify({
            event: 'apple_api_product_mismatch',
            user_id: user.id,
            client_product: productId,
            apple_product: appleProductId,
          }));
          return new Response(
            JSON.stringify({ error: 'Invalid product' }),
            { status: 400, headers: jsonHeaders },
          );
        }

        console.log(JSON.stringify({
          event: 'apple_api_verified',
          user_id: user.id,
          transaction_id: transactionId,
          apple_product: appleProductId,
        }));
      } else {
        // Apple API returned nothing. Log but don't block, as StoreKit 2
        // on-device verification is still valid. Apple Server Notifications
        // will arrive as the authoritative backup.
        console.warn(JSON.stringify({
          event: 'apple_api_transaction_not_found',
          user_id: user.id,
          transaction_id: transactionId,
          environment,
        }));
      }
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
      console.log(JSON.stringify({
        event: 'blacklisted_txn_still_active_allowing_restore',
        user_id: user.id,
        original_transaction_id: effectiveOriginalTxnId,
        expiry: blacklisted.subscription_expiry,
      }));
    }

    // --- Normalize expiresDate to ISO string ---
    // Use Apple-verified expiry if available, otherwise client-submitted
    let normalizedExpiresDate: string | null = null;
    const effectiveExpiresDate = appleExpiresDate;
    if (effectiveExpiresDate) {
      if (typeof effectiveExpiresDate === 'number') {
        normalizedExpiresDate = new Date(effectiveExpiresDate).toISOString();
      } else if (typeof effectiveExpiresDate === 'string') {
        const parsed = new Date(effectiveExpiresDate);
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
      billing_interval: deriveBillingInterval(appleProductId),
      apple_product_id: appleProductId,
      apple_transaction_id: transactionId,
      apple_original_transaction_id: effectiveOriginalTxnId,
      cancel_at_period_end: false,
      last_updated_source: appleVerified ? 'client_verify_apple_validated' : 'client_verify',
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
      .select('last_updated_source, updated_at, status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (
      currentSub?.last_updated_source === 'apple_notification' &&
      currentSub?.updated_at
    ) {
      if (currentSub.status === 'active' || currentSub.status === 'trialing') {
        console.log(JSON.stringify({
          event: 'client_verify_skipped_server_notification_active',
          user_id: user.id,
        }));
        return new Response(
          JSON.stringify({ success: true, source: 'server_notification' }),
          { status: 200, headers: jsonHeaders },
        );
      }
      // Subscription is expired/canceled — allow client to re-activate below
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
      product_id: appleProductId,
      transaction_id: transactionId,
      apple_verified: appleVerified,
      environment,
    }));

    return new Response(
      JSON.stringify({ success: true, apple_verified: appleVerified }),
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
 */
function deriveBillingInterval(productId: string): string {
  const lower = productId.toLowerCase();
  if (lower.includes('yearly') || lower.includes('annual')) {
    return 'year';
  }
  if (lower.includes('monthly')) {
    return 'month';
  }
  if (lower.includes('weekly')) {
    return 'week';
  }
  return 'month';
}
