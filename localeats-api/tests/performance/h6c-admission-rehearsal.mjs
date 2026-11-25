// H6B actual protected routes, fabricated read-only Supabase adapter and auth.
// No external traffic; all simulated DB calls counted, including empty outbox claims.
import assert from 'node:assert/strict';
import express from 'express';
import {once} from 'node:events';
import {performance,monitorEventLoopDelay} from 'node:perf_hooks';
import {setTimeout as sleep} from 'node:timers/promises';
import {createApiAdmission,createWindowBudget,DEFAULT_LIMITS} from '../../dist/middleware/apiAdmission.js';
import {authAdmin} from '../../dist/lib/firebaseAdmin.js';
import {initializeApp,getApps,deleteApp} from 'firebase-admin/app';
import {supabaseAdmin} from '../../dist/lib/supabaseAdmin.js';
import {customerOrderRoutes,merchantOrderRoutes} from '../../dist/routes/orders.js';
import {pickupNotificationRoutes} from '../../dist/routes/pickupNotifications.js';
import merchantRoutes from '../../dist/routes/merchant.js';
const emit=(kind,x)=>console.log('H6C_'+kind+' '+JSON.stringify(x));
const stat=a=>{const v=[...a].sort((a,b)=>a-b);const q=p=>+v[Math.ceil(v.length*p)-1].toFixed(3);return {p50:q(.5),p95:q(.95),p99:q(.99),max:q(1)}};
let calls={},auth=0,failTable='',heldInbox=null;
assert.equal(getApps().length,0,'fixture must have no configured provider app');
const fixtureApp=initializeApp({projectId:'demo-h6b-synthetic-only'},'h6b-no-network');
const original={from:supabaseAdmin.from,rpc:supabaseAdmin.rpc,verify:authAdmin.verifyIdToken};
const shops=Array.from({length:100},(_,i)=>({id:'shop-'+i,owner_id:'m-'+i,approval_status:'approved',is_active:true,effective_is_active:true,availability_revision:0,archived_at:null,lat:-26,lng:28}));
const orders=Array.from({length:2500},(_,i)=>({id:'order-'+i,user_id:'u-'+i,shop_id:'shop-'+i%100,delivery_type:'collection',status:i%5===0?'pending':'collected',payment_status:i%5===0?'unpaid':'paid',delivery_status:'none',revision:i%5===0?0:4,total_price:25,items:[]}));
const events=orders.filter(o=>o.status==='collected').map(o=>({id:'event-'+o.id,order_id:o.id,recipient_uid:o.user_id,kind:'ready',occurred_at:'2026-11-25T00:00:00Z'}));
const inc=k=>calls[k]=(calls[k]||0)+1;
supabaseAdmin.from=function(table){
 let rows=table==='orders'?orders:table==='pickup_order_events'?events:table==='shops'||table==='shops_with_availability'?shops:null;
 assert.ok(rows,'unexpected table '+table);
 let range=false,filtered=false;
 const q={select(){return q},eq(k,v){rows=rows.filter(x=>x[k]===v);return q},is(k,v){rows=rows.filter(x=>x[k]===v);return q},in(k,v){rows=rows.filter(x=>v.includes(x[k]));return q},or(){filtered=true;rows=rows.filter(x=>x.status==='pending');return q},order(){return q},limit(n){rows=rows.slice(0,n);return q},range(a,b){range=true;rows=rows.slice(a,b+1);return q},then(resolve,reject){inc(table+(range?':unfinished':filtered?':filter':''));return (table==='pickup_order_events'&&heldInbox?heldInbox.promise:Promise.resolve({data:rows,error:table===failTable?{message:'fixture failure'}:null})).then(resolve,reject)}};
 return q;
};
supabaseAdmin.rpc=async(name,args)=>{assert.equal(name,'pickup_claim_push');assert.match(args.p_uid,/^u-/);inc('rpc:'+name);return {data:null,error:null}};
authAdmin.verifyIdToken=async(token,revoked)=>{assert.equal(revoked,true);auth++;if(token.startsWith('invalid-'))throw Object.assign(Error('fixture revoked'),{code:'auth/id-token-revoked'});return {uid:token}};

import {authenticateFirebase} from '../../dist/middleware/authenticateFirebase.js';
import {drainPickupPush} from '../../dist/orders/pickupPush.js';
const routes={history:'/api/v1/orders',inbox:'/api/v1/notifications',orders:'/api/v1/merchant/orders',shop:'/api/v1/merchant/shop',combined:'/api/v1/rehearsal-combined'};
function lastHandler(router,path){const layer=router.stack.find(l=>l.route?.path===path&&l.route.methods.get);assert.ok(layer);return layer.route.stack.at(-1).handle}
const historyHandler=lastHandler(customerOrderRoutes,'/'),inboxHandler=lastHandler(pickupNotificationRoutes,'/notifications');
async function invoke(handler,req){let status=200,body;await handler(req,{status(n){status=n;return this},json(v){body=v;return this}});assert.ok(body);return {status,body}}
async function lab(run,{reserve=false}={}){
 let now=0;calls={};auth=0;failTable='';heldInbox=null;
 const app=express(),low=createWindowBudget(1,60000,()=>now);
 app.use(createApiAdmission({...DEFAULT_LIMITS},()=>now));
 // Test-only candidate: keep actual shared all/auth caps, charge BOTH existing
 // actor categories for a combined request. No path/header grants authentication.
 app.use((req,res,next)=>{
  const admission=res.locals.apiAdmission;
  if(req.path===routes.combined){const check=admission.afterVerify;admission.afterVerify=uid=>{
   const old=req.originalUrl;try{req.originalUrl=routes.history;if(!check(uid))return false;req.originalUrl=routes.inbox;return check(uid)}finally{req.originalUrl=old}
  }}
  if(reserve&&!req.path.startsWith('/api/v1/merchant/')){const old=admission.beforeVerify;admission.beforeVerify=()=>{const d=low.take('noncritical',450);if(!d.allowed){res.set('Cache-Control','no-store').set('Retry-After',String(d.retryAfter)).status(429).json({success:false,code:'RATE_LIMITED'});return false}return old()}}
  next();
 });
 app.get(routes.combined,authenticateFirebase,async(req,res)=>{
  const [history,inbox]=await Promise.all([invoke(historyHandler,req),invoke(inboxHandler,req)]);
  res.set('Cache-Control','no-store').json({success:true,history,inbox});
 });
 app.use('/api/v1/orders',customerOrderRoutes);app.use('/api/v1',pickupNotificationRoutes);app.use('/api/v1/merchant/orders',merchantOrderRoutes);app.use('/api/v1/merchant',merchantRoutes);
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
 const request=async(kind,uid)=>{const r=await fetch(base+routes[kind],{headers:{Authorization:'Bearer fb-'+uid},signal:AbortSignal.timeout(5000)});const body=await r.json();if(r.status===429)assert.ok(+r.headers.get('retry-after')>0);return {status:r.status,body}};
 try{await run(request,v=>now=v,()=>({calls:{...calls},auth}));}finally{heldInbox?.resolve({data:[],error:null});server.close();await once(server,'close')}
}
function schedule(shops,foreground,active,combined){
 const out=[],add=(kind,uid,period,offset)=>{for(let t=offset;t<120000;t+=period)out.push({kind,uid,t})};
 for(let i=0;i<foreground;i++){const period=i<active?30000:120000,offset=Math.floor(i*period/foreground);add(combined?'combined':'history','u-'+i,period,offset);if(!combined)add('inbox','u-'+i,period,offset)}
 for(let i=0;i<shops;i++){add('orders','m-'+i,15000,Math.floor(i*15000/shops));add('shop','m-'+i,30000,Math.floor(i*30000/shops))}
 return out.sort((a,b)=>a.t-b.t)
}
try{
 for(const [shops,foreground,active] of [[25,100,20],[25,225,79],[100,500,100]])for(const combined of [false,true])for(const reserve of [false,true]){
  await lab(async(request,setNow,counts)=>{
   const windows=[{attempts:0,ok:0,denied:0,merchantDenied:0,customerDenied:0},{attempts:0,ok:0,denied:0,merchantDenied:0,customerDenied:0}];
   for(const e of schedule(shops,foreground,active,combined)){setNow(e.t);const r=await request(e.kind,e.uid),w=windows[Math.floor(e.t/60000)];w.attempts++;
    assert.ok([200,429].includes(r.status));if(r.status===429){w.denied++;w[e.uid.startsWith('m-')?'merchantDenied':'customerDenied']++;continue}w.ok++;
    const b=r.body;assert.equal(b.success,true);
    if(e.kind==='combined'){assert.equal(b.history.status,200);assert.equal(b.inbox.status,200);assert.ok(b.history.body.orders.every(o=>o.user_id===e.uid));assert.ok(b.inbox.body.notifications.every(o=>o.order_id==='order-'+e.uid.slice(2)))}
    if(e.kind==='history')assert.ok(b.orders.every(o=>o.user_id===e.uid));
    if(e.kind==='orders')assert.ok(b.orders.every(o=>o.shop_id==='shop-'+e.uid.slice(2)));
    if(e.kind==='shop')assert.equal(b.shop.owner_id,e.uid);
   }
   assert.ok(windows.every(w=>w.ok<=600));assert.ok(counts().auth<=1200);
   if(shops===25&&foreground===225&&!reserve&&!combined)assert.equal(windows.reduce((n,w)=>n+w.denied,0),90);
   if(shops===25&&foreground===225&&combined&&!reserve)assert.equal(windows.reduce((n,w)=>n+w.denied,0),0);
   emit('SCHEDULE',{shops,foreground,active,combined,reserve,windows,...counts(),writes:0});
  },{reserve});
 }
 await lab(async(request,_now,counts)=>{
  failTable='pickup_order_events';let r=await request('combined','u-1');assert.equal(r.body.history.status,200);assert.equal(r.body.inbox.status,503);
  failTable='orders';r=await request('combined','u-1');assert.equal(r.body.history.status,503);assert.equal(r.body.inbox.status,200);
  failTable='';let resolve;heldInbox={promise:new Promise(r=>resolve=r),resolve};let settled=false;
  const pending=request('combined','u-1').then(r=>{settled=true;return r});await sleep(30);
  const separate=await request('history','u-1');assert.equal(separate.status,200);assert.equal(settled,false);
  resolve({data:[],error:null});await pending;heldInbox=null;
  emit('PARTIAL',{independentStatus:true,historyBlockedByPendingInbox:true,separateHistoryAvailable:true});
  const rejected=await request('combined','invalid-revoked');assert.equal(rejected.status,401);
 });
 await lab(async(request)=>{
  for(let i=0;i<30;i++)assert.equal((await request('combined','u-2')).status,200);
  assert.equal((await request('combined','u-2')).status,429);assert.equal((await request('inbox','u-2')).status,429);assert.equal((await request('history','u-2')).status,200);
  emit('ACTOR',{notificationLimitPreserved:true,combinedChargesBoth:true,historyStillAvailable:true});
 });
 await lab(async(request,_now,counts)=>{
  // Invalid tokens sent to a privileged-looking URL consume the same actual
  // pre-verification budget. Route-based reservation is not trusted priority.
  for(let i=0;i<600;i++)assert.equal((await request('orders','invalid-'+i)).status,401);
  assert.equal((await request('orders','m-1')).status,429);assert.equal(counts().auth,600);
  emit('RESERVE_ATTACK',{unverifiedRouteAttempts:600,validMerchantDenied:true,sharedAuthCap:600});
 },{reserve:true});
 // Empty-claim negative-cache counterexample. Actual drain receives a later
 // eligible synthetic job. Naive TTL skip would defer it; no real send.
 const rpcCalls=[];let eligible=false,sends=0;
 const client={rpc:async(name,args)=>{rpcCalls.push(name);if(name==='pickup_claim_push')return {data:eligible?{id:'job',attempts:1,lease_until:'2026-11-25T00:00:30Z',event_id:'event',order_id:'order',token:'fake-never-send'}:null,error:null};return {data:true,error:null}}};
 const sender=async()=>{sends++};
 await drainPickupPush(client,'u-1',sender);eligible=true;
 // Compare immediate next eligible drain with proposed 60s negative-cache skip.
 const before=sends;await drainPickupPush(client,'u-1',sender);
 assert.equal(before,0);assert.equal(sends,1);assert.deepEqual(rpcCalls,['pickup_claim_push','pickup_claim_push','pickup_push_sendable','pickup_finish_push']);
 emit('CLAIM',{emptyThenEligible:true,actualNextDrainSends:1,naiveSkipWouldDelay:true,externalSends:0});
}finally{supabaseAdmin.from=original.from;supabaseAdmin.rpc=original.rpc;authAdmin.verifyIdToken=original.verify;await deleteApp(fixtureApp)}
