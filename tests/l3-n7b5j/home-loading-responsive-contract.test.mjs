import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../../src/components/DashboardOverview.tsx",import.meta.url),"utf8");
const start=source.indexOf("if (loading) {");
const end=source.indexOf("  return (\n    <div",start+1);
assert(start>=0&&end>start,"Explicit loading skeleton boundary must exist");
const loading=source.slice(start,end);
test("Home loading header alone wraps at mobile while retaining original desktop row",()=>{
 assert.match(loading,/flex flex-wrap items-start justify-between gap-4 sm:flex-nowrap sm:gap-0/);
 assert.equal((loading.match(/sm:flex-nowrap/g)||[]).length,1);
 for(const original of [
  'h-10 w-64 md:w-80 rounded-xl','h-4 w-48 md:w-64',
  'h-10 w-10 md:w-24 rounded-xl','h-10 w-10 rounded-xl',
  'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6',
  'grid grid-cols-1 lg:grid-cols-12 gap-8',
  'h-96 rounded-[2.5rem]'
 ]) assert(loading.includes(original),`Original placeholder lost: ${original}`);
});
test("pickup Home and verified owner actions remain outside loading skeleton",()=>{
 for(const token of [
  "export const DashboardOverview","pickupHomeOrders","pickupReadyCount",
  "orderReadState!==\"fresh\"","OnboardingChecklist","Sync & Verify Store Ownership",
  "Set All Offline","Ready for pickup","onNavigate"
 ])assert(source.includes(token),`Original Home feature changed: ${token}`);
 assert.doesNotMatch(loading,/(?:fetch\(|\.update\(|transitionPickupOrder|requestPermission)/);
});
