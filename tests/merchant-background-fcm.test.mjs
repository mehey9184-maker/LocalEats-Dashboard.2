import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path)=>readFileSync(new URL(path,import.meta.url),"utf8");
const app=read("../src/App.tsx"),api=read("../src/services/MerchantApi.ts");
const worker=read("../src/sw.ts"),firebase=read("../src/lib/firebase.ts");
const device=read("../src/services/merchantPushDevice.ts");
test("Merchant subscription requires user gesture and API persistence before success",()=>{
 assert.match(app,/const enableMerchantPush=useCallback/);
 assert.match(app,/onClick=\{\(\)=>\{void enableMerchantPush\(\);\}\}/);
 assert.match(app,/await MerchantApi\.subscribePush\(merchantPushInstallation\(uid\),token\)/);
 assert.match(app,/setMerchantPushStatus\("enabled"\)/);
 assert.match(app,/firebaseAuth\.currentUser\?\.uid!==uid/);
 assert.match(api,/getApiAuthHeaders\(\)/);
 assert.match(api,/method:"PUT"/);
 assert.match(api,/\/api\/v1\/merchant\/push-subscriptions\//);
 assert.doesNotMatch(app,/usePushNotifications\(false\)/);
 assert.match(device,/merchant-push-installation/);
});
test("Only FCM data packets wake API refresh, not make up order truth",()=>{
 assert.match(app,/onForegroundMessage\(payload=>/);
 assert.match(app,/payload\.data\?\.type==="merchant_new_order"/);
 assert.match(app,/window\.addEventListener\("localeats-merchant-push-wake",refresh\)/);
 assert.match(app,/const data = await MerchantApi\.getOrders\(\)/);
 assert.match(app,/merchantOrderArrivals\(apiOrders,ownerId,shopId,confirmedOrderCursorRef.current\)/);
 assert.match(worker,/packet\.data\?\.type==="merchant_new_order"/);
 assert.match(worker,/A customer placed an order/);
 assert.doesNotMatch(worker,/customer_name|phone_number|customer_phone/);
});
test("Merchant push uses actual compiled service worker and signed-out device revocation",()=>{
 assert.match(firebase,/getRegistration\("\/"\)/);
 assert.match(firebase,/register\("\/sw\.js"/);
 assert.doesNotMatch(firebase,/register\("\/firebase-messaging-sw\.js"/);
 assert.match(app,/MerchantApi\.revokePush\(installation\)/);
 assert.match(api,/method:"DELETE"/);
});
