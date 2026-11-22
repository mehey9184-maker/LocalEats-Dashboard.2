import test from "node:test";
import assert from "node:assert/strict";
import {assertControlledPickup,CONTROLLED_PICKUP_SHOP} from "./controlledPickup.js";
const record={shop_id:CONTROLLED_PICKUP_SHOP,user_id:"fixture-customer"};
const env={PICKUP_WRITES_ENABLED:"true",PICKUP_TEST_CUSTOMER_UID:"fixture-customer"};
test("exact designated shop and configured customer pass",()=>assert.doesNotThrow(()=>assertControlledPickup(record,env)));
test("wrong shop/customer denied even with the global switch enabled",()=>{
 for(const order of [{...record,shop_id:"other"},{...record,user_id:"other"},{shop_id:CONTROLLED_PICKUP_SHOP}])assert.throws(()=>assertControlledPickup(order,env),(e:any)=>e.code==="PICKUP_TEST_NOT_ALLOWED");
});
test("missing or malformed test identity is default-deny and not disclosed",()=>{
 for(const uid of [undefined,""," ","fixture-customer ","a".repeat(129),"fixture\ncustomer"]){const config={...env,PICKUP_TEST_CUSTOMER_UID:uid};assert.throws(()=>assertControlledPickup(record,config),(e:any)=>e.code==="PICKUP_TEST_ALLOWLIST_REQUIRED" && !e.message.includes("fixture-customer"));}
});
test("global switch remains required",()=>{
 for(const flag of [undefined,"false","1","TRUE"])assert.throws(()=>assertControlledPickup(record,{...env,PICKUP_WRITES_ENABLED:flag}),(e:any)=>e.code==="PICKUP_WRITES_DISABLED");
});

const pilotNow=Date.parse("2026-11-22T09:00:00.000Z");
const pilotEnv={
 PICKUP_WRITES_ENABLED:"true",
 PICKUP_PUBLIC_PILOT_ENABLED:"true",
 PICKUP_PUBLIC_PILOT_SHOP_ID:CONTROLLED_PICKUP_SHOP,
 PICKUP_PUBLIC_PILOT_EXPIRES_AT:"2026-11-23T09:00:00.000Z",
};
test("explicit 24-hour first-shop pilot accepts distinct real customer UIDs only at My-Kota",()=>{
 for(const uid of ["real-customer-one","real-customer-two","8HxPtemXNUU7DXCA6rja3ehwYh02"]){
  assert.doesNotThrow(()=>assertControlledPickup({shop_id:CONTROLLED_PICKUP_SHOP,user_id:uid},pilotEnv,pilotNow));
 }
 for(const input of [{shop_id:"test-other-shop",user_id:"real-customer-one"},
                     {shop_id:CONTROLLED_PICKUP_SHOP,user_id:""},
                     {shop_id:CONTROLLED_PICKUP_SHOP,user_id:"bad uid"},
                     {shop_id:CONTROLLED_PICKUP_SHOP,user_id:undefined}]){
  assert.throws(()=>assertControlledPickup(input,pilotEnv,pilotNow),(e:any)=>e.code==="PICKUP_PILOT_NOT_ALLOWED");
 }
});

test("pilot config fails closed if no exact shop, invalid expiry, expired, or over 7 days",()=>{
 const input={shop_id:CONTROLLED_PICKUP_SHOP,user_id:"real-customer-one"};
 for(const shop of [undefined,"test-shop","shop-my-kota-ivory-park "]){
  assert.throws(()=>assertControlledPickup(input,{...pilotEnv,PICKUP_PUBLIC_PILOT_SHOP_ID:shop},pilotNow),
   (e:any)=>e.code==="PICKUP_PUBLIC_PILOT_SHOP_INVALID");
 }
 for(const until of [undefined,"","tomorrow","2026-11-21T09:00:00.000Z","2026-11-22T09:00:00.000Z",
   "2026-12-01T09:00:00.000Z","2026-11-25T09:00:00+00:00"]){
  assert.throws(()=>assertControlledPickup(input,{...pilotEnv,PICKUP_PUBLIC_PILOT_EXPIRES_AT:until},pilotNow),
   (e:any)=>e.code==="PICKUP_PUBLIC_PILOT_EXPIRED");
 }
 assert.throws(()=>assertControlledPickup(input,pilotEnv,Date.parse("2026-11-23T09:00:00.000Z")),
  (e:any)=>e.code==="PICKUP_PUBLIC_PILOT_EXPIRED");
});

test("pilot still requires global write gate and never enables other shops",()=>{
 const input={shop_id:CONTROLLED_PICKUP_SHOP,user_id:"new-person"};
 for(const enabled of [undefined,"false","TRUE","1"]){
  assert.throws(()=>assertControlledPickup(input,{...pilotEnv,PICKUP_WRITES_ENABLED:enabled},pilotNow),
   (e:any)=>e.code==="PICKUP_WRITES_DISABLED");
 }
 assert.throws(()=>assertControlledPickup({shop_id:"another-real-shop",user_id:"new-person"},pilotEnv,pilotNow),
  (e:any)=>e.code==="PICKUP_PILOT_NOT_ALLOWED");
});

test("public pilot never alters single-invited-customer acceptance when disabled",()=>{
 const testConfig={...env,PICKUP_PUBLIC_PILOT_ENABLED:"false"};
 assert.doesNotThrow(()=>assertControlledPickup(record,testConfig,pilotNow));
 assert.throws(()=>assertControlledPickup({...record,user_id:"other"},testConfig,pilotNow),
  (e:any)=>e.code==="PICKUP_TEST_NOT_ALLOWED");
});

test("real order creation explicitly rejects anonymous identities before any write",async()=>{
 const {readFileSync}=await import("node:fs");
 const source=readFileSync(new URL("../routes/orders.js",import.meta.url),"utf8");
 const handler=source.slice(source.indexOf('router.post("/", authenticateFirebase,'),source.indexOf('router.get("/", authenticateFirebase,'));
 assert.match(handler,/req[.]authUser[?][.]isAnonymous/);
 assert.ok(handler.indexOf("isAnonymous")<handler.indexOf("assertPickupWritesDisabled"));
});
