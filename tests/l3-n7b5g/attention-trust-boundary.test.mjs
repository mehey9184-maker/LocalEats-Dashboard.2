import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {pageForMerchantNotice} from "../../src/hooks/usePageNotificationAttention.ts";

test("each notice topic targets only its original navigation page",()=>{
 assert.deepEqual(
   ["new_order","inventory_low","rider","marketing","payment","settings"].map(pageForMerchantNotice),
   ["orders","menu","riders","marketing","payments","settings"]
 );
});
test("verified order freshness must match the authenticated current shop scope",()=>{
 const source=readFileSync(new URL("../../src/App.tsx",import.meta.url),"utf8");
 assert.match(source,/orderReadStatus\.scope===orderReadScope && orderReadStatus\.state==="fresh"/);
 assert.match(source,/setOrderReadStatus\(\{scope:orderReadScope,state:"fresh",lastSuccessAt:Date\.now\(\)\}\)/);
 assert.match(source,/setOrderReadStatus\(\{scope:orderReadScope,state:"unverified",lastSuccessAt:null\}\)/);
 assert.match(source,/menuReadStatus\.scope===menuReadScope && menuReadStatus\.state==="ready"/);
});
test("attention remains presentation-only with scoped callbacks and no notification mutation",()=>{
 const source=readFileSync(new URL("../../src/hooks/usePageNotificationAttention.ts",import.meta.url),"utf8");
 assert.match(source,/scopeRef\.current!==scope/);
 assert.match(source,/old\.scope!==scope/);
 assert.match(source,/ordersFresh/);
 assert.match(source,/menuFresh/);
 assert.match(source,/ANIMATION_MS=1150/);
 assert.match(source,/prefers-reduced-motion: reduce/);
 assert.doesNotMatch(source,/(fetch\(|\.insert\(|\.update\(|sendNotification|acknowledgeNotification|markAsRead|requestPermission)/);
});
