// Baseline diagnostics: actual compiled provider paths, synthetic RPC/FCM/auth only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {drainPickupPush} from '../../localeats-api/dist/orders/pickupPush.js';
import {tryMerchantPickupPush} from '../../localeats-api/dist/orders/merchantPush.js';
import {authenticateFirebase} from '../../localeats-api/dist/middleware/authenticateFirebase.js';
import {authAdmin} from '../../localeats-api/dist/lib/firebaseAdmin.js';
import {createWindowBudget} from '../../localeats-api/dist/middleware/apiAdmission.js';
const tick=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};};
const observe=(id,data)=>console.log('H5D_BASELINE '+JSON.stringify({id,...data}));
const job={id:'synthetic-job',attempts:1,lease_until:'2026-11-25T00:00:30Z',event_id:'synthetic-event',order_id:'synthetic-order',token:'synthetic-token'};
function outbox(overrides={}){
 const calls=[];const client={rpc:async(name,args)=>{calls.push({name,args});return {data:name==='pickup_claim_push'?job:name==='pickup_push_sendable'?true:true,error:null,...(overrides[name]??{})}}};return {calls,client};
}
test('R09 customer Ready push: hanging sender blocks awaited drain beyond lease interval',async t=>{
 const d=deferred(),{calls,client}=outbox();t.mock.timers.enable({apis:['setTimeout']});
 let settled=false;const p=drainPickupPush(client,'fixture-recipient',()=>d.promise).then(()=>{settled=true});
 await tick();t.mock.timers.tick(31000);await tick();observe('R09_READY_HANG',{elapsedVirtualMs:31000,settled,finishCalls:calls.filter(x=>x.name==='pickup_finish_push').length});
 d.resolve();await p;
});
test('R09 outbox database claim hangs, existing catch cannot bound pending I/O',async t=>{
 const d=deferred(),calls=[];const client={rpc:async(name,args)=>{calls.push({name,args});return d.promise;}};
 t.mock.timers.enable({apis:['setTimeout']});let settled=false;const p=drainPickupPush(client,'fixture-recipient',async()=>{}).then(()=>{settled=true});
 await tick();t.mock.timers.tick(31000);await tick();observe('R09_CLAIM_HANG',{elapsedVirtualMs:31000,settled,rpcCalls:calls.length});d.resolve({data:null,error:null});await p;
});
test('R09 merchant new-order FCM hang delays awaited result; replay never resends',async t=>{
 const d=deferred(),order={id:'synthetic-order',shop_id:'fixture-shop',status:'pending',delivery_type:'collection'},lookup={findOwner:async()=> 'fixture-owner',findTokens:async()=>['synthetic-token-0123456789']};
 t.mock.timers.enable({apis:['setTimeout']});let settled=false,sends=0;
 const p=tryMerchantPickupPush(lookup,order,false,()=>{sends++;return d.promise;}).then(v=>{settled=true;return v;});
 await tick();t.mock.timers.tick(31000);await tick();observe('R09_MERCHANT_HANG',{elapsedVirtualMs:31000,settled,sends});
 assert.deepEqual(await tryMerchantPickupPush(lookup,order,true,async()=>{sends++}),{attempted:0,accepted:0});
 d.resolve();assert.deepEqual(await p,{attempted:1,accepted:1});assert.equal(sends,1);
});
test('R09 lease fence, transient/permanent and recipient controls',async()=>{
 for(const code of ['messaging/server-unavailable','messaging/registration-token-not-registered']){
  const {calls,client}=outbox();await drainPickupPush(client,'fixture-recipient',async()=>{throw Object.assign(Error('synthetic failure'),{code})});
  const finish=calls.at(-1).args;assert.equal(finish.p_uid,'fixture-recipient');assert.equal(finish.p_attempt,1);assert.equal(finish.p_lease,job.lease_until);assert.equal(finish.p_sent,false);assert.equal(finish.p_permanent,code.endsWith('not-registered'));observe('R09_FAILURE',{code,permanent:finish.p_permanent});
 }
 const {calls,client}=outbox({pickup_push_sendable:{data:false}});let sent=0;await drainPickupPush(client,'fixture-recipient',async()=>{sent++});assert.equal(sent,0);
 assert.equal(calls.at(-1).args.p_permanent,true);observe('R09_FENCE',{sendable:false,sends:sent,finishAttempt:calls.at(-1).args.p_attempt});
 // Model the archived SQL attempt/lease fence, not a hosted database result.
 let activeAttempt=1,activeLease=job.lease_until,accepted=0;const late=deferred();
 const client2={rpc:async(name,args)=>{if(name==='pickup_claim_push')return {data:{...job,attempts:activeAttempt,lease_until:activeLease},error:null};if(name==='pickup_push_sendable')return {data:args.p_attempt===activeAttempt&&args.p_lease===activeLease,error:null};if(name==='pickup_finish_push'){const current=args.p_attempt===activeAttempt&&args.p_lease===activeLease;if(current)accepted++;return {data:current,error:null};}throw Error('unexpected');}};
 const old=drainPickupPush(client2,'fixture-recipient',()=>late.promise);await tick();activeAttempt=2;activeLease='2026-11-25T00:01:00Z';await drainPickupPush(client2,'fixture-recipient',async()=>{});late.resolve();await old;assert.equal(accepted,1);observe('R09_LEASE_MODEL',{acceptedFinishes:accepted,attempts:2});
});
function response(){
 const state={status:200,body:null,next:0};
 const res={locals:{},status(n){state.status=n;return this},json(body){state.body=body;return this},set(){return this}};
 return {state,res};
}
test('R10 provider rejection and transient outage indistinguishable, revocation check retained',async()=>{
 const original=authAdmin.verifyIdToken;
 try{
  for(const code of ['auth/id-token-revoked','auth/user-disabled','auth/internal-error','app/network-error']){
   const {res,state}=response();let checked=false;authAdmin.verifyIdToken=async(_token,revoked)=>{checked=revoked;throw Object.assign(Error('synthetic'),{code})};
   const req={headers:{authorization:'Bearer fb-fixture'}};await authenticateFirebase(req,res,()=>state.next++);
   assert.equal(checked,true);assert.equal(state.next,0);assert.equal(req.authUser,undefined);observe('R10_REJECT',{code,status:state.status,authorized:state.next});
  }
 }finally{authAdmin.verifyIdToken=original}
});
test('R10 verifier can remain pending; late verified user reaches next after provider recovery',async t=>{
 const original=authAdmin.verifyIdToken,d=deferred(),{res,state}=response(),req={headers:{authorization:'Bearer fb-fixture'}};
 t.mock.timers.enable({apis:['setTimeout']});let settled=false;
 try{authAdmin.verifyIdToken=()=>d.promise;const p=authenticateFirebase(req,res,()=>state.next++).then(()=>{settled=true});
 await tick();t.mock.timers.tick(31000);await tick();observe('R10_HANG',{elapsedVirtualMs:31000,settled,authorized:state.next});
 d.resolve({uid:'fixture-user',firebase:{sign_in_provider:'password'}});await p;assert.equal(state.next,1);
 }finally{authAdmin.verifyIdToken=original}
});
test('R12 server window budget distinguishes actor keys and shared budget, recovers at boundary',()=>{
 let now=0;const budget=createWindowBudget(4,60000,()=>now);
 assert.equal(budget.take('read:A',1).allowed,true);assert.equal(budget.take('read:A',1).allowed,false);assert.equal(budget.take('read:B',1).allowed,true);
 now=60000;assert.equal(budget.take('read:A',1).allowed,true);observe('R12_SERVER',{actorIsolation:true,expiryRecovery:true,scope:'in-memory process'});
});
