import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';import {once} from 'node:events';
import acceptance from './acceptance.js';import {authAdmin} from '../lib/firebaseAdmin.js';import {supabaseAdmin} from '../lib/supabaseAdmin.js';
test('acceptance HTTP requires revocation-checked nonanonymous auth, scoped UID, write activation and ownership',async()=>{
 const originalVerify=authAdmin.verifyIdToken,originalRpc=supabaseAdmin.rpc;let calls=0;
 Reflect.set(authAdmin,'verifyIdToken',async(token:string,revocation:boolean)=>{assert.equal(revocation,true);if(token==='revoked')throw Error('revoked');return {uid:token,firebase:{sign_in_provider:token==='anonymous'?'anonymous':'password'}};});
 Reflect.set(supabaseAdmin,'rpc',async(name:string,args:Record<string,unknown>)=>{calls++;if(args.p_uid==='other')return {error:{message:'FORBIDDEN'}};
  return {data:name==='pickup_acceptance_inbox'?[]:{shop_id:'shop',paused:false,revision:2},error:null};});
 const app=express();app.use(express.json());app.use('/api/v1',acceptance);const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/v1`;
 const call=(path:string,uid?:string,post=false)=>fetch(base+path,{method:post?'POST':'GET',headers:{'content-type':'application/json',...(uid?{Authorization:'Bearer fb-'+uid}:{})},...(post?{body:JSON.stringify({shop_id:'shop',expected_revision:1})}:{})});
 try{
  for(const uid of [undefined,'anonymous','revoked'])assert.equal((await call('/pickup-acceptance/notices',uid)).status,401);
  delete process.env.PICKUP_ACCEPTANCE_ENABLED;
  const off=await call('/pickup-acceptance/notices','merchant');assert.equal((await off.json()).enabled,false);assert.equal(calls,0);
  process.env.PICKUP_ACCEPTANCE_ENABLED='true';
  assert.equal((await call('/pickup-acceptance/notices','merchant')).headers.get('cache-control'),'private, no-store');
  assert.equal((await call('/merchant/shops/shop/reception','other')).status,403);
  assert.equal((await call('/merchant/shop/reception/resume','merchant',true)).status,503);
  process.env.PICKUP_WRITES_ENABLED='true';
  assert.equal((await call('/merchant/shop/reception/resume','merchant',true)).status,200);
 }finally{
  Reflect.set(authAdmin,'verifyIdToken',originalVerify);Reflect.set(supabaseAdmin,'rpc',originalRpc);delete process.env.PICKUP_ACCEPTANCE_ENABLED;delete process.env.PICKUP_WRITES_ENABLED;
  server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));
 }
});
