// Send OTP via AWS SNS
// Custom phone verification bypassing Supabase's limited phone providers

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// AWS SNS signing
async function signAWSRequest(
  method: string,
  url: string,
  body: string,
  region: string,
  service: string,
  accessKeyId: string,
  secretAccessKey: string
): Promise<Headers> {
  const encoder = new TextEncoder();
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const urlObj = new URL(url);
  const host = urlObj.host;
  const canonicalUri = urlObj.pathname || '/';
  const canonicalQuerystring = '';

  const payloadHash = await crypto.subtle.digest('SHA-256', encoder.encode(body));
  const payloadHashHex = Array.from(new Uint8Array(payloadHash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const canonicalHeaders = `content-type:application/x-www-form-urlencoded\nhost:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-date';

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    payloadHashHex,
  ].join('\n');

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const canonicalRequestHash = await crypto.subtle.digest('SHA-256', encoder.encode(canonicalRequest));
  const canonicalRequestHashHex = Array.from(new Uint8Array(canonicalRequestHash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    canonicalRequestHashHex,
  ].join('\n');

  // Derive signing key
  async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    return await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
  }

  const kDate = await hmacSha256(encoder.encode('AWS4' + secretAccessKey), dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');

  const signature = await hmacSha256(kSigning, stringToSign);
  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signatureHex}`;

  const headers = new Headers();
  headers.set('Content-Type', 'application/x-www-form-urlencoded');
  headers.set('Host', host);
  headers.set('X-Amz-Date', amzDate);
  headers.set('Authorization', authorizationHeader);

  return headers;
}

async function sendSMS(phoneNumber: string, message: string): Promise<boolean> {
  const region = Deno.env.get('AWS_REGION') || 'us-west-2';
  const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS credentials not configured');
  }

  const endpoint = `https://sns.${region}.amazonaws.com/`;
  const body = new URLSearchParams({
    Action: 'Publish',
    Version: '2010-03-31',
    PhoneNumber: phoneNumber,
    Message: message,
  }).toString();

  const headers = await signAWSRequest(
    'POST',
    endpoint,
    body,
    region,
    'sns',
    accessKeyId,
    secretAccessKey
  );

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('SNS Error:', errorText);
    throw new Error(`SNS request failed: ${response.status}`);
  }

  return true;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate phone format (E.164)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phone)) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone format. Use E.164 format (e.g., +14155551234)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Rate limiting: Check if too many recent attempts
    const { data: recentAttempts } = await supabase
      .from('phone_verifications')
      .select('id')
      .eq('phone', phone)
      .gte('created_at', new Date(Date.now() - 60000).toISOString()); // Last minute

    if (recentAttempts && recentAttempts.length >= 3) {
      return new Response(
        JSON.stringify({ error: 'Too many attempts. Please wait before requesting a new code.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Delete any existing codes for this phone
    await supabase
      .from('phone_verifications')
      .delete()
      .eq('phone', phone);

    // Save new code
    const { error: insertError } = await supabase
      .from('phone_verifications')
      .insert({
        phone,
        code,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      throw insertError;
    }

    // Send SMS via AWS SNS
    await sendSMS(phone, `Your MemoryAisle verification code is: ${code}. Expires in 5 minutes.`);

    return new Response(
      JSON.stringify({ success: true, message: 'Verification code sent' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Send OTP error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to send verification code' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
