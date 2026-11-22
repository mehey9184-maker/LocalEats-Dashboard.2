import { existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DISABLED_WRITES = Object.freeze({
  VITE_MERCHANT_PREVIEW_READ_ONLY: 'true',
  VITE_PICKUP_ORDERING_ENABLED: 'false',
  VITE_PICKUP_PAYMENT_SETTINGS_ENABLED: 'false',
  VITE_MERCHANT_AVAILABILITY_WRITES_ENABLED: 'false',
  VITE_PROFILE_WRITES_ENABLED: 'false',
  VITE_MERCHANT_FAKE_ORDERS_ENABLED: 'false',
  VITE_PAYMENTS_PLAN_DEMO_ENABLED: 'false',
  PICKUP_WRITES_ENABLED: 'false',
  MERCHANT_AVAILABILITY_WRITES_ENABLED: 'false',
  PICKUP_PAYMENT_SETTINGS_WRITES_ENABLED: 'false',
  PROFILE_WRITES_ENABLED: 'false',
});
const PRIVATE_KEYS = Object.freeze([
  'GEMINI_API_KEY', 'VITE_GEMINI_API_KEY',
  'GOOGLE_MAPS_PLATFORM_KEY',
  'SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_SERVICE_ROLE_KEY',
  'FIREBASE_PRIVATE_KEY', 'VITE_FIREBASE_PRIVATE_KEY',
  'CLOUDFLARE_API_TOKEN', 'VITE_CLOUDFLARE_API_TOKEN',
]);

export function requireStagingApiOrigin(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('Cloudflare Merchant staging requires an explicit isolated staging API origin.');
  }
  let url;
  try { url = new URL(raw); }
  catch { throw new Error('Invalid staging API origin.'); }
  if (url.protocol !== 'https:' ||
      !/^[a-z0-9-]+(\.[a-z0-9-]+)*\.workers\.dev$/.test(url.hostname) ||
      url.username || url.password || url.port || url.pathname !== '/' ||
      url.search || url.hash || raw !== url.origin) {
    throw new Error('Staging API must be an exact HTTPS workers.dev origin, never Vercel or Production.');
  }
  return url.origin;
}

export function prepareStagingEnv(source) {
  for (const key of PRIVATE_KEYS) {
    if (typeof source[key] === 'string' && source[key].trim()) {
      throw new Error('Private or server-side key must not enter a static Merchant build: ' + key);
    }
  }
  return {
    ...source,
    ...DISABLED_WRITES,
    VITE_LOCALEATS_API_URL: requireStagingApiOrigin(source.VITE_LOCALEATS_API_URL),
    VITE_GEMINI_API_KEY: '',
    GEMINI_API_KEY: ''
  };
}

export function requireCleanEnvFiles(directory) {
  const found = readdirSync(directory).filter((name) => name.startsWith('.env') && name !== '.env.example');
  if (found.length) throw new Error('Use reviewed public CI environment variables; local .env files are forbidden for CF1: ' + found.join(', '));
}

export function verifyStaticOutput(directory) {
  if (!existsSync(resolve(directory, 'index.html'))) throw new Error('Missing Vite index.html in static output.');
  for (const name of ['server.cjs', 'server.js', '.env', '.env.production']) {
    if (existsSync(resolve(directory, name))) throw new Error('Refusing to publish server file or secret: ' + name);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    requireCleanEnvFiles(root);
    const env = prepareStagingEnv(process.env);
    const vite = resolve(root, 'node_modules/vite/bin/vite.js');
    if (!existsSync(vite)) throw new Error('Run npm ci first.');
    const run = spawnSync(process.execPath, [vite, 'build', '--emptyOutDir'], {
      cwd: root, env, stdio: 'inherit'
    });
    if (run.status !== 0) throw new Error('Merchant Vite static build failed.');
    verifyStaticOutput(resolve(root, 'dist'));
    console.log('CF1 Merchant static staging build prepared; no deployment performed.');
  } catch (error) {
    console.error('CF1 Merchant staging build BLOCKED:', error.message);
    process.exitCode = 1;
  }
}
