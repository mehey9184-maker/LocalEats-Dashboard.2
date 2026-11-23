/**
 * CF1 isolated live-edge smoke: bounded, unauthenticated and synthetic only.
 * This has no app account, customer data, Firebase/Supabase credentials or
 * supported order request body. It must NEVER target Production.
 */
import assert from 'node:assert/strict';

const base = 'https://localeats-api-cf1-staging.mehey9184.workers.dev';
if (!base.endsWith('.mehey9184.workers.dev') || !base.includes('cf1-staging')) {
  throw new Error('Refusing to probe any non-CF1 staging host');
}

async function call(path, init = {}) {
  let res;
  try {
    res = await fetch(base + path, {
      ...init,
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
      headers: { 'User-Agent': 'LocalEats-CF1-safe-GitHub-acceptance', ...(init.headers || {}) }
    });
  } catch (error) {
    throw new Error('Cloudflare Worker network/DNS unavailable: ' + error.message);
  }
  assert.equal(res.headers.get('cache-control'), 'no-store', path + ' cache');
  return res;
}

const healthy = await call('/bootstrap-health');
assert.equal(healthy.status, 200, 'bootstrap-only probe');
const facts = await healthy.json();
for (const name of ['api_ready', 'database_connected', 'firebase_auth_verified', 'writes_enabled'])
  assert.equal(facts[name], false, 'must be false: ' + name);
assert.equal(facts.status, 'bootstrap_only');
console.log('PASS: bootstrap health only; no real API claims');

for (const path of ['/health', '/api/v1/catalog/shops', '/api/v1/catalog/shops/18/menu',
  '/api/v1/orders', '/api/v1/merchant/orders']) {
  const res = await call(path);
  assert.equal(res.status, 503, 'business route must deny: ' + path);
  console.log('PASS: GET ' + path + ' → 503');
}

const head = await call('/bootstrap-health', { method: 'HEAD' });
assert.equal(head.status, 200);
assert.equal(await head.text(), '');
console.log('PASS: HEAD /bootstrap-health');

const preflight = await call('/bootstrap-health', {
  method: 'OPTIONS',
  headers: { 'Access-Control-Request-Method': 'GET' }
});
assert.equal(preflight.status, 204);
console.log('PASS: read-only OPTIONS');

const mutationPreflight = await call('/api/v1/orders', {
  method: 'OPTIONS',
  headers: { 'Access-Control-Request-Method': 'POST' }
});
assert.equal(mutationPreflight.status, 503);
console.log('PASS: write preflight denied');

const attacker = await call('/bootstrap-health', {
  headers: { Origin: 'https://untrusted.example' }
});
assert.equal(attacker.status, 403);
console.log('PASS: unknown browser origin denied');

const mutation = await call('/api/v1/orders', { method: 'POST' });
assert.equal(mutation.status, 503, 'synthetic empty POST must be rejected');
console.log('PASS: empty POST denied; no customer/order content submitted');
console.log('PASS: Cloudflare CF1 staging edge smoke verified, no live business API');
