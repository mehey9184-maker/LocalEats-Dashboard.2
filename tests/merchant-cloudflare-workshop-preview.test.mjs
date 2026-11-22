// A Cloudflare-only hosted demo must not inherit the Vercel fake-order gate,
// merchant authorization, API routes, or production hostname capabilities.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const guard=read("../src/services/cloudflareWorkshopPreviewGuard.ts");
const component=read("../src/components/MerchantWorkshopDemo.tsx");
const vercel=read("../src/services/merchantPreviewSimulator.ts");
const shell=read("../preview/merchant-workshop/main.tsx");
const worker=read("../preview/merchant-workshop/worker.ts");
const config=read("../wrangler.merchant-workshop-preview.jsonc");
const html=read("../preview/merchant-workshop/index.html");
const vite=read("../preview/merchant-workshop/vite.config.ts");

test("original Merchant preview fake orders still require Vercel hostname and three flags",()=>{
  assert.match(vercel,/^local-eats-dashboard/mi);
  assert.match(vercel,/vercel\\.app/);
  assert.match(vercel,/VITE_MERCHANT_FAKE_ORDERS_ENABLED/);
  assert.match(vercel,/VITE_MERCHANT_PREVIEW_READ_ONLY/);
  assert.match(vercel,/VITE_PICKUP_ORDERING_ENABLED !== "true"/);
  assert.doesNotMatch(vercel,/workers\\.dev|cloudflareWorkshopPreviewGuard/);
});

test("Cloudflare worker strictly limited to exact dedicated hostname and preview env",()=>{
  assert.match(guard,/localeats-merchant-workshop-preview\.mehey9184\.workers\.dev/);
  assert.match(guard,/window\.location\.protocol === "https:"/);
  assert.match(guard,/window\.location\.hostname === CLOUDFLARE_WORKSHOP_HOST/);
  assert.match(guard,/VITE_MERCHANT_WORKSHOP_CLOUDFLARE_PREVIEW === "true"/);
  assert.match(guard,/VITE_MERCHANT_PREVIEW_READ_ONLY === "true"/);
  assert.match(guard,/VITE_PICKUP_ORDERING_ENABLED !== "true"/);
  assert.match(component,/isIsolatedCloudflareWorkshopPreviewEnabled/);
  assert.match(component,/isMerchantPreviewSimulatorEnabled\(\) \|\| isIsolatedCloudflareWorkshopPreviewEnabled\(\)/);
  assert.doesNotMatch(vercel,/localeats-merchant-workshop-preview/);
});

test("standalone Cloudflare fixture imports only real React workshop and simple CSS",()=>{
  assert.match(shell,/import \{MerchantWorkshopDemo\}/);
  assert.match(shell,/import \{isIsolatedCloudflareWorkshopPreviewEnabled\}/);
  assert.match(html,/noindex, nofollow, noarchive/);
  assert.doesNotMatch(shell,/import .*App|MerchantApi|Firebase|Supabase|OrderService|serviceWorker|initSentry/);
  assert.doesNotMatch(shell,/\bfetch\(|\baxios\.|\bsupabase\.|\bprint\(|\bNotification\(/);
  assert.match(vite,/dist-merchant-workshop/);
  assert.doesNotMatch(vite,/VitePWA|process\.env\.GEMINI_API_KEY|process\.env\.GOOGLE_MAPS_PLATFORM_KEY/);
});

test("separate Cloudflare Worker has no data bindings, blocks writes and isolates CSP",()=>{
  const cfg=config.replace(/^\s*\/\/.*$/gm,"");
  const parsed=JSON.parse(cfg);
  assert.equal(parsed.name,"localeats-merchant-workshop-preview");
  assert.equal(parsed.workers_dev,true);
  assert.equal(parsed.preview_urls,false);
  assert.equal(parsed.assets.binding,"ASSETS");
  assert.equal(parsed.assets.run_worker_first,true);
  assert.equal(parsed.assets.not_found_handling,"404-page");
  assert.deepEqual(parsed.routes,[]);
  assert.equal(Object.keys(parsed).some(k=>/(kv|r2|d1|hyperdrive|vars|secret|durable|queues|services)/i.test(k)),false);
  assert.match(worker,/if\(!\["GET","HEAD"\]\.includes\(request\.method\)\)/);
  assert.match(worker,/await env\.ASSETS\.fetch\(request\)/);
  assert.match(worker,/connect-src 'none'/);
  assert.match(worker,/frame-ancestors 'none'/);
  assert.match(worker,/form-action 'none'/);
  assert.match(worker,/Permissions-Policy/);
  assert.match(worker,/Cache-Control/);
  assert.doesNotMatch(worker,/fetch\(https|DATABASE_URL|SUPABASE_|FIREBASE_|API_KEY|service_role/);
});
