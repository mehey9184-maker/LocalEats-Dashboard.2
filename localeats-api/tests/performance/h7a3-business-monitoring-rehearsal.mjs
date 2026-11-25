// SYNTHETIC ONLY. Actual compiled routers; all auth, DB and provider adapters fake.
// Execute after build in a network namespace with loopback only and sanitized env.
import assert from 'node:assert/strict';
import express from 'express';
import {once} from 'node:events';
import {performance} from 'node:perf_hooks';
import {setTimeout as sleep} from 'node:timers/promises';
import {request as httpRequest} from 'node:http';
import {getApps,initializeApp,deleteApp} from 'firebase-admin/app';
import {authAdmin} from '../../dist/lib/firebaseAdmin.js';
import {supabaseAdmin} from '../../dist/lib/supabaseAdmin.js';
import {createApiAdmission,DEFAULT_LIMITS} from '../../dist/middleware/apiAdmission.js';
import {configureApiCacheSafety} from '../../dist/middleware/apiCacheSafety.js';
import {pickupWriteGate} from '../../dist/middleware/pickupWriteGate.js';
import {legacyOrderGuard} from '../../dist/legacyOrderGuard.js';
import {customerOrderRoutes,merchantOrderRoutes} from '../../dist/routes/orders.js';
import {pickupNotificationRoutes} from '../../dist/routes/pickupNotifications.js';
const id='550e8400-e29b-41d4-a716-446655440000',shop='shop-my-kota-ivory-park';
const cmd=n=>'550e8400-e29b-41d4-a716-44665544000'+n;
const original={from:supabaseAdmin.from,rpc:supabaseAdmin.rpc,verify:authAdmin.verifyIdToken};
assert.equal(getApps().length,0);
const fakeApp=initializeApp({projectId:'demo-h7a3-synthetic-only'},'h7a3-no-network');
const previousEnv={writes:process.env.PICKUP_WRITES_ENABLED,uid:process.env.PICKUP_TEST_CUSTOMER_UID};
const MAX=4294967295, families=['read','write','other'], outcomes=['ok','denied','failed','aborted','other'];
function observer(mode){
 const bins=new Uint32Array(15);let pending=false,dropped=0,failures=0;
 let release;const stalled=new Promise(r=>release=r);
 const bump=n=>Math.min(MAX,n+1);
 function exportSnapshot(){
  if(mode!=='reject'&&mode!=='stall')return;
  if(pending){dropped=bump(dropped);return;}pending=true;
  const copy=Array.from(bins);
  Promise.resolve().then(()=>{assert.equal(copy.length,15);if(mode==='reject')throw Error('SYNTHETIC_SINK_SECRET');return stalled;})
  .catch(()=>{failures=bump(failures);}).finally(()=>{pending=false;});
 }
 return {middleware(req,res,next){
  const f=req.method==='GET'||req.method==='HEAD'?0:req.method==='POST'?1:2;
  let done=false;const finish=()=>complete(false),close=()=>complete(!res.writableFinished);
  function complete(aborted){if(done)return;done=true;res.off('finish',finish);res.off('close',close);
   try{if(mode==='throw')throw Error('fixture counter failure');const o=aborted?3:res.statusCode===429?1:res.statusCode>=500?2:res.statusCode>=200&&res.statusCode<300?0:4;
   const i=f*5+o;if(bins[i]===MAX)dropped=bump(dropped);else bins[i]++;exportSnapshot();}catch{}
  }
  res.once('finish',finish);res.once('close',close);next();
 },snapshot(){return {bins:Array.from(bins),bytes:bins.byteLength,pending,dropped,failures};},release};
}
async function scenario(mode){
 let order=null,events=[],receiptMap=new Map(),trace=[],writes=0,auth=0,claimCount=0,failNext=false,holdNext=false,entered,release;
 let gate=new Promise(r=>release=r),entry=new Promise(r=>entered=r);
 const obs=observer(mode);
 const shopRow={id:shop,owner_id:'merchant',name:'Fixture shop',location:'Tembisa',is_active:true,effective_is_active:true,availability_revision:0,approval_status:'approved',archived_at:null,lat:-26,lng:28};
 const menu=[{id:'item',shop_id:shop,name:'Meal',price:25,is_available:true}];
 const clone=x=>structuredClone(x);
 authAdmin.verifyIdToken=async(token,revoked)=>{auth++;assert.equal(revoked,true);if(token==='revoked')throw Error('synthetic revoked');return {uid:token};};
 supabaseAdmin.from=function(table){
  let filters=[],isSingle=false;
  const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},is(k,v){filters.push([k,v]);return q;},in(k,v){filters.push([k,v]);return q;},order(){return q;},limit(){return q;},range(){return q;},or(){return q;},maybeSingle(){isSingle=true;return result();},then(a,b){return result().then(a,b);}};
  async function result(){trace.push('read:'+table);
   let rows=table==='orders'?(order?[order]:[]):table==='shops'||table==='shops_with_availability'?[shopRow]:table==='menu_items'?menu:table==='pickup_order_events'?events:table==='pickup_push_subscriptions'?[]:null;
   assert.ok(rows,'unexpected table '+table);
   rows=rows.filter(row=>filters.every(([k,v])=>Array.isArray(v)?v.includes(row[k]):row[k]===v));
   return {data:clone(isSingle?(rows[0]??null):rows),error:null};
  }
  return q;
 };
 supabaseAdmin.rpc=async(name,args)=>{
  trace.push('rpc:'+name);
  if(name==='pickup_claim_push'){claimCount++;return {data:null,error:null};}
  if(name==='pickup_create_order'){
   assert.equal(args.p_uid,'customer');assert.equal(order,null);writes++;
   order={id,user_id:'customer',shop_id:shop,status:'pending',payment_status:'unpaid',payment_method:'cash',delivery_type:'collection',delivery_status:'none',revision:0,idempotency_key:args.p_record.idempotency_key,create_intent_hash:args.p_intent_hash,total_price:args.p_record.total_price,items:args.p_record.items};
   return {data:{order:clone(order),replayed:false},error:null};
  }
  assert.equal(name,'pickup_order_command');assert.equal(args.p_uid,'merchant');
  const prior=receiptMap.get(args.p_command_id);if(prior)return {data:{order:clone(order),event:clone(prior),replayed:true},error:null};
  assert.equal(args.p_expected_revision,order.revision);writes++;
  const mapping={accept:['preparing','accepted'],ready:['ready_for_pickup','ready'],confirm_payment:['ready_for_pickup','payment_confirmed'],collect:['collected','collected']};
  const [status,kind]=mapping[args.p_action];order.status=status;order.revision++;
  if(args.p_action==='confirm_payment')order.payment_status='paid';
  const event={id:cmd(order.revision+4),command_id:args.p_command_id,order_id:id,actor_uid:'merchant',recipient_uid:'customer',kind,revision:order.revision,occurred_at:'2026-11-25T00:00:00Z'};
  events.push(event);receiptMap.set(args.p_command_id,event);
  if(holdNext){holdNext=false;entered();await gate;}
  if(failNext){failNext=false;return {data:null,error:{message:'synthetic lost receipt'}};}
  return {data:{order:clone(order),event:clone(event),replayed:false},error:null};
 };
 const app=express();
 if(mode!=='baseline')app.use(obs.middleware);
 configureApiCacheSafety(app);app.use(createApiAdmission({...DEFAULT_LIMITS},()=>0));app.use(legacyOrderGuard);app.use(pickupWriteGate);app.use(express.json());
 app.use('/api/v1/orders',customerOrderRoutes);app.use('/api/v1/merchant/orders',merchantOrderRoutes);app.use('/api/v1',pickupNotificationRoutes);
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
 const send=async(path,uid,body,method=body?'POST':'GET')=>{const r=await fetch(base+path,{method,headers:{Authorization:'Bearer fb-'+uid,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});return {status:r.status,body:await r.json()};};
 const input={contract_version:'pickup-v1',idempotency_key:id,shop_id:shop,items:[{menu_item_id:'item',quantity:1}],delivery_type:'collection',delivery_schedule_mode:'standard',payment_method:'cash',customer_details:{name:'SYNTHETIC_PRIVATE_NAME',phone:'+27712345678'},launch_location:{lat:-26,lng:28}};
 const p='/api/v1/merchant/orders/'+id;
 const responses=[];
 async function record(path,uid,body,expected){const r=await send(path,uid,body);assert.equal(r.status,expected);responses.push(r);return r;}
 try{
  process.env.PICKUP_WRITES_ENABLED='true';process.env.PICKUP_TEST_CUSTOMER_UID='customer';
  const before=trace.length;await record('/api/v1/orders/quote','revoked',input,401);assert.equal(trace.length,before);
  const q=await record('/api/v1/orders/quote','customer',input,200);assert.equal(q.body.quote.total_minor,2500);
  const create={...input,consent:{currency:'ZAR',total_minor:q.body.quote.total_minor,pricing_fingerprint:q.body.quote.pricing_fingerprint}};
  await record('/api/v1/orders','customer',create,201);assert.equal(writes,1);
  await record('/api/v1/orders','customer',create,200);assert.equal(writes,1);
  const n=trace.filter(x=>x.startsWith('rpc:')).length;await record(p+'/accept','other',{command_id:cmd(1),expected_revision:0},403);assert.equal(trace.filter(x=>x.startsWith('rpc:')).length,n);
  await record(p+'/accept','merchant',{command_id:cmd(1),expected_revision:0},200);
  await record(p+'/ready','merchant',{command_id:cmd(2),expected_revision:1},200);
  const payment={command_id:cmd(3),expected_revision:2,payment_method:'cash'};
  failNext=true;await record(p+'/payment-confirmation','merchant',payment,503);assert.equal(writes,4);assert.equal(order.payment_status,'paid');
  await sleep(10);assert.equal(writes,4,'no automatic replay');
  const replay=await record(p+'/payment-confirmation','merchant',payment,200);assert.equal(replay.body.replayed,true);assert.equal(writes,4);
  const collect={command_id:cmd(4),expected_revision:3,handover_confirmed:true};
  holdNext=true;const req=httpRequest(base+p+'/collect',{method:'POST',headers:{Authorization:'Bearer fb-merchant','Content-Type':'application/json'}});
  req.on('error',()=>{});req.end(JSON.stringify(collect));await entry;req.destroy();
  for(let i=0;i<100&&mode!=='baseline'&&mode!=='throw'&&obs.snapshot().bins[8]===0;i++)await sleep(5);
  release();await sleep(20);assert.equal(writes,5);
  if(mode!=='baseline'&&mode!=='throw')assert.equal(obs.snapshot().bins[8],1);
  const collected=await record(p+'/collect','merchant',collect,200);assert.equal(collected.body.replayed,true);assert.equal(writes,5);
  const inbox=await record('/api/v1/notifications','customer',undefined,200);assert.equal(inbox.body.notifications.length,1);
  const history=await record('/api/v1/orders','customer',undefined,200);assert.equal(history.body.orders[0].status,'collected');
  const other=await record('/api/v1/orders','other',undefined,200);assert.equal(other.body.orders.length,0);
  assert.equal(order.revision,4);assert.equal(events.length,4);assert.equal(claimCount,2);
  const start=performance.now();for(let i=0;i<60;i++)assert.equal((await send('/api/v1/orders','customer')).status,200);const elapsed=performance.now()-start;
  await sleep(0);const snapshot=obs.snapshot();assert.ok(!JSON.stringify(snapshot).includes('SYNTHETIC_PRIVATE_NAME'));assert.ok(!JSON.stringify(snapshot).includes(id));
  if(mode==='stall'){assert.equal(snapshot.pending,true);assert.ok(snapshot.dropped>0);}
  if(mode==='reject')assert.ok(snapshot.failures>0);
  return {parity:{responses,trace,writes,auth,claimCount,order,events},measurement:{mode,read60ms:+elapsed.toFixed(3),snapshot}};
 }finally{release();obs.release();server.closeAllConnections();await new Promise(r=>server.close(r));}
}
try{
 const baseline=await scenario('baseline');const measurements=[baseline.measurement];
 for(const mode of ['observed','throw','reject','stall']){const r=await scenario(mode);assert.deepEqual(r.parity,baseline.parity);measurements.push(r.measurement);}
 console.log('H7A3_BUSINESS_PARITY '+JSON.stringify({scenarios:5,mutations:baseline.parity.writes,auth:baseline.parity.auth,claims:baseline.parity.claimCount,events:baseline.parity.events.length,measurements,scope:'real compiled HTTP business routers; deterministic fake persistence/provider, not SQL or hosted writes'}));
}finally{
 supabaseAdmin.from=original.from;supabaseAdmin.rpc=original.rpc;authAdmin.verifyIdToken=original.verify;await deleteApp(fakeApp);
 if(previousEnv.writes===undefined)delete process.env.PICKUP_WRITES_ENABLED;else process.env.PICKUP_WRITES_ENABLED=previousEnv.writes;
 if(previousEnv.uid===undefined)delete process.env.PICKUP_TEST_CUSTOMER_UID;else process.env.PICKUP_TEST_CUSTOMER_UID=previousEnv.uid;
}
