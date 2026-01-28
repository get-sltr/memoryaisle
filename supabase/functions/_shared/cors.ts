// Shared CORS configuration for Edge Functions
// Restricts access to specific origins for security

const ALLOWED_ORIGINS = [
  'https://memoryaisle.app',
  'https://www.memoryaisle.app',
];

// For local development (only enable in development)
const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:8081',
];

export function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  // Check if origin is allowed
  const origin = requestOrigin || '';
  const isAllowed = ALLOWED_ORIGINS.includes(origin) ||
    (Deno.env.get('ENVIRONMENT') === 'development' && DEV_ORIGINS.includes(origin));

  // For mobile apps (no Origin header), allow the request but don't set CORS
  // For web requests, only allow specific origins
  const allowOrigin = isAllowed ? origin : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

// Pre-built response for OPTIONS preflight requests
export function handleCorsPreflightRequest(request: Request): Response {
  const origin = request.headers.get('Origin');
  return new Response('ok', {
    headers: getCorsHeaders(origin),
  });
}

// Helper to add CORS headers to a response
export function withCors(response: Response, requestOrigin?: string | null): Response {
  const corsHeaders = getCorsHeaders(requestOrigin);
  const newHeaders = new Headers(response.headers);

  Object.entries(corsHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
