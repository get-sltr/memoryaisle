import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';
import {

// Apple Server Notifications V2 Handler
// Receives signed JWS notifications from Apple about subscription lifecycle events.
// Updates subscription status server-side and logs every notification for audit.
//
// Configure this URL in App Store Connect -> App -> App Store Server Notifications:
//   Production: https://<project-ref>.supabase.co/functions/v1/apple-server-notifications
//   Sandbox:    (same URL — we handle both environments)
//
// IMPORTANT: This endpoint does NOT verify JWT (verify_jwt = false in config)
// because Apple sends unsigned HTTP POST requests — we validate the JWS payload
// cryptographically using Apple's x5c certificate chain instead.

  verifyAndDecodeAppleJws,
  decodeJwsPayloadUnsafe,
  AppleJwsError,
} from '../_shared/apple-jws.ts';

// ============================================
// Constants
// ============================================

const PREMIUM_PRODUCT_IDS = ['com.memoryaisle.premium.monthly001', 'com.memoryaisle.premium.yearly001', 'com.memoryaisle.premium.yearly'];

// Maximum age for a notification's signedDate before we reject it as stale.
// Apple retries over 24h, so we accept up to 48h to avoid missing legitimate retries.
// The idempotency check (notification UUID) prevents true duplicates.
const MAX_NOTIFICATION_AGE_MS = 48 * 60 * 60 * 1000;

serve(async (req) => {
  // Apple sends POST only
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const appleBundleId = Deno.env.get('APPLE_BUNDLE_ID') || 'com.memoryaisle.app';

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return new Response('Invalid request body', { status: 400 });
  }

  // Guard against oversized payloads (Apple notifications are typically <10KB)
  if (rawBody.length > 100_000) {
    console.error(JSON.stringify({ event: 'payload_too_large', size: rawBody.length }));
    return new Response('Payload too large', { status: 413 });
  }

  let body: { signedPayload?: string };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (!body.signedPayload) {
    return new Response('Missing signedPayload', { status: 400 });
  }

  try {
    // --- Verify and decode the outer notification JWS ---
    // Cryptographically validates Apple's x5c certificate chain
    // and verifies the signature against the leaf certificate.
    let notification: Record<string, unknown>;
    try {
      notification = await verifyAndDecodeAppleJws(body.signedPayload);
    } catch (error) {
      if (error instanceof AppleJwsError) {
        console.error(JSON.stringify({
          event: 'jws_verification_failed',
          error: error.message,
        }));
        // 403 for forged/invalid signatures — don't let Apple retry
        return new Response(
          JSON.stringify({ error: 'JWS verification failed' }),
          { status: 403 },
        );
      }
      throw error;
    }

    const notificationType = notification.notificationType as string;
    const subtype = (notification.subtype as string) || null;
    const notificationUUID = notification.notificationUUID as string;
    const signedDate = notification.signedDate as number | undefined;

    console.log(JSON.stringify({
      event: 'apple_notification_received',
      type: notificationType,
      subtype,
      uuid: notificationUUID,
    }));

    // --- Replay protection: reject notifications with stale signedDate ---
    if (signedDate) {
      const age = Date.now() - signedDate;
      if (age > MAX_NOTIFICATION_AGE_MS) {
        console.error(JSON.stringify({
          event: 'notification_too_old',
          uuid: notificationUUID,
          signed_date: new Date(signedDate).toISOString(),
          age_ms: age,
        }));
        // Return 200 so Apple doesn't retry a legitimately old notification
        return new Response(JSON.stringify({ ok: true, skipped: 'stale' }), { status: 200 });
      }
    }

    // --- Idempotency: check if we already successfully processed this notification ---
    if (notificationUUID) {
      const { data: existing } = await supabase
        .from('apple_subscription_notifications')
        .select('processing_result')
        .eq('notification_uuid', notificationUUID)
        .eq('processing_result', 'success')
        .maybeSingle();

      if (existing) {
        console.log(JSON.stringify({
          event: 'duplicate_notification_skipped',
          uuid: notificationUUID,
        }));
        return new Response(JSON.stringify({ ok: true, skipped: 'duplicate' }), { status: 200 });
      }
    }

    // --- Decode transaction and renewal info from the verified notification ---
    const notifData = notification.data as Record<string, unknown> | undefined;

    if (!notifData) {
      await logNotification(supabase, {
        notification_type: notificationType,
        subtype,
        notification_uuid: notificationUUID,
        signed_date: signedDate ? new Date(signedDate).toISOString() : null,
        environment: null,
        raw_payload: notification,
        processing_result: 'ignored',
        processing_error: 'No data in notification',
      });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    const environment = notifData.environment as string | undefined;
    const signedTransactionInfo = notifData.signedTransactionInfo as string | undefined;
    const signedRenewalInfo = notifData.signedRenewalInfo as string | undefined;

    // Decode inner JWS payloads (safe — outer JWS is already verified)
    let txn: Record<string, unknown> | null = null;
    if (signedTransactionInfo) {
      txn = decodeJwsPayloadUnsafe(signedTransactionInfo);
    }

    let renewal: Record<string, unknown> | null = null;
    if (signedRenewalInfo) {
      renewal = decodeJwsPayloadUnsafe(signedRenewalInfo);
    }

    const originalTransactionId = txn?.originalTransactionId as string | undefined;
    const transactionId = txn?.transactionId as string | undefined;
    const productId = txn?.productId as string | undefined;
    const bundleId = txn?.bundleId as string | undefined;
    const expiresDate = txn?.expiresDate as number | undefined;
    const autoRenewStatus = renewal?.autoRenewStatus as number | undefined;

    // --- Validate bundle ID ---
    if (bundleId && bundleId !== appleBundleId) {
      await logNotification(supabase, {
        notification_type: notificationType,
        subtype,
        notification_uuid: notificationUUID,
        original_transaction_id: originalTransactionId,
        transaction_id: transactionId,
        product_id: productId,
        environment,
        signed_date: signedDate ? new Date(signedDate).toISOString() : null,
        raw_payload: notification,
        processing_result: 'ignored',
        processing_error: `Bundle mismatch: ${bundleId}`,
      });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // --- Find the user by original_transaction_id ---
    let userId: string | null = null;
    if (originalTransactionId) {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('apple_original_transaction_id', originalTransactionId)
        .single();
      userId = sub?.user_id || null;
    }

    // --- Process notification by type ---
    let processingResult: 'success' | 'error' | 'ignored' = 'ignored';
    let processingError: string | null = null;

    try {
      switch (notificationType) {
        case 'SUBSCRIBED': {
          if (!userId) {
            // Race condition: client hasn't written the subscription row yet.
            // Return 500 so Apple retries — we'll find the user next time.
            await logNotification(supabase, {
              notification_type: notificationType,
              subtype,
              notification_uuid: notificationUUID,
              original_transaction_id: originalTransactionId,
              transaction_id: transactionId,
              product_id: productId,
              environment,
              signed_date: signedDate ? new Date(signedDate).toISOString() : null,
              raw_payload: notification,
              processing_result: 'error',
              processing_error: 'User not found — requesting Apple retry',
            });
            return new Response(
              JSON.stringify({ error: 'User not yet registered for this transaction' }),
              { status: 500 },
            );
          }

          if (!PREMIUM_PRODUCT_IDS.includes(productId)) {
            processingResult = 'ignored';
            processingError = `Unknown product: ${productId}`;
            break;
          }

          // Determine subscription status:
          // - Free trial: offerType 1 (introductory) with offerDiscountType "FREE_TRIAL"
          // - Other intro offers (pay-up-front, pay-as-you-go) are still "active"
          const isTrial =
            subtype === 'INITIAL_BUY' &&
            txn?.offerType === 1 &&
            txn?.offerDiscountType === 'FREE_TRIAL';

          await updateSubscription(supabase, userId, {
            tier: 'premium',
            status: isTrial ? 'trialing' : 'active',
            expiresDate,
            transactionId,
            originalTransactionId,
            productId,
            environment: environment as 'Production' | 'Sandbox' | undefined,
            autoRenewStatus: autoRenewStatus === 1,
            cancelAtPeriodEnd: false,
            source: 'apple_notification',
          });
          processingResult = 'success';
          break;
        }

        case 'DID_RENEW': {
          if (!userId) {
            processingResult = 'ignored';
            processingError = 'User not found for original_transaction_id';
            break;
          }

          if (!PREMIUM_PRODUCT_IDS.includes(productId)) {
            processingResult = 'ignored';
            processingError = `Unknown product: ${productId}`;
            break;
          }

          await updateSubscription(supabase, userId, {
            tier: 'premium',
            status: 'active',
            expiresDate,
            transactionId,
            originalTransactionId,
            productId,
            environment: environment as 'Production' | 'Sandbox' | undefined,
            autoRenewStatus: autoRenewStatus === 1,
            cancelAtPeriodEnd: false,
            source: 'apple_notification',
          });
          processingResult = 'success';
          break;
        }

        case 'EXPIRED': {
          if (!userId) {
            processingResult = 'ignored';
            processingError = 'User not found';
            break;
          }

          await updateSubscription(supabase, userId, {
            tier: 'free',
            status: 'expired',
            expiresDate,
            transactionId,
            originalTransactionId,
            productId,
            environment: environment as 'Production' | 'Sandbox' | undefined,
            autoRenewStatus: false,
            cancelAtPeriodEnd: false,
            source: 'apple_notification',
          });
          processingResult = 'success';
          break;
        }

        case 'DID_CHANGE_RENEWAL_STATUS': {
          if (!userId) {
            processingResult = 'ignored';
            processingError = 'User not found';
            break;
          }

          const willAutoRenew = autoRenewStatus === 1;
          await supabase
            .from('subscriptions')
            .update({
              apple_auto_renew_status: willAutoRenew,
              cancel_at_period_end: !willAutoRenew,
              last_updated_source: 'apple_notification',
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId);
          processingResult = 'success';
          break;
        }

        case 'DID_REVOKE': {
          // Apple revoked the transaction (e.g., Family Sharing revocation)
          if (!userId) {
            processingResult = 'ignored';
            processingError = 'User not found';
            break;
          }

          await updateSubscription(supabase, userId, {
            tier: 'free',
            status: 'revoked',
            expiresDate: undefined,
            transactionId,
            originalTransactionId,
            productId,
            environment: environment as 'Production' | 'Sandbox' | undefined,
            autoRenewStatus: false,
            cancelAtPeriodEnd: false,
            source: 'apple_notification',
          });
          processingResult = 'success';
          break;
        }

        case 'REFUND': {
          // Apple granted a refund
          if (!userId) {
            processingResult = 'ignored';
            processingError = 'User not found';
            break;
          }

          await updateSubscription(supabase, userId, {
            tier: 'free',
            status: 'refunded',
            expiresDate: undefined,
            transactionId,
            originalTransactionId,
            productId,
            environment: environment as 'Production' | 'Sandbox' | undefined,
            autoRenewStatus: false,
            cancelAtPeriodEnd: false,
            source: 'apple_notification',
          });
          processingResult = 'success';
          break;
        }

        case 'GRACE_PERIOD_EXPIRED': {
          if (!userId) {
            processingResult = 'ignored';
            processingError = 'User not found';
            break;
          }

          await updateSubscription(supabase, userId, {
            tier: 'free',
            status: 'expired',
            expiresDate,
            transactionId,
            originalTransactionId,
            productId,
            environment: environment as 'Production' | 'Sandbox' | undefined,
            autoRenewStatus: false,
            cancelAtPeriodEnd: false,
            source: 'apple_notification',
          });
          processingResult = 'success';
          break;
        }

        case 'DID_FAIL_TO_RENEW': {
          // Billing issue — subscription enters billing retry or grace period
          if (!userId) {
            processingResult = 'ignored';
            processingError = 'User not found';
            break;
          }

          await supabase
            .from('subscriptions')
            .update({
              status: 'past_due',
              last_updated_source: 'apple_notification',
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId);
          processingResult = 'success';
          break;
        }

        case 'RENEWAL_EXTENDED': {
          // Apple extended the renewal date (usually for service disruptions)
          // Skip SUMMARY subtype — that's a batch notification, not per-user
          if (subtype === 'SUMMARY') {
            processingResult = 'ignored';
            processingError = 'RENEWAL_EXTENDED/SUMMARY — no per-user action needed';
            break;
          }

          if (!userId) {
            processingResult = 'ignored';
            processingError = 'User not found';
            break;
          }

          if (!expiresDate) {
            processingResult = 'ignored';
            processingError = 'No expiresDate in RENEWAL_EXTENDED';
            break;
          }

          await supabase
            .from('subscriptions')
            .update({
              current_period_end: new Date(expiresDate).toISOString(),
              apple_expires_date: new Date(expiresDate).toISOString(),
              last_updated_source: 'apple_notification',
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId);
          processingResult = 'success';
          break;
        }

        case 'DID_CHANGE_RENEWAL_PREF':
        case 'OFFER_REDEEMED':
        case 'PRICE_INCREASE':
        case 'CONSUMPTION_REQUEST':
        case 'TEST': {
          // Informational — log but no action needed for single-product setup
          processingResult = 'ignored';
          processingError = `No action needed for ${notificationType}`;
          break;
        }

        default: {
          processingResult = 'ignored';
          processingError = `Unknown notification type: ${notificationType}`;
        }
      }
    } catch (processingErr) {
      processingResult = 'error';
      processingError = String(processingErr);
      console.error(JSON.stringify({
        event: 'processing_error',
        type: notificationType,
        uuid: notificationUUID,
        error: String(processingErr),
      }));
    }

    // --- Log every notification for audit ---
    await logNotification(supabase, {
      notification_type: notificationType,
      subtype,
      notification_uuid: notificationUUID,
      original_transaction_id: originalTransactionId,
      transaction_id: transactionId,
      product_id: productId,
      user_id: userId,
      environment,
      signed_date: signedDate ? new Date(signedDate).toISOString() : null,
      raw_payload: notification,
      processing_result: processingResult,
      processing_error: processingError,
    });

    // Apple expects 200 to acknowledge receipt
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      event: 'fatal_error',
      error: String(error),
    }));
    // Return 500 so Apple retries
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 },
    );
  }
});

// ============================================
// Helpers
// ============================================

interface UpdateSubscriptionParams {
  tier: 'premium' | 'free';
  status: 'active' | 'trialing' | 'canceled' | 'past_due' | 'expired' | 'revoked' | 'refunded';
  expiresDate?: number;
  transactionId?: string;
  originalTransactionId?: string;
  productId?: string;
  environment?: 'Production' | 'Sandbox';
  autoRenewStatus: boolean;
  cancelAtPeriodEnd: boolean;
  source: 'apple_notification' | 'client_verify';
}

async function updateSubscription(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  params: UpdateSubscriptionParams,
): Promise<void> {
  const { error } = await supabase
    .from('subscriptions')
    .update({
      tier: params.tier,
      status: params.status,
      current_period_end: params.expiresDate
        ? new Date(params.expiresDate).toISOString()
        : null,
      apple_transaction_id: params.transactionId ?? undefined,
      apple_original_transaction_id: params.originalTransactionId ?? undefined,
      apple_product_id: params.productId ?? undefined,
      apple_environment: params.environment ?? undefined,
      apple_expires_date: params.expiresDate
        ? new Date(params.expiresDate).toISOString()
        : null,
      apple_auto_renew_status: params.autoRenewStatus,
      cancel_at_period_end: params.cancelAtPeriodEnd,
      last_updated_source: params.source,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    console.error(JSON.stringify({
      event: 'subscription_update_failed',
      user_id: userId,
      error: error.message,
    }));
    throw error;
  }
}

interface LogNotificationParams {
  notification_type: string;
  subtype: string | null;
  notification_uuid?: string;
  original_transaction_id?: string;
  transaction_id?: string;
  product_id?: string;
  user_id?: string | null;
  environment?: string | null;
  signed_date?: string | null;
  raw_payload: Record<string, unknown>;
  processing_result: 'success' | 'error' | 'ignored';
  processing_error?: string | null;
}

async function logNotification(
  supabase: ReturnType<typeof createClient>,
  params: LogNotificationParams,
): Promise<void> {
  const { error } = await supabase
    .from('apple_subscription_notifications')
    .insert({
      notification_type: params.notification_type,
      subtype: params.subtype,
      notification_uuid: params.notification_uuid,
      original_transaction_id: params.original_transaction_id,
      transaction_id: params.transaction_id,
      product_id: params.product_id,
      user_id: params.user_id,
      environment: params.environment,
      signed_date: params.signed_date,
      raw_payload: params.raw_payload,
      processing_result: params.processing_result,
      processing_error: params.processing_error,
    });

  if (error) {
    // Logging failure should never crash the handler — Apple must get 200
    console.error(JSON.stringify({
      event: 'notification_log_failed',
      uuid: params.notification_uuid,
      error: error.message,
    }));
  }
}