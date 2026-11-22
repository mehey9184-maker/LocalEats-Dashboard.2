/**
 * CF1 isolated staging bootstrap only. NOT the real LocalEats API.
 *
 * Zero Firebase, Supabase, R2, email, FCM, mutations or Production credentials.
 * Missing or unsafe env => fail closed. Missing exact CORS origins => no browser CORS.
 * All real LocalEats API routes return 503 until an audited migration is complete.
 */
const REQUIRED_OFF = Object.freeze([
  'PICKUP_WRITES_ENABLED',
  'MERCHANT_AVAILABILITY_WRITES_ENABLED',
  'PICKUP_PAYMENT_SETTINGS_WRITES_ENABLED',
  'PROFILE_WRITES_ENABLED',
]);

function safeEnvironment(env) {
  return env?.LOCALEATS_PREVIEW_READ_ONLY === 'true' &&
    REQUIRED_OFF.every((key) => env[key] === 'false');
}

function allowedOrigin(origin, env) {
  if (!origin) return false;
  return [env?.CUSTOMER_APP_ORIGIN, env?.MERCHANT_APP_ORIGIN].some((candidate) => {
    if (typeof candidate !== 'string' || !candidate) return false;
    try {
      const url = new URL(candidate);
      return url.protocol === 'https:' && url.origin === candidate &&
        candidate === origin && !candidate.includes('*');
    } catch { return false; }
  });
}

function apiResponse(status, payload, headers, head = false) {
  return new Response(head ? null : JSON.stringify(payload), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' }
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const method = request.method.toUpperCase();
    const headers = {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Vary': 'Origin, Access-Control-Request-Method'
    };
    if (!safeEnvironment(env)) {
      return apiResponse(503, { success: false, code: 'STAGING_FLAGS_UNSAFE' }, headers, method === 'HEAD');
    }
    if (origin && !allowedOrigin(origin, env)) {
      return apiResponse(403, { success: false, code: 'CORS_ORIGIN_DENIED' }, headers, method === 'HEAD');
    }
    if (origin) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
      headers['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS';
    }
    if (method === 'OPTIONS') {
      const requestedMethod = (request.headers.get('Access-Control-Request-Method') || 'GET').toUpperCase();
      if (!['GET', 'HEAD'].includes(requestedMethod)) {
        return apiResponse(503, { success: false, code: 'STAGING_READ_ONLY' }, headers);
      }
      return new Response(null, { status: 204, headers });
    }
    if (method !== 'GET' && method !== 'HEAD') {
      return apiResponse(503, { success: false, code: 'STAGING_READ_ONLY' }, headers);
    }
    if (new URL(request.url).pathname === '/bootstrap-health') {
      return apiResponse(200, {
        status: 'bootstrap_only',
        service: 'localeats-api-cf1-staging',
        read_only: true,
        api_ready: false,
        database_connected: false,
        firebase_auth_verified: false,
        writes_enabled: false
      }, headers, method === 'HEAD');
    }
    // GET /health is intentionally NOT OK: operational API is not migrated.
    return apiResponse(503, {
      success: false,
      code: 'CLOUDFLARE_API_NOT_MIGRATED',
      error: 'Cloudflare LocalEats staging bootstrap has no business API routes yet.'
    }, headers, method === 'HEAD');
  }
};
