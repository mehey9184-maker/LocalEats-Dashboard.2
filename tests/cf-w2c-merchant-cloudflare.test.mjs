import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const main=read("src/main.tsx");
const app=read("src/App.tsx");
const guard=read("src/services/cloudflareMerchantPitchGate.ts");
const oldGuard=read("src/services/merchantPreviewSimulator.ts");
const fake=read("src/components/PreviewFakeOrders.tsx");
const vite=read("preview/merchant-pitch/vite.config.ts");
const worker=read("preview/merchant-pitch/worker.ts");
const cfg=JSON.parse(read("wrangler.merchant-pitch-preview.jsonc"));
const dummy=JSON.parse(read("preview/merchant-pitch/firebase-demo-config.json"));

test("the Cloudflare build uses actual App/Home/Orders rather than a replacement shell",()=>{
 assert.match(main,/import App from '\.\/App\.tsx'/);
 assert.match(app,/import \{ DashboardOverview \} from "\.\/components\/DashboardOverview"/);
 assert.match(app,/import \{ OrdersManagement \} from "\.\/components\/OrdersManagement"/);
 assert.match(app,/<DashboardOverview/);
 assert.match(app,/<OrdersManagement/);
 assert.match(app,/activeTab === "orders"/);
 assert.match(app,/activeTab === "dashboard"/);
 assert.doesNotMatch(main+vite,/WorkshopDemo|workshop\/main/);
 assert.match(vite,/dist-merchant-pitch/);
 assert.doesNotMatch(vite,/VitePWA|GEMINI_API_KEY|GOOGLE_MAPS_PLATFORM_KEY/);
});
test("only the exact isolated Cloudflare URL with all read-only flags enables demo login and fake simulator",()=>{
 assert.match(guard,/localeats-merchant-dashboard-preview\.mehey9184\.workers\.dev/);
 assert.match(guard,/window\.location\.protocol === "https:"/);
 assert.match(guard,/window\.location\.hostname === CF_MERCHANT_PITCH_HOST/);
 for(const v of ["VITE_MERCHANT_CF_DEMO_READ_ONLY","VITE_MERCHANT_PREVIEW_READ_ONLY","VITE_MERCHANT_FAKE_ORDERS_ENABLED","VITE_PICKUP_ORDERING_ENABLED"]){
  assert.match(guard,new RegExp(v));
 }
 assert.match(oldGuard,/isIsolatedCloudflareMerchantPitchPreviewEnabled\(\)/);
 assert.match(oldGuard,/local-eats-dashboard-2-6m8o/);
 assert.match(app,/registerVerifiedShopId\(CF_PITCH_DEMO_USER\.id,CF_PITCH_DEMO_SHOP\.id\)/);
 assert.match(app,/if\(isolatedPitch\)return; \/\/ Do not open a real Firebase\/Supabase user session/);
 assert.match(app,/if\(isolatedPitch\)return; \/\/ Only fictitious in-memory identity/);
 assert.match(app,/if\(isolatedPitch\)return; \/\/ Never fetch authenticated live merchant data/);
 assert.match(app,/if\(isolatedPitch\)\{\s*setOrders\(\[\]\)/);
 assert.match(guard,/example\.invalid/);
 assert.match(guard,/Fictional demonstration/);
});
test("Cloudflare worker permits static read-only assets only and blocks all app backend access",()=>{
 assert.equal(cfg.name,"localeats-merchant-dashboard-preview");
 assert.equal(cfg.workers_dev,true);
 assert.equal(cfg.preview_urls,false);
 assert.deepEqual(cfg.routes,[]);
 assert.equal(cfg.assets.binding,"ASSETS");
 assert.equal(cfg.assets.run_worker_first,true);
 assert.equal(cfg.assets.not_found_handling,"single-page-application");
 assert.deepEqual(Object.keys(cfg).filter(k=>/secret|kv|database|d1|r2|service|vars|durable/i.test(k)),[]);
 assert.match(worker,/connect-src 'none'/);
 assert.match(worker,/worker-src 'none'/);
 assert.match(worker,/form-action 'none'/);
 assert.match(worker,/if\(!\["GET","HEAD"\]\.includes\(request\.method\)\)/);
 assert.match(worker,/env\.ASSETS\.fetch\(request\)/);
 assert.doesNotMatch(worker,/fetch\("https|MerchantApi|Firebase|Supabase/);
 assert.equal(dummy.projectId,"localeats-fictional-demo");
 assert.match(vite,/firebase-demo-config\.json/);
 assert.match(worker,/X-Robots-Tag/);
});
test("existing order controls remain manual, fake and bounded",()=>{
 assert.match(fake,/Start simulation/);
 assert.match(fake,/Stop simulation/);
 assert.match(fake,/const arrivals=\[3,1,10,1,3,10\]/);
 assert.match(fake,/Math\.max\(0,18-awaiting\)/);
 assert.match(fake,/<PickupOrderActions order=\{order\} compact/);
 assert.match(fake,/pickupCommand\(order,action,extra\)/);
 assert.doesNotMatch(fake,/\bfetch\s*\(|\bMerchantApi\b|\blocalStorage\b|\bsupabase\b/);
});
