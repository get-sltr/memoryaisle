// Stripe Webhook Handler
// Processes Stripe webhook events for subscription updates

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const cryptoProvider = Stripe.createSubtleCryptoProvider();

serve(async (req) => {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  if (!stripeKey || !webhookSecret) {
    return new Response('Server configuration error', { status: 500 });
  }

  const stripe = new Stripe(stripeKey, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const signature = req.headers.get('Stripe-Signature');
  if (!signature) {
    return new Response('No signature', { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log(`Processing event: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(supabase, stripe, session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(supabase, subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(supabase, subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(supabase, invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(supabase, invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(`Webhook handler error: ${error.message}`, { status: 500 });
  }
});

async function handleCheckoutCompleted(
  supabase: any,
  stripe: Stripe,
  session: Stripe.Checkout.Session
) {
  const userId = session.metadata?.user_id;
  const tier = session.metadata?.tier || 'premium';

  if (!userId || !session.subscription) return;

  // Get full subscription details
  const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

  // Determine billing interval from the price
  const priceInterval = subscription.items.data[0]?.price?.recurring?.interval;
  const billingInterval = priceInterval === 'year' ? 'year' : 'month';

  await supabase.from('subscriptions').upsert({
    user_id: userId,
    tier: 'premium', // Only premium tier now
    status: subscription.status,
    stripe_customer_id: session.customer as string,
    stripe_subscription_id: subscription.id,
    stripe_price_id: subscription.items.data[0]?.price?.id,
    billing_interval: billingInterval,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  console.log(`Subscription created for user ${userId}: premium (${billingInterval})`);
}

async function handleSubscriptionUpdate(supabase: any, subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.user_id;
  if (!userId) {
    console.log('No user_id in subscription metadata');
    return;
  }

  // Determine billing interval from the price
  const priceInterval = subscription.items.data[0]?.price?.recurring?.interval;
  const billingInterval = priceInterval === 'year' ? 'year' : 'month';

  await supabase
    .from('subscriptions')
    .update({
      tier: 'premium',
      status: subscription.status,
      stripe_price_id: subscription.items.data[0]?.price?.id,
      billing_interval: billingInterval,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  console.log(`Subscription updated: ${subscription.id} -> ${subscription.status} (${billingInterval})`);
}

async function handleSubscriptionDeleted(supabase: any, subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.user_id;

  // Downgrade to free tier
  await supabase
    .from('subscriptions')
    .update({
      tier: 'free',
      status: 'none',
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  console.log(`Subscription deleted: ${subscription.id}`);
}

async function handlePaymentSucceeded(supabase: any, invoice: Stripe.Invoice) {
  if (!invoice.subscription) return;

  await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', invoice.subscription);

  console.log(`Payment succeeded for subscription: ${invoice.subscription}`);
}

async function handlePaymentFailed(supabase: any, invoice: Stripe.Invoice) {
  if (!invoice.subscription) return;

  await supabase
    .from('subscriptions')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', invoice.subscription);

  console.log(`Payment failed for subscription: ${invoice.subscription}`);
}
