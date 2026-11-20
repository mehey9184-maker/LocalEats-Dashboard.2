import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("legacy initial fixture read is postponed and canceled with generation guard",()=>{
 const source=readFileSync(new URL("../l3-n6/fixture-entry.tsx",import.meta.url),"utf8");
 assert.match(source,/const initialRead=window\.setTimeout\(\(\)=>\{void load\(\);\},0\)/);
 assert.match(source,/window\.clearTimeout\(initialRead\)/);
 assert.match(source,/\+\+generation\.current/);
 assert.match(source,/window\.removeEventListener\("merchant-pickup-order-confirmed",handler\)/);
 assert.match(source,/if\(request!==generation\.current \|\| auth\.currentUser\?\.uid!==owner\)return/);
 assert.match(source,/setFixtureUid\(next\);setUid\(next\)/);
 assert.doesNotMatch(source,/\n  void load\(\);\n  return\(\)=>/);
});

test("active Home and onboarding remain intact across isolated Rider source cleanup",()=>{
 const source=readFileSync(new URL("../../src/components/DashboardOverview.tsx",import.meta.url),"utf8");
 for(const marker of [
  "export const DashboardOverview:",
  "const OnboardingChecklist =",
  "pickupHomeOrders",
  "pickupReadyCount",
  "onNavigate"
 ])assert(source.includes(marker),`Active Home contract missing: ${marker}`);
 // Historical components are optional across review branches. L3-N7B5I's
 // separate parent-vs-candidate browser comparison proves their removal has
 // no rendered Home impact; do not require them here.
});

test("isolated legacy fixture does not contain host-authoritative order writes",()=>{
 const source=readFileSync(new URL("../l3-n6/fixture-entry.tsx",import.meta.url),"utf8");
 assert.match(source,/MerchantApi\.getOrders\(\)/);
 assert.doesNotMatch(source,/MerchantApi\.(?:transitionPickupOrder|confirmPayment|updateOrder|acceptOrder)/);
 assert.doesNotMatch(source,/fetch\(|sendNotification|requestPermission|navigator\.serviceWorker\.register/);
});
