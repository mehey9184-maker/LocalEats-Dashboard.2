import test from "node:test";
import assert from "node:assert/strict";
import {
 assertControlledPickup,
 assertControlledPickupContinuation,
 canSubmitControlledPickup,
 CONTROLLED_PICKUP_SHOP,
} from "./controlledPickup.js";
import {OrderContractError} from "../orders/orderContract.js";

const NOW=new Date("2026-11-20T12:00:00Z");
const expiry="2026-11-28T12:00:00Z";
const allowed={shop_id:"shop-ivory-a",user_id:"firebase-cust-a"};
const existing={...allowed,delivery_type:"collection",create_intent_hash:"a".repeat(64)};

const ready=()=>({
 PICKUP_WRITES_ENABLED:"true",
 PICKUP_TEST_CUSTOMER_UID:"legacy-test-uid",
 PICKUP_BETA_ENABLED:"true",
 PICKUP_BETA_ADMISSION_ENABLED:"true",
 PICKUP_BETA_SHOP_IDS:"shop-ivory-a,shop-tembisa-b",
 PICKUP_BETA_CUSTOMER_UIDS:"firebase-cust-a,firebase-cust-b",
 PICKUP_BETA_EXPIRES_AT:expiry,
});
function reject(fn:()=>unknown,code:string){
 assert.throws(fn,(e:unknown)=>{
  assert.ok(e instanceof OrderContractError);
  assert.equal(e.code,code);
  assert.ok(!e.message.includes("firebase-cust-a"));
  return true;
 });
}

test("invited customer may create at either allowlisted shop only inside beta window",()=>{
 const config=ready();
 for(const shop_id of ["shop-ivory-a","shop-tembisa-b"])
  for(const user_id of ["firebase-cust-a","firebase-cust-b"]){
   assert.doesNotThrow(()=>assertControlledPickup({shop_id,user_id},config,NOW));
   assert.equal(canSubmitControlledPickup({shop_id,user_id},config,NOW),true);
  }
 for(const order of [
  {...allowed,shop_id:"uninvited-shop"},
  {...allowed,user_id:"uninvited-customer"},
  {shop_id:allowed.shop_id,user_id:undefined},
  {shop_id:allowed.shop_id,user_id:{"uid":"firebase-cust-a"}},
 ]){
  reject(()=>assertControlledPickup(order,config,NOW),"PICKUP_BETA_NOT_ALLOWED");
  assert.equal(canSubmitControlledPickup(order,config,NOW),false);
 }
});

test("global hard-off overrides both beta and legacy test UID",()=>{
 for(const flag of [undefined,"false","TRUE","1",""]){
  const config={...ready(),PICKUP_WRITES_ENABLED:flag};
  reject(()=>assertControlledPickup(allowed,config,NOW),"PICKUP_WRITES_DISABLED");
  reject(()=>assertControlledPickupContinuation(existing,config),"PICKUP_WRITES_DISABLED");
 }
});

test("new beta needs explicit independent admission switch",()=>{
 for(const mode of [undefined,"false","FALSE","1",""]){
  const config={...ready(),PICKUP_BETA_ADMISSION_ENABLED:mode};
  reject(()=>assertControlledPickup(allowed,config,NOW),"PICKUP_BETA_ADMISSION_PAUSED");
  assert.equal(canSubmitControlledPickup(allowed,config,NOW),false);
 }
});

test("bounded, exact UID and shop server lists fail closed on duplicates or malformed values",()=>{
 const cases=[
  {PICKUP_BETA_SHOP_IDS:"shop-ivory-a,shop-ivory-a"},
  {PICKUP_BETA_CUSTOMER_UIDS:"firebase-cust-a,firebase-cust-a"},
  {PICKUP_BETA_SHOP_IDS:"shop-ivory-a, shop-tembisa-b"},
  {PICKUP_BETA_SHOP_IDS:"shop-ivory-a,"},
  {PICKUP_BETA_SHOP_IDS:"shop-ivory-a\n"},
  {PICKUP_BETA_SHOP_IDS:"shop-ivory-a,shop-b,shop-c,shop-d"},
  {PICKUP_BETA_CUSTOMER_UIDS:Array.from({length:21},(_,i)=>"cust-"+i).join(",")},
  {PICKUP_BETA_CUSTOMER_UIDS:"firebase-cust-a,uid/other"},
  {PICKUP_BETA_SHOP_IDS:""},
  {PICKUP_BETA_CUSTOMER_UIDS:undefined},
  {PICKUP_BETA_SHOP_IDS:undefined},
 ];
 for(const variant of cases){
  const config={...ready(),...variant};
  reject(()=>assertControlledPickup(allowed,config,NOW),"PICKUP_BETA_CONFIGURATION_REQUIRED");
  assert.equal(canSubmitControlledPickup(allowed,config,NOW),false);
 }
});

test("beta requires a real UTC expiration in the next 30 days; expiry closes new admission",()=>{
 for(const expires of [undefined,"", "2026-11-20T11:59:59Z","2026-11-20T12:00:00Z",
  "2027-01-20T12:00:00Z","2026-02-30T00:00:00Z","2026-11-22",
  "2026-11-23T15:00:00+02:00","2026-11-23T15:00:00Z\n"]){
  const config={...ready(),PICKUP_BETA_EXPIRES_AT:expires};
  reject(()=>assertControlledPickup(allowed,config,NOW),"PICKUP_BETA_CONFIGURATION_REQUIRED");
 }
 assert.doesNotThrow(()=>assertControlledPickup(allowed,{...ready(),PICKUP_BETA_EXPIRES_AT:"2026-12-20T12:00:00Z"},NOW));
});

test("typo or partly configured beta cannot fall back to single-test UID",()=>{
 const legacy={shop_id:CONTROLLED_PICKUP_SHOP,user_id:"legacy-test-uid"};
 for(const config of [
  {...ready(),PICKUP_BETA_ENABLED:"TRUE"},
  {...ready(),PICKUP_BETA_ENABLED:"false"},
  {...ready(),PICKUP_BETA_ENABLED:undefined},
 ]){
  reject(()=>assertControlledPickup(legacy,config,NOW),"PICKUP_BETA_CONFIGURATION_REQUIRED");
 }
 const noBeta={PICKUP_WRITES_ENABLED:"true",PICKUP_TEST_CUSTOMER_UID:"legacy-test-uid"};
 assert.doesNotThrow(()=>assertControlledPickup(legacy,noBeta,NOW));
 reject(()=>assertControlledPickup(allowed,noBeta,NOW),"PICKUP_TEST_NOT_ALLOWED");
});

test("closing admission or changing cohort MUST NOT block an existing authorized pickup from being fulfilled",()=>{
 const configured=ready();
 for(const variant of [
  {PICKUP_BETA_ADMISSION_ENABLED:"false"},
  {PICKUP_BETA_EXPIRES_AT:"2026-11-19T12:00:00Z"},
  {PICKUP_BETA_CUSTOMER_UIDS:"different-customer"},
  {PICKUP_BETA_SHOP_IDS:"different-shop"},
 ]){
  const config={...configured,...variant};
  assert.equal(canSubmitControlledPickup(allowed,config,NOW),false);
  assert.doesNotThrow(()=>assertControlledPickupContinuation(existing,config));
 }
});

test("continuation requires a stored modern pickup, not an arbitrary legacy order",()=>{
 const config=ready();
 for(const order of [
  {...existing,delivery_type:"delivery"},
  {...existing,create_intent_hash:null},
  {...existing,create_intent_hash:"not-a-64-hex-intent"},
  {...existing,user_id:undefined},
  {...existing,shop_id:"unknown/shop"},
  {shop_id:allowed.shop_id,user_id:allowed.user_id},
 ]){
  reject(()=>assertControlledPickupContinuation(order,config),"PICKUP_BETA_EXISTING_ORDER_REQUIRED");
 }
});

test("default mode keeps earlier single-shop/single-UID safeguards intact for older acceptance tests",()=>{
 const config={PICKUP_WRITES_ENABLED:"true",PICKUP_TEST_CUSTOMER_UID:"legacy-test-uid"};
 const record={shop_id:CONTROLLED_PICKUP_SHOP,user_id:"legacy-test-uid"};
 assert.doesNotThrow(()=>assertControlledPickup(record,config,NOW));
 assert.doesNotThrow(()=>assertControlledPickupContinuation(record,config));
 reject(()=>assertControlledPickup({...record,user_id:"other"},config,NOW),"PICKUP_TEST_NOT_ALLOWED");
 reject(()=>assertControlledPickup(record,{...config,PICKUP_TEST_CUSTOMER_UID:undefined},NOW),"PICKUP_TEST_ALLOWLIST_REQUIRED");
});
