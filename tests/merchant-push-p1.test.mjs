import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sw=read("public/firebase-messaging-sw.js");
const cfg=JSON.parse(read("firebase-applet-config.json"));
const sdk=read("src/lib/firebase.ts");
const hook=read("src/hooks/usePushNotifications.ts");
const api=read("src/services/MerchantApi.ts");
const app=read("src/App.tsx");
const route=read("localeats-api/src/routes/orders.ts");
const tokenRoute=read("localeats-api/src/routes/pickupNotifications.ts");
const delivery=read("localeats-api/src/orders/merchantPush.ts");

test("merchant FCM worker uses complete public configuration and one background notice",()=>{
 const seen={};
 const ctx={
  self:{location:{origin:"https://dashboard.localeatssa.co.za"},
    addEventListener:(name,handler)=>{seen[name]=handler;},
    registration:{showNotification:(title,options)=>{seen.alert={title,options};}}},
  importScripts:()=>{},URL,clients:{matchAll:async()=>[],openWindow:async()=>{}},
  firebase:{initializeApp:cfg=>{seen.config=cfg;},messaging:()=>({
    onBackgroundMessage:fn=>{seen.onPush=fn;}
  })}
 };
 vm.runInNewContext(sw,ctx);
 for(const key of ["apiKey","appId","projectId","messagingSenderId"]){
  assert.ok(seen.config[key]);assert.equal(seen.config[key],cfg[key]);
 }
 seen.onPush({data:{type:"pickup_new_order",order_id:"synthetic-id"}});
 assert.equal(seen.alert.title,"New pickup order received");
 assert.equal(seen.alert.options.data.type,"pickup_new_order");
 assert.ok(!seen.alert.options.body.includes("synthetic-id"));
 seen.alert=null;
 seen.onPush({notification:{title:"FCM already displayed"},data:{type:"pickup_new_order"}});
 assert.equal(seen.alert,null);
 seen.onPush({data:{type:"untrusted_announcement"}});
 assert.equal(seen.alert,null);
 assert.match(sw,/notificationclick/);
 assert.match(sw,/new URL\('\/',self\.location\.origin\)/);
});
test("merchant push registration never takes over PWA or reports success on OS permission alone",()=>{
 assert.match(sdk,/scope:"\/firebase-cloud-messaging-push-scope\/"/);
 assert.match(sdk,/if \(!activeVapidKey\) return null/);
 assert.match(hook,/VITE_FIREBASE_VAPID_KEY/);
 assert.match(hook,/await MerchantApi\.registerPushDevice\(installation,token\)/);
 assert.match(hook,/if\(!saved\)\{/);
 assert.match(hook,/if\(auth\.currentUser\?\.uid!==userId \|\| sequence\.current!==epoch\)return;/);
 assert.match(hook,/setPushEnabled\(true\)/);
 assert.doesNotMatch(hook,/\.from\(['"]push_subscriptions['"]\)/);
 assert.match(api,/this\.getMerchantShop\(\)/);
 assert.match(api,/getApiAuthHeaders\(\)/);
 assert.match(api,/\/api\/v1\/push-subscriptions\//);
});
test("new pending IDs alert even if the pending count stays unchanged",()=>{
 assert.match(app,/notifiedPendingOrders/);
 assert.match(app,/const newIds=\[\.\.\.pendingIds\]\.filter\(id=>!known\.has\(id\)\)/);
 assert.match(app,/String\(o\.shop_id\)===String\(currentShop\?\.id\)/);
 assert.match(app,/merchantShopGate\.status === "ready"/);
 assert.match(app,/document\.visibilityState === "visible" && navigator\.onLine/);
 assert.match(app,/setInterval\(refreshVisibleOrders, 15000\)/);
 assert.match(app,/pickup_new_order/);
 assert.match(app,/void fetchOrders\(\)/);
});
test("merchant push is best-effort after committed creation and never on idempotent replay",()=>{
 assert.match(route,/const result = await createPickup\(/);
 assert.match(route,/if \(!result\.replayed\) \{\s*await tryMerchantPickupPush/);
 assert.match(delivery,/if\(replayed \|\| !order/);
 assert.match(delivery,/Promise\.allSettled/);
 assert.match(delivery,/findOwner/);
 assert.match(delivery,/findTokens/);
 assert.match(delivery,/TTL:"600",Urgency:"high"/);
});
test("push token reassigns a browser safely on account switch, no notification token is logged",()=>{
 assert.match(tokenRoute,/update\(\{revoked_at:new Date\(\)\.toISOString\(\),fcm_token:null\}\)/);
 assert.match(tokenRoute,/\.eq\("fcm_token",body\.fcm_token\)\.neq\("installation_id",installation\)/);
 assert.match(tokenRoute,/upsert\(\{user_id:uid,installation_id:installation/);
 assert.doesNotMatch(tokenRoute,/console\.log\(body\.fcm_token\)/);
});
