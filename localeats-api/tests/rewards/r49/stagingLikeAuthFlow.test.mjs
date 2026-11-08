/**
 * R4.9: local staging-LIKE authentication, account switching, shop transfer
 * and timing test against compiled real LocalEats API routes.
 * All users are created in a LOCAL Firebase Auth Emulator. DB is in-memory.
 * NEVER launch against a real Firebase project, Supabase, Vercel or customer.
 * Successful tests DO NOT qualify as a hosted staging acceptance.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {once} from 'node:events';
import {performance} from 'node:perf_hooks';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {authAdmin} from '../../../dist/lib/firebaseAdmin.js';
import {supabaseAdmin} from '../../../dist/lib/supabaseAdmin.js';
import {customerOrderRoutes,merchantOrderRoutes} from '../../../dist/routes/orders.js';

const project='demo-localeats-r49';
if(process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099' ||
   process.env.GCLOUD_PROJECT!==project ||
   process.env.FIREBASE_PROJECT_ID ||
   process.env.FIREBASE_PRIVATE_KEY ||
   process.env.FIREBASE_CLIENT_EMAIL ||
   process.env.GOOGLE_APPLICATION_CREDENTIALS ||
   process.env.SUPABASE_URL ||
   process.env.SUPABASE_DB_URL ||
   process.env.DATABASE_URL ||
   process.env.DIRECT_URL ||
   process.env.PICKUP_WRITES_ENABLED!=='false' ||
   process.env.REWARDS_ACTIVATION_ENABLED!=='false') {
 throw Error('R49_NON_ISOLATED_STAGING_ENVIRONMENT_REFUSED');
}
const identityBase='http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const signupUrl=identityBase+'/accounts:signUp?key=synthetic-api-key';
const signinUrl=identityBase+'/accounts:signInWithPassword?key=synthetic-api-key';
const uuid='550e8400-e29b-41d4-a716-000000000991';
const median=v=>v[Math.floor(v.length/2)];
const percentile=(v,p)=>v[Math.min(v.length-1,Math.ceil(v.length*p/100)-1)];
const ordered=v=>[...v].sort((a,b)=>a-b);
const metric=(name,samples)=>{
 const v=ordered(samples);
 assert.ok(v.length>0);
 const x={n:v.length,p50ms:Math.round(median(v)),p95ms:Math.round(percentile(v,95)),
   maxms:Math.round(v.at(-1))};
 // These are LOCAL emulator timings, not a live/hosted staging SLO.
 console.log('R49_LOCAL_EMULATOR_'+name+'_LATENCY='+JSON.stringify(x));
 return x;
};
const mockOrder=(customerUid)=>({
 id:uuid,user_id:customerUid,shop_id:'shop-my-kota',
 created_at:'2026-11-07T10:00:00Z',
 updated_at:'2026-11-07T10:12:00Z',
 delivery_type:'collection',delivery_status:'none',
 status:'ready_for_pickup',payment_status:'unpaid',payment_method:'cash',
 create_intent_hash:'b'.repeat(64),idempotency_key:'550e8400-e29b-41d4-a716-000000000992',
 items:[{menu_item_id:'kota',quantity:1,unit_price:25,line_total:25}],
 total_price:25,service_fee:0,delivery_fee:0,revision:1
});
test('R4.9 staging-like emulator: UID isolation, revoked/disabled recovery and shop ownership',async t=>{
 const app=initializeApp({projectId:project},'r49-staging-like-auth-flow');
 const auth=getAuth(app);
 const originalVerify=authAdmin.verifyIdToken;
 const originalFrom=supabaseAdmin.from;
 const originalRpc=supabaseAdmin.rpc;
 const sourceReads=[],writes=[];
 let currentShopOwner;
 let dbUnavailable=false;
 const fakeOrders=[];
 const users={};
 let createIndex=0;
 async function createUser(prefix){
  const email='r49-'+prefix+'-'+(++createIndex)+'@example.invalid';
  const password='R49-Demo-Only-Password-Strong!2026';
  const response=await fetch(signupUrl,{method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({email,password,returnSecureToken:true})});
  const data=await response.json();
  assert.equal(response.status,200,JSON.stringify(data));
  assert.ok(data.idToken&&data.localId);
  return {uid:data.localId,token:data.idToken,email,password};
 }
 async function signIn(user){
  const response=await fetch(signinUrl,{method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({email:user.email,password:user.password,returnSecureToken:true})});
  const data=await response.json();
  assert.equal(response.status,200,JSON.stringify(data));
  assert.equal(data.localId,user.uid);
  return data.idToken;
 }
 const mockQuery=table=>{
  const filters=[],inFilters=[];
  const q={
   select:()=>q,
   eq:(key,value)=>{filters.push([key,value]);return q;},
   in:(key,value)=>{inFilters.push([key,value]);return q;},
   is:(key,value)=>{filters.push([key,value]);return q;},
   order:()=>q,limit:()=>q,or:()=>q,range:()=>q,
   maybeSingle:async()=>{
    sourceReads.push({table,kind:'maybeSingle',filters:structuredClone(filters)});
    if(dbUnavailable)return {data:null,error:{message:'isolated DB offline'}};
    if(table==='orders'){
     const value=fakeOrders.find(o=>filters.every(([k,v])=>o[k]===v));
     return {data:value??null,error:null};
    }
    if(table==='shops'){
     const value={id:'shop-my-kota',owner_id:currentShopOwner,
      approval_status:'approved',archived_at:null};
     return {data:filters.every(([k,v])=>value[k]===v)?value:null,error:null};
    }
    return {data:null,error:null};
   },
   then(resolve,reject){
    sourceReads.push({table,kind:'select',filters:structuredClone(filters)});
    if(dbUnavailable)return Promise.resolve({data:null,error:{message:'isolated DB offline'}}).then(resolve,reject);
    let data=table==='shops'
     ?[{id:'shop-my-kota',owner_id:currentShopOwner,archived_at:null,approval_status:'approved'}]
     :table==='orders'?fakeOrders:[];
    data=data.filter(item=>filters.every(([k,v])=>item[k]===v));
    data=data.filter(item=>inFilters.every(([k,v])=>v.includes(item[k])));
    return Promise.resolve({data,error:null}).then(resolve,reject);
   }
  };
  return q;
 };
 const api=express();
 api.use(express.json());
 api.use('/api/v1/orders',customerOrderRoutes);
 api.use('/api/v1/merchant/orders',merchantOrderRoutes);
 let server,base;
 async function call(path,token,{method='GET',body}={}){
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),10000);
  const started=performance.now();
  try{
   const response=await fetch(base+path,{method,headers:{
    ...(token?{Authorization:'Bearer fb-'+token}:{}),
    ...(body?{'Content-Type':'application/json'}:{})
   },...(body?{body:JSON.stringify(body)}:{}),signal:ctrl.signal});
   const data=await response.json();
   return {status:response.status,body:data,elapsedMs:performance.now()-started};
  }finally{clearTimeout(timer)}
 }
 const originalError=console.error;
 try{
  users.customerA=await createUser('customer-a');
  users.customerB=await createUser('customer-b');
  users.merchantA=await createUser('merchant-a');
  users.merchantB=await createUser('merchant-b');
  users.disabled=await createUser('disabled');
  users.revoked=await createUser('revoked');
  currentShopOwner=users.merchantA.uid;
  fakeOrders.push(mockOrder(users.customerA.uid),
    {...mockOrder(users.customerB.uid),id:'550e8400-e29b-41d4-a716-000000000993'});
  authAdmin.verifyIdToken=auth.verifyIdToken.bind(auth);
  supabaseAdmin.from=mockQuery;
  supabaseAdmin.rpc=async(...args)=>{writes.push(args);throw Error('R49_FORBIDDEN_ORDER_RPC')};
  server=api.listen(0,'127.0.0.1');
  await once(server,'listening');
  base='http://127.0.0.1:'+server.address().port;

  await t.test('account switching isolates customer order history and strips private order proof',async()=>{
   const a=await call('/api/v1/orders',users.customerA.token);
   const b=await call('/api/v1/orders',users.customerB.token);
   assert.equal(a.status,200);assert.equal(b.status,200);
   assert.equal(a.body.orders.length,1);
   assert.equal(b.body.orders.length,1);
   assert.equal(a.body.orders[0].user_id,users.customerA.uid);
   assert.equal(b.body.orders[0].user_id,users.customerB.uid);
   assert.notEqual(a.body.orders[0].user_id,b.body.orders[0].user_id);
   assert.equal(a.body.orders[0].create_intent_hash,undefined);
   const crossed=await call('/api/v1/orders/'+fakeOrders[0].id,users.customerB.token);
   assert.equal(crossed.status,404);
   assert.equal(writes.length,0);
  });
  await t.test('revoked customer token rejects BEFORE private order reads; new login restores only own history',async()=>{
   const before=await call('/api/v1/orders',users.revoked.token);
   assert.equal(before.status,200);
   // Auth Emulator revocation uses seconds timestamps.
   await new Promise(resolve=>setTimeout(resolve,1800));
   await auth.revokeRefreshTokens(users.revoked.uid);
   const priorReads=sourceReads.length;
   console.error=()=>{};
   const denied=await call('/api/v1/orders',users.revoked.token);
   console.error=originalError;
   assert.equal(denied.status,401);
   assert.equal(sourceReads.length,priorReads);
   await new Promise(resolve=>setTimeout(resolve,1200));
   const newToken=await signIn(users.revoked);
   const restored=await call('/api/v1/orders',newToken);
   assert.equal(restored.status,200);
   assert.deepEqual(restored.body.orders,[]);
  });
  await t.test('disabled account stays rejected and does not expose cached order history',async()=>{
   await auth.updateUser(users.disabled.uid,{disabled:true});
   const n=sourceReads.length;
   console.error=()=>{};
   const denied=await call('/api/v1/orders',users.disabled.token);
   console.error=originalError;
   assert.equal(denied.status,401);
   assert.equal(sourceReads.length,n);
  });
  await t.test('merchant owner rechecked at command time, switch/transfer denies stale owner',async()=>{
   const body={command_id:'550e8400-e29b-41d4-a716-000000000994',expected_revision:1};
   const path='/api/v1/merchant/orders/'+fakeOrders[0].id+'/accept';
   const wrong=await call(path,users.merchantB.token,{method:'POST',body});
   assert.equal(wrong.status,403);
   const owner=await call(path,users.merchantA.token,{method:'POST',body});
   assert.equal(owner.status,503);
   assert.equal(owner.body.code,'PICKUP_WRITES_DISABLED');
   currentShopOwner=users.merchantB.uid;
   const afterTransfer=await call(path,users.merchantA.token,{method:'POST',body});
   assert.equal(afterTransfer.status,403);
   const newOwner=await call(path,users.merchantB.token,{method:'POST',body});
   assert.equal(newOwner.status,503);
   assert.equal(writes.length,0);
  });
  await t.test('backend authentication and DB outages fail closed, then recover without local success claim',async()=>{
   const saved=authAdmin.verifyIdToken;
   authAdmin.verifyIdToken=async()=>{throw Error('R49_SIMULATED_AUTH_OUTAGE')};
   const n=sourceReads.length;
   console.error=()=>{};
   const authFailed=await call('/api/v1/orders',users.customerA.token);
   console.error=originalError;
   assert.equal(authFailed.status,401);
   assert.equal(sourceReads.length,n);
   authAdmin.verifyIdToken=saved;
   dbUnavailable=true;
   const dbFailed=await call('/api/v1/orders',users.customerA.token);
   assert.equal(dbFailed.status,503);
   dbUnavailable=false;
   const recovered=await call('/api/v1/orders',users.customerA.token);
   assert.equal(recovered.status,200);
   assert.equal(recovered.body.orders.length,1);
   assert.equal(writes.length,0);
  });
  await t.test('local emulator sequential and parallel auth latency — measured, not hosted staging SLA',async()=>{
   const seq=[];
   for(let i=0;i<22;i++){
    const r=await call('/api/v1/orders',users.customerA.token);
    assert.equal(r.status,200);
    seq.push(r.elapsedMs);
   }
   const parallel=await Promise.all(Array.from({length:18},()=>call('/api/v1/orders',users.customerB.token)));
   assert.ok(parallel.every(r=>r.status===200));
   metric('SEQUENTIAL',seq);
   metric('CONCURRENT',parallel.map(r=>r.elapsedMs));
   assert.equal(writes.length,0);
  });
 }finally{
  console.error=originalError;
  if(server){server.close();await once(server,'close')}
  authAdmin.verifyIdToken=originalVerify;
  supabaseAdmin.from=originalFrom;
  supabaseAdmin.rpc=originalRpc;
  await deleteApp(app);
 }
});
