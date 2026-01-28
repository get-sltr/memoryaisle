// Create Stripe Subscription
// Called after payment method is saved via PaymentSheet

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://memoryaisle.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, priceId, interval } = await req.json();

    if (!userId || !priceId) {
      return new Response(
        JSON.stringify({ error: 'User ID and Price ID are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get customer ID from database
    const { data: subData, error: subError } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('user_id', userId)
      .single();

    if (subError || !subData?.stripe_customer_id) {
      throw new Error('Customer not found. Please set up payment first.');
    }

    const customerId = subData.stripe_customer_id;

    // Check if user already has an active subscription
    if (subData.stripe_subscription_id) {
      const existingSub = await stripe.subscriptions.retrieve(subData.stripe_subscription_id);
      if (existingSub.status === 'active' || existingSub.status === 'trialing') {
        return new Response(
          JSON.stringify({ error: 'You already have an active subscription' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get the default payment method
    const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
    const defaultPaymentMethod = customer.invoice_settings?.default_payment_method;

    if (!defaultPaymentMethod) {
      // Get the first available payment method
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
        limit: 1,
      });

      if (paymentMethods.data.length === 0) {
        throw new Error('No payment method found. Please add a card first.');
      }

      // Set as default
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethods.data[0].id,
        },
      });
    }

    // Create the subscription
    // Yearly gets 3-day free trial, monthly does not
    const subscriptionParams: Stripe.SubscriptionCreateParams = {
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        user_id: userId,
        interval: interval || 'month',
      },
    };

    // Add 3-day trial for yearly subscriptions only
    if (interval === 'year') {
      subscriptionParams.trial_period_days = 3;
    }

    const subscription = await stripe.subscriptions.create(subscriptionParams);

    // Get period dates
    const currentPeriodStart = new Date(subscription.current_period_start * 1000).toISOString();
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

    // Update subscription in database
    await supabase
      .from('subscriptions')
      .update({
        stripe_subscription_id: subscription.id,
        stripe_price_id: priceId,
        tier: 'premium',
        status: subscription.status === 'active' ? 'active' : 'trialing',
        interval: interval || 'month',
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    // Check if payment is required
    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice?.payment_intent as Stripe.PaymentIntent;

    return new Response(
      JSON.stringify({
        subscriptionId: subscription.id,
        status: subscription.status,
        clientSecret: paymentIntent?.client_secret,
        requiresAction: paymentIntent?.status === 'requires_action',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Create subscription error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
