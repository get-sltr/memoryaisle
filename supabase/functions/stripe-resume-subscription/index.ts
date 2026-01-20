// Stripe Resume Subscription
// Resumes a canceled subscription before period end

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) throw new Error('Stripe key not configured');

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId } = await req.json();

    if (!userId) {
      throw new Error('Missing user ID');
    }

    // Get user's subscription
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id, cancel_at_period_end')
      .eq('user_id', userId)
      .single();

    if (error || !subscription?.stripe_subscription_id) {
      throw new Error('No subscription found');
    }

    if (!subscription.cancel_at_period_end) {
      throw new Error('Subscription is not set to cancel');
    }

    // Resume subscription
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: false,
    });

    // Update local record
    await supabase
      .from('subscriptions')
      .update({
        cancel_at_period_end: false,
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    return new Response(
      JSON.stringify({ success: true, message: 'Subscription resumed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error resuming subscription:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to resume subscription' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
