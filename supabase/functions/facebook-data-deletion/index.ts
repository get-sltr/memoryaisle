import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

/**
 * Verify Facebook signed request HMAC-SHA256 signature.
 * Returns the decoded payload if valid, null if verification fails.
 */
async function verifyFacebookSignedRequest(
  signedRequest: string,
  appSecret: string,
): Promise<Record<string, unknown> | null> {
  const [encodedSig, payload] = signedRequest.split('.');
  if (!encodedSig || !payload) return null;

  // Decode the signature (base64url → Uint8Array)
  const sigBytes = Uint8Array.from(
    atob(encodedSig.replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0),
  );

  // Compute expected HMAC-SHA256
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expectedSig = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)),
  );

  // Constant-time comparison
  if (sigBytes.length !== expectedSig.length) return null;
  let mismatch = 0;
  for (let i = 0; i < sigBytes.length; i++) {
    mismatch |= sigBytes[i] ^ expectedSig[i];
  }
  if (mismatch !== 0) return null;

  // Signature valid — decode payload
  const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  return decoded;
}

/**
 * Facebook Data Deletion Callback
 *
 * When a user removes your app from their Facebook settings or requests
 * data deletion, Facebook sends a signed request to this endpoint.
 */
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle GET requests - return instructions page (for Facebook URL validation)
  if (req.method === 'GET') {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Data Deletion - MemoryAisle</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
    h1 { color: #1a1a1a; }
    p { color: #666; line-height: 1.6; }
    .contact { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-top: 20px; }
  </style>
</head>
<body>
  <h1>MemoryAisle Data Deletion</h1>
  <p>To delete your MemoryAisle account and all associated data:</p>
  <ol>
    <li>Open the MemoryAisle app</li>
    <li>Go to Settings > Account</li>
    <li>Tap "Delete Account"</li>
    <li>Confirm deletion</li>
  </ol>
  <p>This will permanently delete:</p>
  <ul>
    <li>Your account information</li>
    <li>Your grocery lists</li>
    <li>Your shopping history</li>
    <li>Your household membership</li>
  </ul>
  <div class="contact">
    <strong>Need help?</strong>
    <p>Contact us at support@memoryaisle.app</p>
  </div>
</body>
</html>`;
    return new Response(html, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Handle POST requests from Facebook
  try {
    const formData = await req.formData();
    const signedRequest = formData.get('signed_request');

    if (!signedRequest) {
      return new Response(
        JSON.stringify({ error: 'Missing signed_request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the signed request against Facebook App Secret
    const fbAppSecret = Deno.env.get('FACEBOOK_APP_SECRET');
    if (!fbAppSecret) {
      console.error('FACEBOOK_APP_SECRET not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const decodedPayload = await verifyFacebookSignedRequest(signedRequest as string, fbAppSecret);
    if (!decodedPayload) {
      console.error('Facebook signed request verification failed');
      return new Response(
        JSON.stringify({ error: 'Invalid signed request' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = decodedPayload.user_id as string;

    if (userId) {
      // Initialize Supabase client
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Find and delete user by Facebook ID
      const { data: users } = await supabase
        .from('users')
        .select('id')
        .eq('facebook_id', userId);

      if (users && users.length > 0) {
        for (const user of users) {
          await supabase.from('items').delete().eq('user_id', user.id);
          await supabase.from('lists').delete().eq('user_id', user.id);
          await supabase.from('users').delete().eq('id', user.id);
        }
      }

      // Generate a confirmation code
      const confirmationCode = crypto.randomUUID();

      // Facebook expects this specific response format
      return new Response(
        JSON.stringify({
          url: `${supabaseUrl}/functions/v1/facebook-data-deletion?code=${confirmationCode}`,
          confirmation_code: confirmationCode,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'No user ID in request' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Data deletion error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
