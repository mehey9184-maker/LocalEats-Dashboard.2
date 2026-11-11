import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
const api=readFileSync(new URL("../src/services/MerchantApi.ts",import.meta.url),"utf8");
const pickup=readFileSync(new URL("../src/components/PickupOrderActions.tsx",import.meta.url),"utf8");

test("merchant logout revokes the local authenticated installation before signout",()=>{
 assert.match(api,/static async revokePushDevice\(installationId:string\)/);
 assert.match(api,/method:"DELETE",headers:await getApiAuthHeaders\(\)/);
 const logout=app.slice(app.indexOf("const handleSignOut = async () => {"),app.indexOf("if (isSessionChecking || loading || !isAuthReady)"));
 assert.ok(logout.length>100 && logout.length<1800);
 assert.match(logout,/MerchantApi\.revokePushDevice\(installation\)/);
 assert.match(logout,/localeats-merchant-push-installation:/);
 assert.match(logout,/setTimeout\(resolve,1200\)/);
 assert.ok(logout.indexOf("revokePushDevice")<logout.indexOf("supabase.auth.signOut"),"revoke before losing authentication");
 assert.match(logout,/await supabase\.auth\.signOut\(\)/);
});

test("Ready but unpaid is not presented as a paid sale or completed handover",()=>{
 assert.match(pickup,/status==="ready_for_pickup" && order.payment_status==="unpaid"/);
 assert.match(pickup,/Ready · awaiting actual payment at the counter/);
 assert.match(pickup,/Do not mark Collected or count this as revenue until payment/);
 assert.match(pickup,/status==="ready_for_pickup" && order.payment_status==="paid"/);
 assert.match(pickup,/still awaiting physical handover/);
 assert.match(pickup,/Mark Collected only after the customer receives the food/);
 assert.doesNotMatch(pickup,/setInterval\(/);
 assert.doesNotMatch(pickup,/auto.*cancel.*unpaid/i);
});
\ntest("pickup chat is not misrepresented as working while secure order chat is unavailable",()=>{
 const orders=readFileSync(new URL("../src/components/OrdersManagement.tsx",import.meta.url),"utf8");
 assert.match(orders,/disabled=\{isPickupOrder\(order\)\}/);
 assert.match(orders,/Pickup chat is not yet connected/);
 assert.match(orders,/chatOrderId === order.id && !isPickupOrder\(order\)/);
});
