/**
 * R4.8 draft-only security regression: actual compiled API auth middleware
 * and merchant order route with fake Firebase Admin and fake DB.
 * No actual identity, production order, external payment, or SQL writes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {once} from 'node:events';
import {request as httpRequest} from 'node:http';
import {readFileSync} from 'node:fs';
import {authAdmin} from '../../../dist/lib/firebaseAdmin.js';
import {supabaseAdmin} from '../../../dist/lib/supabaseAdmin.js';
import {authenticateFirebase,getFirebaseBearerToken} from '../../../dist/middleware/authenticateFirebase.js';
import {merchantOrderRoutes} from '../../../dist/routes/orders.js';

const orderId='550e8400-e29b-41d4-a716-000000000881';
const bearer=token=>'Bearer fb-'+token;
const runWithVerifier=async(verifier,fn)=>{
 const prev=authAdmin.verifyIdToken;
 authAdmin.verifyIdToken=verifier;
 try{return await fn();}finally{authAdmin.verifyIdToken=prev;}
};
const direct=async header=>{
 const req={headers:{authorization:header}};
 let called=0,status=200,body;
 const res={status(n){status=n;return this},json(v){body=v;return this}};
 await authenticateFirebase(req,res,()=>{called++});
 return {req,called,status,body};
};
const quiet=async fn=>{
 const orig=console.error;console.error=()=>{};
 try{return await fn();}finally{console.error=orig;}
};
test('R4.8 draft compiled middleware explicitly checks revocation with Firebase Admin',()=>{
 const src=readFileSync(new URL('../../../src/middleware/authenticateFirebase.ts',import.meta.url),'utf8');
 assert.match(src,/authAdmin\.verifyIdToken\(token,\s*true\)/);
 assert.doesNotMatch(src,/authAdmin\.verifyIdToken\(token\)/);
});
test('R4.8 good mocked Firebase token maps only signed verified UID to request',async()=>{
 const calls=[];
 await runWithVerifier(async(token,checkRevoked)=>{
  calls.push([token,checkRevoked]);
  return {uid:'merchant-1',email:'fake@example.invalid',
   firebase:{sign_in_provider:'password'},admin:true};
 },async()=>{
  const r=await direct(bearer('valid-merchant'));
  assert.equal(r.status,200);assert.equal(r.called,1);
  assert.deepEqual(r.req.authUser,{uid:'merchant-1',email:'fake@example.invalid',isAnonymous:false});
  assert.equal(r.req.authUser.admin,undefined);
 });
 assert.deepEqual(calls,[['valid-merchant',true]]);
});
test('R4.8 revoked disabled expired wrong-project and auth service outage fail closed',async()=>{
 await quiet(async()=>{
  for(const kind of ['revoked','disabled','expired','wrong-project','upstream-outage']){
   let calls=0;
   await runWithVerifier(async(_,checkRevoked)=>{
    calls++;assert.equal(checkRevoked,true);throw Error('synthetic '+kind);
   },async()=>{
    const r=await direct(bearer(kind));
    assert.equal(r.status,401,kind);assert.equal(r.called,0,kind);
    assert.equal(r.req.authUser,undefined);
    assert.deepEqual(r.body,{success:false,error:'Unauthorized'});
   });
   assert.equal(calls,1);
  }
 });
});
test('R4.8 missing or malformed bearer scheme is blocked before verifier',async()=>{
 let calls=0;
 await runWithVerifier(async()=>{calls++;throw Error('must not run')},async()=>{
  for(const head of [undefined,'','Bearer user','bearer fb-token','Basic token']){
   const r=await direct(head);
   assert.equal(r.status,401);assert.equal(r.called,0);
  }
 });
 assert.equal(calls,0);
 assert.equal(getFirebaseBearerToken(bearer('valid-merchant')),'valid-merchant');
});
test('R4.8 rejects forged empty, malformed and overlong user identities',async()=>{
 await quiet(async()=>{
  for(const uid of ['', ' merchant','merchant ', 'merchant\nother','x'.repeat(161),undefined]){
   await runWithVerifier(async(_,revoked)=>{
    assert.equal(revoked,true);return {uid,firebase:{sign_in_provider:'password'}};
   },async()=>{
    const r=await direct(bearer('fake-token'));
    assert.equal(r.status,401);assert.equal(r.called,0);
    assert.equal(r.req.authUser,undefined);
   });
  }
 });
});
test('R4.8 generic anonymous browsing still flagged anonymous; not a Rewards identity',async()=>{
 await runWithVerifier(async(_,revoked)=>{
  assert.equal(revoked,true);
  return {uid:'anonymous-1',firebase:{sign_in_provider:'anonymous'}};
 },async()=>{
  const r=await direct(bearer('anon-token'));
  assert.equal(r.called,1);assert.equal(r.req.authUser.isAnonymous,true);
 });
});
test('R4.8 repeated requests cannot reuse a stale authenticated account',async()=>{
 const checks=[];
 await quiet(()=>runWithVerifier(async(token,revoked)=>{
  checks.push([token,revoked]);
  if(token==='revoked-token')throw Error('revoked');
  return {uid:token,firebase:{sign_in_provider:'password'}};
 },async()=>{
  const good=await direct(bearer('merchant-1'));
  const revoked=await direct(bearer('revoked-token'));
  const other=await direct(bearer('customer-1'));
  assert.deepEqual([good.status,revoked.status,other.status],[200,401,200]);
  assert.deepEqual([good.called,revoked.called,other.called],[1,0,1]);
  assert.equal(revoked.req.authUser,undefined);
  assert.equal(other.req.authUser.uid,'customer-1');
 }));
 assert.ok(checks.every(([,r])=>r===true));assert.equal(checks.length,3);
});
test('R4.8 real merchant route rejects revoked session before DB, enforces current owner, leaves pickup disabled',async()=>{
 const originalFrom=supabaseAdmin.from,originalRpc=supabaseAdmin.rpc,
  originalVerify=authAdmin.verifyIdToken;
 const originalFlags={PICKUP_WRITES_ENABLED:process.env.PICKUP_WRITES_ENABLED,
  PICKUP_TEST_CUSTOMER_UID:process.env.PICKUP_TEST_CUSTOMER_UID};
 process.env.PICKUP_WRITES_ENABLED='false';
 delete process.env.PICKUP_TEST_CUSTOMER_UID;
 let currentOwner='merchant-owner';
 const reads=[],writes=[],tokenChecks=[];
 const fakeOrder={id:orderId,user_id:'customer-1',shop_id:'my-kota',
  delivery_type:'collection',create_intent_hash:'a'.repeat(64),
  payment_status:'unpaid',status:'pending'};
 authAdmin.verifyIdToken=async(token,revoked)=>{
  tokenChecks.push([token,revoked]);assert.equal(revoked,true);
  if(token==='revoked' || token==='disabled')throw Error(token);
  return {uid:token,firebase:{sign_in_provider:'password'}};
 };
 supabaseAdmin.from=table=>{
  reads.push(table);
  const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({
   data:table==='orders'?fakeOrder:table==='shops'?{id:'my-kota',owner_id:currentOwner}:null,error:null
  })};
  return q;
 };
 supabaseAdmin.rpc=async(...args)=>{writes.push(args);throw Error('R48_NO_ORDER_WRITES')};
 const app=express();app.use(express.json());
 app.use('/api/v1/merchant/orders',merchantOrderRoutes);
 const server=app.listen(0,'127.0.0.1');
 await once(server,'listening');
 const call=token=>new Promise((resolve,reject)=>{
  const req=httpRequest({host:'127.0.0.1',port:server.address().port,
   path:'/api/v1/merchant/orders/'+orderId+'/accept',method:'POST',
   headers:{'Content-Type':'application/json',Authorization:bearer(token)}},res=>{
    let data='';res.on('data',x=>{data+=x});
    res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(data)}));
   });
  req.on('error',reject);
  req.end(JSON.stringify({command_id:orderId,expected_revision:0}));
 });
 try{
  await quiet(async()=>{
   for(const token of ['revoked','disabled']){
    const before=reads.length;
    const r=await call(token);
    assert.equal(r.status,401);assert.equal(reads.length,before);
   }
  });
  const mismatch=await call('different-owner');
  assert.equal(mismatch.status,403);assert.equal(mismatch.body.code,'FORBIDDEN');
  const owner=await call('merchant-owner');
  assert.equal(owner.status,503);assert.equal(owner.body.code,'PICKUP_WRITES_DISABLED');
  currentOwner='new-owner';
  const transferred=await call('merchant-owner');
  assert.equal(transferred.status,403);
  assert.equal(writes.length,0);
  assert.ok(tokenChecks.every(([,revoked])=>revoked===true));
 }finally{
  server.close();await once(server,'close');
  authAdmin.verifyIdToken=originalVerify;
  supabaseAdmin.from=originalFrom;supabaseAdmin.rpc=originalRpc;
  for(const [k,v] of Object.entries(originalFlags)){
   if(v===undefined)delete process.env[k];else process.env[k]=v;
  }
 }
});
