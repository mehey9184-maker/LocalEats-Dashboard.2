import test from "node:test";
import assert from "node:assert/strict";
import {createCustomerPushTestService,customerPushTestEnabled,customerPushTestAllowUser} from "./customerPushTest.js";
const uid="synthetic-customer";
const device="550e8400-e29b-41d4-a716-446655440000";
const token="synthetic-fcm-token-"+"x".repeat(24);
const make=(overrides:Record<string,unknown>={})=>{
  const events:string[]=[];
  const d={
    enabled:()=>true,allowUser:(x:string)=>x===uid,
    findOwnedActiveDevice:async(x:string,id:string)=>x===uid&&id===device?token:null,
    claimQuota:async()=>true,
    send:async(t:string,id:string)=>{assert.equal(t,token);assert.match(id,/^[0-9a-f-]{36}$/);events.push(id);},
    ...overrides
  };
  return {call:createCustomerPushTestService(d),events};
};
test("diagnostic sends only to the account-owned registered installation",async()=>{
  const {call,events}=make();
  assert.deepEqual(await call(uid,device),{status:202,code:"FCM_ACCEPTED_NOT_DEVICE_DELIVERED"});
  assert.equal(events.length,1);
  assert.equal((await call("other",device)).status,403);
  assert.equal((await call(uid,"550e8400-e29b-41d4-a716-446655440001")).status,404);
  assert.equal(events.length,1);
});
test("fail closed: off, malformed ID, cross-account and revoked device",async()=>{
  const off=make({enabled:()=>false});assert.equal((await off.call(uid,device)).status,503);
  const basic=make();assert.equal((await basic.call(uid,"bad-id")).status,400);
  assert.equal((await basic.call("",device)).status,400);
  assert.equal((await basic.call("other",device)).status,403);
  assert.equal(basic.events.length,0);
  const revoked=make({findOwnedActiveDevice:async()=>null});
  assert.equal((await revoked.call(uid,device)).status,404);
});
test("atomic distributed quota must claim BEFORE any send, including simultaneous attempts",async()=>{
  let claims=0,allowed=false;
  const {call,events}=make({claimQuota:async()=>{claims++;if(allowed)return false;allowed=true;return true;}});
  const outcomes=await Promise.all([call(uid,device),call(uid,device)]);
  assert.deepEqual(outcomes.map(x=>x.status).sort(),[202,429]);assert.equal(events.length,1);
  assert.equal(claims,2);
});
test("database outage and provider failure never imply delivery",async()=>{
  const db=make({claimQuota:async()=>{throw Error("fixture SQL outage");}});
  assert.equal((await db.call(uid,device)).status,503);assert.equal(db.events.length,0);
  const fcm=make({send:async()=>{throw Error("fixture FCM rejected");}});
  assert.deepEqual(await fcm.call(uid,device),{status:503,code:"TEST_FCM_UNAVAILABLE"});
});
test("enabled only on explicit isolated Vercel Preview with separate Supabase host",()=>{
  const env:NodeJS.ProcessEnv={CUSTOMER_PUSH_TEST_ENABLED:"true",CUSTOMER_PUSH_TEST_ISOLATED:"true",
    CUSTOMER_PUSH_TEST_STAGING_SUPABASE_HOST:"isolated-preview.supabase.co",
    LOCALEATS_STAGING_ONLY:"true",FIREBASE_PROJECT_ID:"localeats-staging-fixture",
    CUSTOMER_PUSH_TEST_STAGING_FIREBASE_PROJECT_ID:"localeats-staging-fixture",
    FIREBASE_CLIENT_EMAIL:"fixture@localeats-staging-fixture.iam.gserviceaccount.com",
    SUPABASE_URL:"https://isolated-preview.supabase.co",VERCEL_ENV:"preview",PICKUP_WRITES_ENABLED:"false",
    CUSTOMER_PUSH_TEST_UIDS:"synthetic-customer, another"};
  assert.equal(customerPushTestEnabled(env),true);
  assert.equal(customerPushTestEnabled({...env,FIREBASE_PROJECT_ID:"localeats-5e26e"}),false);
  assert.equal(customerPushTestEnabled({...env,FIREBASE_CLIENT_EMAIL:"fixture@other-project.iam.gserviceaccount.com"}),false);
  assert.equal(customerPushTestEnabled({...env,LOCALEATS_STAGING_ONLY:"false"}),false);
  assert.equal(customerPushTestEnabled({...env,PICKUP_WRITES_ENABLED:undefined}),false);
  for(const [key,value] of Object.entries({VERCEL_ENV:"production",CUSTOMER_PUSH_TEST_ISOLATED:"false",CUSTOMER_PUSH_TEST_ENABLED:"false",PICKUP_WRITES_ENABLED:"true",CUSTOMER_PUSH_TEST_STAGING_SUPABASE_HOST:"production.supabase.co",FIREBASE_PROJECT_ID:"localeats-5e26e"})){
    assert.equal(customerPushTestEnabled({...env,[key]:value}),false,key);
  }
  assert.equal(customerPushTestAllowUser(uid,env),true);
  assert.equal(customerPushTestAllowUser("stranger",env),false);
  assert.equal(customerPushTestAllowUser(uid,{...env,CUSTOMER_PUSH_TEST_UIDS:""}),false);
});
