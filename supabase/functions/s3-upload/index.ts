// S3 Presigned URL Generator
// Generates presigned PUT URLs for client-side uploads to S3
// Supports: profile photos, meal memories, blog assets

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

// AWS Signature V4 implementation for S3 presigned URLs
// Using raw crypto APIs (Deno) to avoid heavy AWS SDK dependency

async function hmacSHA256(key: Uint8Array, message: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return new Uint8Array(sig);
}

async function sha256(message: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getSigningKey(secretKey: string, dateStamp: string, region: string, service: string): Promise<Uint8Array> {
  const kDate = await hmacSHA256(new TextEncoder().encode('AWS4' + secretKey), dateStamp);
  const kRegion = await hmacSHA256(kDate, region);
  const kService = await hmacSHA256(kRegion, service);
  return hmacSHA256(kService, 'aws4_request');
}

interface PresignedUrlParams {
  bucket: string;
  key: string;
  contentType: string;
  expiresIn: number;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

async function generatePresignedPutUrl(params: PresignedUrlParams): Promise<string> {
  const { bucket, key, contentType, expiresIn, accessKeyId, secretAccessKey, region } = params;
  const host = `${bucket}.s3.${region}.amazonaws.com`;
  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  const amzDate = dateStamp + 'T' + now.toISOString().slice(11, 19).replace(/:/g, '') + 'Z';
  const credential = `${accessKeyId}/${dateStamp}/${region}/s3/aws4_request`;

  const queryParams = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': expiresIn.toString(),
    'X-Amz-SignedHeaders': 'content-type;host',
  });
  queryParams.sort();

  const canonicalRequest = [
    'PUT',
    '/' + key,
    queryParams.toString(),
    `content-type:${contentType}\nhost:${host}\n`,
    'content-type;host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    `${dateStamp}/${region}/s3/aws4_request`,
    await sha256(canonicalRequest),
  ].join('\n');

  const signingKey = await getSigningKey(secretAccessKey, dateStamp, region, 's3');
  const signature = toHex(await hmacSHA256(signingKey, stringToSign));

  return `https://${host}/${key}?${queryParams.toString()}&X-Amz-Signature=${signature}`;
}

// Upload types and their S3 path patterns
type UploadType = 'profile_photo' | 'meal_memory' | 'blog_asset';

function getS3Key(type: UploadType, userId: string, filename: string): string {
  const timestamp = Date.now();
  switch (type) {
    case 'profile_photo':
      return `profiles/${userId}/avatar_${timestamp}.jpg`;
    case 'meal_memory':
      return `memories/${userId}/${timestamp}_${filename}`;
    case 'blog_asset':
      return `blog/assets/${filename}`;
    default:
      return `uploads/${userId}/${timestamp}_${filename}`;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Environment variables
    const AWS_ACCESS_KEY_ID = Deno.env.get('AWS_ACCESS_KEY_ID');
    const AWS_SECRET_ACCESS_KEY = Deno.env.get('AWS_SECRET_ACCESS_KEY');
    const AWS_REGION = Deno.env.get('AWS_REGION') || 'us-east-1';
    const S3_BUCKET = Deno.env.get('S3_BUCKET') || 'memoryaisle-media';
    const CLOUDFRONT_DOMAIN = Deno.env.get('CLOUDFRONT_DOMAIN'); // e.g. d1234.cloudfront.net
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
      throw new Error('AWS credentials not configured');
    }

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Parse request
    const { type, filename, contentType } = await req.json() as {
      type: UploadType;
      filename?: string;
      contentType?: string;
    };

    if (!type) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing upload type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const resolvedFilename = filename || 'photo.jpg';
    const resolvedContentType = contentType || 'image/jpeg';
    const s3Key = getS3Key(type, user.id, resolvedFilename);

    // Generate presigned URL (15 min expiry)
    const presignedUrl = await generatePresignedPutUrl({
      bucket: S3_BUCKET,
      key: s3Key,
      contentType: resolvedContentType,
      expiresIn: 900,
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
      region: AWS_REGION,
    });

    // Build the public CDN URL
    const cdnUrl = CLOUDFRONT_DOMAIN
      ? `https://${CLOUDFRONT_DOMAIN}/${s3Key}`
      : `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;

    return new Response(
      JSON.stringify({
        success: true,
        uploadUrl: presignedUrl,
        cdnUrl,
        key: s3Key,
        expiresIn: 900,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('S3 upload error:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
