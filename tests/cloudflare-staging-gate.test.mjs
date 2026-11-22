import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DISABLED_WRITES, prepareStagingEnv, requireCleanEnvFiles,
  requireStagingApiOrigin, verifyStaticOutput
} from '../scripts/build-cloudflare-staging.mjs';

const api = 'https://localeats-api-cf1-staging.example.workers.dev';

test('CF1 Merchant staging rejects live/unverified backends', () => {
  assert.equal(requireStagingApiOrigin(api), api);
  for (const value of [undefined, 'http://example.workers.dev',
    'https://localeats-api.vercel.app', 'https://www.localeatssa.co.za',
    api + '/api', api + '?t=1']) assert.throws(() => requireStagingApiOrigin(value));
});

test('CF1 Merchant frontend stays write-disabled and cannot publish server keys', () => {
  const env = prepareStagingEnv({VITE_LOCALEATS_API_URL: api, VITE_PICKUP_ORDERING_ENABLED: 'true'});
  for (const [key, expected] of Object.entries(DISABLED_WRITES)) assert.equal(env[key], expected);
  for (const key of ['GEMINI_API_KEY', 'VITE_GEMINI_API_KEY', 'GOOGLE_MAPS_PLATFORM_KEY',
    'SUPABASE_SERVICE_ROLE_KEY', 'FIREBASE_PRIVATE_KEY']) {
    assert.throws(() => prepareStagingEnv({VITE_LOCALEATS_API_URL: api, [key]: 'private'}));
  }
});

test('CF1 Merchant Vite config must not replace server secrets into public JavaScript', () => {
  const vite = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(vite, /['"]process\.env\.(?:GEMINI_API_KEY|GOOGLE_MAPS_PLATFORM_KEY)['"]\s*:/);
});

test('CF1 Merchant rejects local secret env and server assets', () => {
  const dir = mkdtempSync(join(tmpdir(), 'merchant-cf1-'));
  try {
    requireCleanEnvFiles(dir);
    writeFileSync(join(dir, '.env.local'), 'SECRET=x');
    assert.throws(() => requireCleanEnvFiles(dir));
    rmSync(join(dir, '.env.local'));
    mkdirSync(join(dir, 'dist'));
    const output = join(dir, 'dist');
    writeFileSync(join(output, 'index.html'), '<html></html>');
    verifyStaticOutput(output);
    writeFileSync(join(output, 'server.cjs'), 'private');
    assert.throws(() => verifyStaticOutput(output));
  } finally { rmSync(dir, {recursive: true, force: true}); }
});
