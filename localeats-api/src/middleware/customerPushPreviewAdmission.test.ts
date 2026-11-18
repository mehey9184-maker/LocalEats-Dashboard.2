import test from "node:test";
import assert from "node:assert/strict";
import {canUseIsolatedCustomerPushPreview, isIsolatedCustomerPushCorsOrigin} from "./customerPushPreviewAdmission.js";
import {isAllowedOrigin} from "../corsOrigins.js";
import {previewReadOnlyGate} from "./previewReadOnlyGate.js";

const origin="https://localeats-customer-staging-r52d-keircl09f.vercel.app";
const uuid="550e8400-e29b-41d4-a716-446655440000";
const stage:NodeJS.ProcessEnv={
 VERCEL_ENV:"preview",LOCALEATS_STAGING_ONLY:"true",PICKUP_WRITES_ENABLED:"false",
 CUSTOMER_PUSH_TEST_ENABLED:"true",CUSTOMER_PUSH_TEST_ISOLATED:"true",
 CUSTOMER_PUSH_TEST_UIDS:"synthetic-uid",
 CUSTOMER_PUSH_TEST_STAGING_ORIGIN:origin,
 CUSTOMER_PUSH_TEST_STAGING_SUPABASE_HOST:"rgpbdajhlrwfmhopzgzk.supabase.co",
 SUPABASE_URL:"https://rgpbdajhlrwfmhopzgzk.supabase.co",
 FIREBASE_PROJECT_ID:"localeats-staging",
 CUSTOMER_PUSH_TEST_STAGING_FIREBASE_PROJECT_ID:"localeats-staging",
 FIREBASE_CLIENT_EMAIL:"fixture@localeats-staging.iam.gserviceaccount.com"
};
const req=(method:string,path:string,reqOrigin=origin)=>({method,path,headers:{origin:reqOrigin}}) as never;
const subscription="/api/v1/push-subscriptions/"+uuid;
const diagnostic="/api/v1/customer-push-subscriptions/"+uuid+"/test";

test("strict staging-only device routes are the only Preview mutations accepted",()=>{
 for(const [method,path] of [["PUT",subscription],["DELETE",subscription],["POST",diagnostic]]){
  assert.equal(canUseIsolatedCustomerPushPreview(req(method,path),stage),true,method+path);
 }
 for(const [method,path] of [["POST","/api/v1/orders"],["POST","/api/v1/profiles"],["POST",subscription],["PUT",diagnostic],["POST","/api/v1/push-subscriptions/"+uuid+"/test"],["PUT","/api/v1/push-subscriptions/invalid-id"],["GET","/api/v1/notifications"]]){
  assert.equal(canUseIsolatedCustomerPushPreview(req(method,path),stage),false,method+path);
 }
});
test("fail closed on disabled test, Production, shared DB, wrong Firebase identity or origin",()=>{
 const bad:NodeJS.ProcessEnv[]=[
  {...stage,CUSTOMER_PUSH_TEST_ENABLED:"false"},
  {...stage,CUSTOMER_PUSH_TEST_ISOLATED:"false"},
  {...stage,CUSTOMER_PUSH_TEST_UIDS:""},
  {...stage,VERCEL_ENV:"production"},
  {...stage,LOCALEATS_STAGING_ONLY:"false"},
  {...stage,LOCALEATS_PREVIEW_READ_ONLY:"true"},
  {...stage,PICKUP_WRITES_ENABLED:"true"},
  {...stage,SUPABASE_URL:"https://phdjumtqkooyppxozqsi.supabase.co"},
  {...stage,FIREBASE_PROJECT_ID:"localeats-5e26e"},
  {...stage,FIREBASE_CLIENT_EMAIL:"fixture@localeats-5e26e.iam.gserviceaccount.com"},
  {...stage,CUSTOMER_PUSH_TEST_STAGING_ORIGIN:"https://project-x7cvt.vercel.app"}
 ];
 for(const env of bad){
  assert.equal(canUseIsolatedCustomerPushPreview(req("POST",diagnostic),env),false,JSON.stringify(Object.keys(env)));
 }
 assert.equal(canUseIsolatedCustomerPushPreview(req("POST",diagnostic,"https://other-preview.vercel.app"),stage),false);
 assert.equal(canUseIsolatedCustomerPushPreview(req("PUT",subscription,"https://localeatssa.co.za"),stage),false);
});
test("CORS admits exactly configured staging Customer Preview if sender is enabled",()=>{
 assert.equal(isIsolatedCustomerPushCorsOrigin(origin,stage),true);
 assert.equal(isAllowedOrigin(origin,stage),true);
 assert.equal(isAllowedOrigin("https://other.vercel.app",stage),false);
 assert.equal(isIsolatedCustomerPushCorsOrigin(origin,{...stage,CUSTOMER_PUSH_TEST_ENABLED:"false"}),false);
 assert.equal(isIsolatedCustomerPushCorsOrigin("https://localeatssa.co.za",stage),false);
});
test("Preview middleware never removes generic write barrier; enablement is explicit",()=>{
 const orig=process.env;
 try{
  process.env={...orig,...stage};
  let admitted=false;
  let statusCode=0;
  const fakeResponse={
    status(n:number){statusCode=n;return this;},
    set(){return this;},
    json(){return this;}
  };
  const invoke=(method:string,path:string)=>{
    admitted=false;statusCode=0;
    previewReadOnlyGate(req(method,path),fakeResponse as never,()=>{admitted=true;});
    return {admitted,statusCode};
  };
  assert.deepEqual(invoke("POST",diagnostic),{admitted:true,statusCode:0});
  assert.deepEqual(invoke("PUT",subscription),{admitted:true,statusCode:0});
  assert.deepEqual(invoke("POST","/api/v1/orders"),{admitted:false,statusCode:503});
  assert.deepEqual(invoke("POST","/api/v1/push-subscriptions/"+uuid+"/test"),{admitted:false,statusCode:503});
  process.env.CUSTOMER_PUSH_TEST_ENABLED="false";
  assert.deepEqual(invoke("POST",diagnostic),{admitted:false,statusCode:503});
 }finally{process.env=orig;}
});

test("one exact Customer Preview origin may read isolated staging API without enabling test sends",()=>{
 const paired="https://localeats-customer-staging-r52d-mejyo1nm2.vercel.app";
 const off:NodeJS.ProcessEnv={
  VERCEL_ENV:"preview",LOCALEATS_STAGING_ONLY:"true",PICKUP_WRITES_ENABLED:"false",
  FIREBASE_PROJECT_ID:"localeats-staging",
  SUPABASE_URL:"https://rgpbdajhlrwfmhopzgzk.supabase.co",
  CUSTOMER_PUSH_TEST_ENABLED:"false"
 };
 assert.equal(isAllowedOrigin(paired,off),true);
 assert.equal(isAllowedOrigin("https://localeats-customer-staging-r52d-other.vercel.app",off),false);
 for(const negative of [
  {...off,VERCEL_ENV:"production"},
  {...off,LOCALEATS_STAGING_ONLY:"false"},
  {...off,PICKUP_WRITES_ENABLED:"true"},
  {...off,FIREBASE_PROJECT_ID:"localeats-5e26e"},
  {...off,SUPABASE_URL:"https://phdjumtqkooyppxozqsi.supabase.co"}
 ])assert.equal(isAllowedOrigin(paired,negative),false);
 assert.equal(canUseIsolatedCustomerPushPreview(req("POST",diagnostic,paired),off),false);
});
