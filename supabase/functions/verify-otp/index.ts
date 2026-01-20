// Verify OTP and create/sign in user
// Custom phone verification bypassing Supabase's limited phone providers

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, code } = await req.json();

    if (!phone || !code) {
      return new Response(
        JSON.stringify({ error: 'Phone and code are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get verification record
    const { data: verification, error: fetchError } = await supabase
      .from('phone_verifications')
      .select('*')
      .eq('phone', phone)
      .eq('code', code)
      .gt('expires_at', new Date().toISOString())
      .eq('verified', false)
      .single();

    if (fetchError || !verification) {
      // Increment attempts for rate limiting tracking
      await supabase
        .from('phone_verifications')
        .update({ attempts: supabase.rpc('increment_attempts') })
        .eq('phone', phone);

      return new Response(
        JSON.stringify({ error: 'Invalid or expired code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check max attempts
    if (verification.attempts >= 5) {
      return new Response(
        JSON.stringify({ error: 'Too many failed attempts. Please request a new code.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark as verified
    await supabase
      .from('phone_verifications')
      .update({ verified: true })
      .eq('id', verification.id);

    // Check if user exists with this phone
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.phone === phone);

    let session;
    let user;

    if (existingUser) {
      // User exists - create session
      const { data: signInData, error: signInError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: existingUser.email || `${phone.replace('+', '')}@phone.memoryaisle.app`,
      });

      if (signInError) {
        // Fallback: create a custom session token
        // For now, we'll update the user's phone_confirmed_at
        await supabase.auth.admin.updateUserById(existingUser.id, {
          phone_confirm: true,
        });
      }

      user = existingUser;
    } else {
      // Create new user with phone
      const tempEmail = `${phone.replace('+', '')}@phone.memoryaisle.app`;

      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        phone,
        phone_confirm: true,
        email: tempEmail,
        email_confirm: true,
        user_metadata: {
          phone_verified: true,
          signup_method: 'phone',
        },
      });

      if (createError) {
        throw createError;
      }

      user = newUser.user;

      // Create user profile
      await supabase.from('users').insert({
        id: user.id,
        phone,
        onboarding_completed: false,
      });
    }

    // Generate access token for the user
    // Since we can't directly create a session, we use a workaround
    // The client will need to use this token or re-authenticate

    // Create a signed JWT for the user (simplified approach)
    // In production, you might want to use proper JWT signing
    const { data: tokenData, error: tokenError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email || `${phone.replace('+', '')}@phone.memoryaisle.app`,
      options: {
        redirectTo: 'memoryaisle://',
      },
    });

    // Clean up verification record
    await supabase
      .from('phone_verifications')
      .delete()
      .eq('id', verification.id);

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user.id,
          phone: user.phone,
        },
        // Return magic link for client to complete auth
        actionLink: tokenData?.properties?.action_link,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Verify OTP error:', error);
    return new Response(
      JSON.stringify({ error: 'Verification failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
