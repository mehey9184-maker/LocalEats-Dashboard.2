import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloudflare-staging/worker.mjs';

const url = 'https://localeats-api-cf1-staging.example.workers.dev';
const source = Object.freeze({
  LOCALEATS_PREVIEW_READ_ONLY: 'true',
  PICKUP_WRITES_ENABLED: 'false',
  MERCHANT_AVAILABILITY_WRITES_ENABLED: 'false',
  PICKUP_PAYMENT_SETTINGS_WRITES_ENABLED: 'false',
  PROFILE_WRITES_ENABLED: 'false'
});
const origin = 'https://localeats-customer-cf1-staging.example.workers.dev';
const req = (path, method='GET', from, other={}) =>
  new Request(url + path, { method, headers: { ...(from ? {Origin: from}: {}), ...other } });

test('CF1 /bootstrap-health is truthful, noncached, and not a launch-readiness claim', async () => {
  const r = await worker.fetch(req('/bootstrap-health'), source);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('Cache-Control'), 'no-store');
  const value = await r.json();
  assert.equal(value.api_ready, false);
  assert.equal(value.database_connected, false);
  assert.equal(value.firebase_auth_verified, false);
  assert.equal(value.writes_enabled, false);
  assert.equal((await worker.fetch(req('/health'), source)).status, 503);
});

test('CF1 all real read routes and all mutation verbs are unavailable', async () => {
  for (const path of ['/api/v1/catalog/shops', '/api/v1/merchant/orders',
    '/api/v1/profiles', '/health']) {
    const result = await worker.fetch(req(path), source);
    assert.equal(result.status, 503, path);
  }
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    for (const path of ['/bootstrap-health', '/api/v1/orders']) {
      const result = await worker.fetch(req(path, method), source);
      assert.equal(result.status, 503, method + ' ' + path);
    }
  }
});

test('CF1 fails closed when write off-flags are missing or accidentally true', async () => {
  for (const name of Object.keys(source)) {
    const unsafe = { ...source, [name]: name === 'LOCALEATS_PREVIEW_READ_ONLY' ? 'false' : 'true' };
    const result = await worker.fetch(req('/bootstrap-health'), unsafe);
    assert.equal(result.status, 503, name);
  }
});

test('CF1 CORS requires exact configured origin and rejects write preflights', async () => {
  const accepted = { ...source, CUSTOMER_APP_ORIGIN: origin };
  assert.equal((await worker.fetch(req('/bootstrap-health','GET',origin), source)).status, 403);
  assert.equal((await worker.fetch(req('/bootstrap-health','GET',origin + '.evil.com'), accepted)).status, 403);
  assert.equal((await worker.fetch(req('/bootstrap-health','GET',origin), accepted)).headers.get('Access-Control-Allow-Origin'), origin);
  const read = await worker.fetch(req('/bootstrap-health','OPTIONS',origin,{'Access-Control-Request-Method':'GET'}), accepted);
  assert.equal(read.status, 204);
  const write = await worker.fetch(req('/api/v1/orders','OPTIONS',origin,{'Access-Control-Request-Method':'POST'}), accepted);
  assert.equal(write.status, 503);
  assert.equal((await worker.fetch(req('/bootstrap-health','HEAD'), source)).status, 200);
});
