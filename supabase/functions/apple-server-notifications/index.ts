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

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import {
  verifyAndDecodeAppleJws,
  decodeJwsPayloadUnsafe,
  AppleJwsError,
} from '../_shared/apple-jws.ts';

const PREMIUM_YEARLY_PRODUCT_ID = 'com.memoryaisle.app.premium.yearly';

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
    // This cryptographically validates Apple's x5c certificate chain
    // and verifies the signature against the leaf certificate.
    let notification: Record<string, unknown>;
    try {
      notification = await verifyAndDecodeAppleJws(body.signedPayload);
    } catch (error) {
      if (error instanceof AppleJwsError) {
        console.error('JWS verification failed:', error.message);
        // Return 403 for forged/invalid signatures — don't let Apple retry
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

    console.log(`Apple notification: ${notificationType}${subtype ? `/${subtype}` : ''} (${notificationUUID})`);

    // --- Decode transaction and renewal info from the verified notification ---
    // These inner JWS payloads are trusted because they come from within
    // the cryptographically verified outer JWS.
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
        case 'SUBSCRIBED':
        case 'DID_RENEW': {
          // Subscription started or renewed successfully
          if (userId && productId === PREMIUM_YEARLY_PRODUCT_ID) {
            await updateSubscription(supabase, userId, {
              tier: 'premium',
              status: notificationType === 'SUBSCRIBED' && subtype === 'INITIAL_BUY' && txn?.offerType === 1
                ? 'trialing' : 'active',
              expiresDate,
              transactionId,
              originalTransactionId,
              productId,
              environment: environment as 'Production' | 'Sandbox' | undefined,
              autoRenewStatus: autoRenewStatus === 1,
              cancelAtPeriodEnd: false,
            });
            processingResult = 'success';
          } else if (!userId) {
            processingResult = 'ignored';
            processingError = 'User not found for original_transaction_id';
          } else {
            processingResult = 'ignored';
            processingError = `Unknown product: ${productId}`;
          }
          break;
        }

        case 'EXPIRED': {
          if (userId) {
            await updateSubscription(supabase, userId, {
              tier: 'free',
              status: 'none',
              expiresDate,
              transactionId,
              originalTransactionId,
              productId,
              environment: environment as 'Production' | 'Sandbox' | undefined,
              autoRenewStatus: false,
              cancelAtPeriodEnd: false,
            });
            processingResult = 'success';
          } else {
            processingResult = 'ignored';
            processingError = 'User not found';
          }
          break;
        }

        case 'DID_CHANGE_RENEWAL_STATUS': {
          if (userId) {
            const willAutoRenew = autoRenewStatus === 1;
            await supabase
              .from('subscriptions')
              .update({
                apple_auto_renew_status: willAutoRenew,
                cancel_at_period_end: !willAutoRenew,
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', userId);
            processingResult = 'success';
          } else {
            processingResult = 'ignored';
            processingError = 'User not found';
          }
          break;
        }

        case 'DID_REVOKE': {
          // Apple revoked the transaction (refund granted by Apple Support)
          if (userId) {
            await updateSubscription(supabase, userId, {
              tier: 'free',
              status: 'none',
              expiresDate: undefined,
              transactionId,
              originalTransactionId,
              productId,
              environment: environment as 'Production' | 'Sandbox' | undefined,
              autoRenewStatus: false,
              cancelAtPeriodEnd: false,
            });
            processingResult = 'success';
          } else {
            processingResult = 'ignored';
            processingError = 'User not found';
          }
          break;
        }

        case 'REFUND': {
          if (userId) {
            await updateSubscription(supabase, userId, {
              tier: 'free',
              status: 'none',
              expiresDate: undefined,
              transactionId,
              originalTransactionId,
              productId,
              environment: environment as 'Production' | 'Sandbox' | undefined,
              autoRenewStatus: false,
              cancelAtPeriodEnd: false,
            });
            processingResult = 'success';
          } else {
            processingResult = 'ignored';
            processingError = 'User not found';
          }
          break;
        }

        case 'GRACE_PERIOD_EXPIRED': {
          if (userId) {
            await updateSubscription(supabase, userId, {
              tier: 'free',
              status: 'none',
              expiresDate,
              transactionId,
              originalTransactionId,
              productId,
              environment: environment as 'Production' | 'Sandbox' | undefined,
              autoRenewStatus: false,
              cancelAtPeriodEnd: false,
            });
            processingResult = 'success';
          } else {
            processingResult = 'ignored';
            processingError = 'User not found';
          }
          break;
        }

        case 'DID_FAIL_TO_RENEW': {
          // Billing issue — subscription enters billing retry or grace period
          if (userId) {
            await supabase
              .from('subscriptions')
              .update({
                status: 'past_due',
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', userId);
            processingResult = 'success';
          } else {
            processingResult = 'ignored';
            processingError = 'User not found';
          }
          break;
        }

        case 'RENEWAL_EXTENDED': {
          // Apple extended the renewal date (usually for service disruptions)
          if (userId && expiresDate) {
            await supabase
              .from('subscriptions')
              .update({
                current_period_end: new Date(expiresDate).toISOString(),
                apple_expires_date: new Date(expiresDate).toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', userId);
            processingResult = 'success';
          } else {
            processingResult = 'ignored';
            processingError = userId ? 'No expiresDate' : 'User not found';
          }
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
      console.error(`Error processing ${notificationType}:`, processingErr);
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
    console.error('Fatal error processing Apple notification:', error);
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
  status: 'active' | 'trialing' | 'canceled' | 'past_due' | 'none';
  expiresDate?: number;
  transactionId?: string;
  originalTransactionId?: string;
  productId?: string;
  environment?: 'Production' | 'Sandbox';
  autoRenewStatus: boolean;
  cancelAtPeriodEnd: boolean;
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
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    console.error(`Failed to update subscription for user ${userId}:`, error);
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
    console.error('Failed to log notification:', error);
  }
}
