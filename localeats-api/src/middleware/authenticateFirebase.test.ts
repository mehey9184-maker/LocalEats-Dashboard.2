import test from "node:test";
import assert from "node:assert/strict";
import type {Response, NextFunction} from "express";
import {
  makeAuthenticateFirebase,
  getFirebaseBearerToken,
  type AuthenticatedRequest,
} from "./authenticateFirebase.js";

function fakeRequest(authorization?: string) {
  const req = {headers:{authorization}} as AuthenticatedRequest;
  const record:{status?:number; body?:unknown; nextCalls:number}={nextCalls:0};
  const res = {
    status(value:number){record.status=value; return this;},
    json(value:unknown){record.body=value;return this;},
  } as unknown as Response;
  const next:NextFunction=(()=>{record.nextCalls++;}) as NextFunction;
  return {req,res,next,record};
}

test("valid Firebase bearer uses revocation check=true and binds verified UID",async()=>{
  const seen:{token?:string;revoked?:boolean}={};
  const handler=makeAuthenticateFirebase(async(token,checkRevoked)=>{
    seen.token=token;seen.revoked=checkRevoked;
    return {uid:"test-valid-uid",email:"shop@example.test",firebase:{sign_in_provider:"password"}};
  });
  const t=fakeRequest("Bearer fb-synthetic-token");
  await handler(t.req,t.res,t.next);
  assert.deepEqual(seen,{token:"synthetic-token",revoked:true});
  assert.equal(t.record.nextCalls,1);
  assert.equal(t.record.status,undefined);
  assert.deepEqual(t.req.authUser,{uid:"test-valid-uid",email:"shop@example.test",isAnonymous:false});
});

test("revoked and disabled users are denied even if token otherwise decodes",async()=>{
  for(const label of ["revoked","disabled","verifier unavailable"]){
    const handler=makeAuthenticateFirebase(async()=>{throw Error(label)});
    const t=fakeRequest("Bearer fb-untrusted-token");
    await handler(t.req,t.res,t.next);
    assert.equal(t.record.status,401,label);
    assert.equal(t.record.nextCalls,0,label);
    assert.equal(t.req.authUser,undefined);
    assert.deepEqual(t.record.body,{success:false,error:"Unauthorized"});
  }
});

test("bearer format, empty, oversized and raw UID are rejected before verifier",async()=>{
  let verified=0;
  const handler=makeAuthenticateFirebase(async()=>{verified++;return {uid:"user"}});
  const invalid=[
    undefined,
    "Bearer raw-uid",
    "Bearer fb-",
    "fb-any",
    "Bearer fb-"+("x".repeat(8193)),
  ];
  for(const authorization of invalid){
    const t=fakeRequest(authorization);
    await handler(t.req,t.res,t.next);
    assert.equal(t.record.status,401,String(authorization?.slice(0,20)));
    assert.equal(t.record.nextCalls,0);
  }
  assert.equal(verified,0);
  assert.equal(getFirebaseBearerToken("Bearer raw-uid"),null);
});

test("invalid UID claims cannot acquire API identity",async()=>{
  for(const uid of ["", "bad/path","bad\\path","bad\nuid","x".repeat(129),undefined]){
    const handler=makeAuthenticateFirebase(async()=>({uid}));
    const t=fakeRequest("Bearer fb-test");
    await handler(t.req,t.res,t.next);
    assert.equal(t.record.status,401);
    assert.equal(t.record.nextCalls,0);
    assert.equal(t.req.authUser,undefined);
  }
});

test("anonymous identity is identified, without gaining merchant role",async()=>{
  const handler=makeAuthenticateFirebase(async()=>({uid:"anon-uid",firebase:{sign_in_provider:"anonymous"}}));
  const t=fakeRequest("Bearer fb-anon");
  await handler(t.req,t.res,t.next);
  assert.equal(t.record.nextCalls,1);
  assert.deepEqual(t.req.authUser,{uid:"anon-uid",email:null,isAnonymous:true});
});

test("missing injected verifier fails closed",()=>{
  assert.throws(()=>makeAuthenticateFirebase(undefined as never),/FIREBASE_VERIFIER_UNCONFIGURED/);
});
