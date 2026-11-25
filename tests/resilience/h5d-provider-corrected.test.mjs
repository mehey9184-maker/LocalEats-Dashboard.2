// Baseline diagnostics: actual compiled provider paths, synthetic RPC/FCM/auth only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {drainPickupPush} from '../../localeats-api/dist/orders/pickupPush.js';
import {tryMerchantPickupPush} from '../../localeats-api/dist/orders/merchantPush.js';
import {authenticateFirebase} from '../../localeats-api/dist/middleware/authenticateFirebase.js';
import {authAdmin} from '../../localeats-api/dist/lib/firebaseAdmin.js';
import {createApiAdmission,createWindowBudget,beforeFirebaseVerification,afterFirebaseVerification} from '../../localeats-api/dist/middleware/apiAdmission.js';
const tick=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};};
const observe=(id,data)=>console.log('H5D_CORRECTED '+JSON.stringify({id,...data}));
const job={id:'synthetic-job',attempts:1,lease_until:'2026-11-25T00:00:30Z',event_id:'synthetic-event',order_id:'synthetic-order',token:'synthetic-token'};
function outbox(overrides={}){
 const calls=[];const client={rpc:async(name,args)=>{calls.push({name,args});return {data:name==='pickup_claim_push'?job:name==='pickup_push_sendable'?true:true,error:null,...(overrides[name]??{})}}};return {calls,client};
}

test('R09 Ready send deadline preserves uncertain lease, never sends or finishes again on late success',async t=>{
 const d=deferred(),{calls,client}=outbox();let sends=0;t.mock.timers.enable({apis:['setTimeout']});
 const p=drainPickupPush(client,'fixture-recipient',()=>{sends++;return d.promise;});
 await tick();assert.equal(sends,1);t.mock.timers.tick(5000);await p;
 assert.deepEqual(calls.map(x=>x.name),['pickup_claim_push','pickup_push_sendable']);d.resolve();await tick();
 assert.equal(calls.length,2);assert.equal(sends,1);observe('R09_READY_TIMEOUT',{deadlineMs:5000,sends,finishCalls:0,leaseRetained:true});
});
test('R09 total budget across claim and token check, no late send',async t=>{
 const claim=deferred(),check=deferred(),calls=[];let sends=0;
 const client={rpc:async(name,args)=>{calls.push(name);return name==='pickup_claim_push'?claim.promise:check.promise}};
 t.mock.timers.enable({apis:['setTimeout']});const p=drainPickupPush(client,'fixture-recipient',async()=>{sends++});
 await tick();t.mock.timers.tick(4000);claim.resolve({data:job,error:null});await tick();assert.deepEqual(calls,['pickup_claim_push','pickup_push_sendable']);
 t.mock.timers.tick(1000);await p;check.resolve({data:true,error:null});await tick();
 assert.equal(sends,0);assert.equal(calls.length,2);observe('R09_TOTAL_BUDGET',{deadlineMs:5000,rpcCalls:2,sends:0});
});
test('R09 hung claim releases without issuing later send or finish',async t=>{
 const d=deferred(),calls=[];let sends=0;
 const client={rpc:async(name)=>{calls.push(name);return d.promise;}};
 t.mock.timers.enable({apis:['setTimeout']});const p=drainPickupPush(client,'fixture-recipient',async()=>{sends++});
 await tick();t.mock.timers.tick(5000);await p;d.resolve({data:job,error:null});await tick();
 assert.deepEqual(calls,['pickup_claim_push']);assert.equal(sends,0);observe('R09_CLAIM_TIMEOUT',{rpcCalls:1,sends:0,deadlineMs:5000});
});
test('R09 hung finish is bounded without second completion; accepted send not called delivered',async t=>{
 const d=deferred(),calls=[];let sends=0;
 const client={rpc:async(name,args)=>{calls.push({name,args});return name==='pickup_finish_push'?d.promise:{data:name==='pickup_claim_push'?job:true,error:null};}};
 t.mock.timers.enable({apis:['setTimeout']});const p=drainPickupPush(client,'fixture-recipient',async()=>{sends++});
 await tick();assert.equal(calls.at(-1).name,'pickup_finish_push');assert.equal(calls.at(-1).args.p_sent,true);t.mock.timers.tick(5000);await p;
 d.resolve({data:true,error:null});await tick();assert.equal(sends,1);assert.equal(calls.length,3);observe('R09_FINISH_TIMEOUT',{sends,finishCalls:1,deadlineMs:5000});
});
test('R09 merchant mixed FCM success/hang: bounded result counts only accepted, replay no send',async t=>{
 const d=deferred(),order={id:'synthetic-order',shop_id:'fixture-shop',status:'pending',delivery_type:'collection'},lookup={findOwner:async()=> 'fixture-owner',findTokens:async()=>['synthetic-token-0123456789','synthetic-token-9876543210']};
 let sends=0;t.mock.timers.enable({apis:['setTimeout']});const p=tryMerchantPickupPush(lookup,order,false,()=>++sends===1?Promise.resolve():d.promise);
 await tick();assert.equal(sends,2);t.mock.timers.tick(5000);assert.deepEqual(await p,{attempted:2,accepted:1});d.resolve();await tick();
 assert.deepEqual(await tryMerchantPickupPush(lookup,order,true,async()=>{sends++}),{attempted:0,accepted:0});assert.equal(sends,2);
 observe('R09_MERCHANT_TIMEOUT',{attempted:2,accepted:1,lateAcceptedNotCounted:true,replaySends:0});
});
test('R09 merchant hung owner lookup never sends later',async t=>{
 const d=deferred(),order={id:'synthetic-order',shop_id:'fixture-shop',status:'pending',delivery_type:'collection'};let tokens=0,sends=0;
 t.mock.timers.enable({apis:['setTimeout']});const p=tryMerchantPickupPush({findOwner:()=>d.promise,findTokens:async()=>{tokens++;return ['synthetic-token-0123456789']}},order,false,async()=>{sends++});
 await tick();t.mock.timers.tick(5000);assert.deepEqual(await p,{attempted:0,accepted:0});d.resolve('fixture-owner');await tick();assert.equal(tokens,0);assert.equal(sends,0);observe('R09_LOOKUP_TIMEOUT',{tokenLookups:0,sends:0});
});
test('R09 transient and permanent failures preserve fence fields, unsendable stays blocked',async()=>{
 for(const code of ['messaging/server-unavailable','messaging/registration-token-not-registered']){
  const {calls,client}=outbox();await drainPickupPush(client,'fixture-recipient',async()=>{throw Object.assign(Error('synthetic'),{code})});
  const finish=calls.at(-1).args;assert.equal(finish.p_uid,'fixture-recipient');assert.equal(finish.p_attempt,1);assert.equal(finish.p_lease,job.lease_until);assert.equal(finish.p_sent,false);assert.equal(finish.p_permanent,code.endsWith('not-registered'));
 }
 const {client,calls}=outbox({pickup_push_sendable:{data:false}});let sends=0;await drainPickupPush(client,'fixture-recipient',async()=>{sends++});assert.equal(sends,0);assert.equal(calls.at(-1).args.p_permanent,true);observe('R09_FENCE',{sends:0,transientRetryable:true,invalidTokenPermanent:true});
});
function response(){
 const state={status:200,body:null,next:0,headers:{}};
 const res={locals:{},status(n){state.status=n;return this},json(body){state.body=body;return this},set(k,v){state.headers[k]=v;return this}};
 return {state,res};
}
test('R10 known transient errors 503; revoked/disabled/unknown errors 401, none authorize',async()=>{
 const original=authAdmin.verifyIdToken;
 try{
  for(const [code,status] of [['auth/id-token-revoked',401],['auth/user-disabled',401],['auth/id-token-expired',401],['auth/argument-error',401],['unknown',401],['auth/internal-error',503],['app/network-error',503]]){
   const {res,state}=response();let checked=false;authAdmin.verifyIdToken=async(_token,revoked)=>{checked=revoked;throw Object.assign(Error('synthetic'),{code})};
   const req={headers:{authorization:'Bearer fb-fixture'}};await authenticateFirebase(req,res,()=>state.next++);
   assert.equal(checked,true);assert.equal(state.next,0);assert.equal(req.authUser,undefined);assert.equal(state.status,status);
   if(status===503){assert.equal(state.headers['Retry-After'],'30');assert.equal(state.headers['Cache-Control'],'no-store');}
   observe('R10_REJECT',{code,status,authorized:0});
  }
 }finally{authAdmin.verifyIdToken=original}
});
test('R10 verifier deadline blocks late authorization; subsequent verified request succeeds',async t=>{
 const original=authAdmin.verifyIdToken,d=deferred(),{res,state}=response(),req={headers:{authorization:'Bearer fb-fixture'}};
 t.mock.timers.enable({apis:['setTimeout']});try{
 authAdmin.verifyIdToken=()=>d.promise;const p=authenticateFirebase(req,res,()=>state.next++);
 await tick();t.mock.timers.tick(5000);await p;assert.equal(state.status,503);assert.equal(state.next,0);assert.equal(req.authUser,undefined);
 d.resolve({uid:'fixture-user'});await tick();assert.equal(state.next,0);assert.equal(req.authUser,undefined);
 const next=response(),nextReq={headers:{authorization:'Bearer fb-fixture'}};authAdmin.verifyIdToken=async(_t,check)=>{assert.equal(check,true);return {uid:'fixture-user'}};
 await authenticateFirebase(nextReq,next.res,()=>next.state.next++);assert.equal(next.state.next,1);assert.equal(nextReq.authUser.uid,'fixture-user');
 observe('R10_TIMEOUT',{deadlineMs:5000,lateAuthorized:0,recovered:true});
 }finally{authAdmin.verifyIdToken=original}
});
test('R12 actual middleware actor and shared admission remain distinct; no bypass at account switch',()=>{
 let now=0;const limits={all:10,auth:3,read:1,write:1,quote:1,notifications:1,pushTest:1,maxKeys:20,windowMs:60000};
 const middleware=createApiAdmission(limits,()=>now);
 function attempt(uid){const {res,state}=response();const req={method:'GET',originalUrl:'/api/v1/orders'};
 middleware(req,res,()=>{if(beforeFirebaseVerification(res)&&afterFirebaseVerification(res,uid))state.next++});return state;}
 assert.equal(attempt('A').next,1);assert.equal(attempt('A').status,429);assert.equal(attempt('B').next,1);assert.equal(attempt('C').status,429);
 now=60000;assert.equal(attempt('C').next,1);
 observe('R12_ADMISSION',{actorLimited:true,otherActorAllowed:true,sharedAuthBlocksNewActor:true,expiryRecovery:true});
});
