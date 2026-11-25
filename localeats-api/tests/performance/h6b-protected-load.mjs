// H6B actual protected routes, fabricated read-only Supabase adapter and auth.
// No external traffic; all simulated DB calls counted, including empty outbox claims.
import assert from 'node:assert/strict';
import express from 'express';
import {once} from 'node:events';
import {performance,monitorEventLoopDelay} from 'node:perf_hooks';
import {setTimeout as sleep} from 'node:timers/promises';
import {createApiAdmission,DEFAULT_LIMITS} from '../../dist/middleware/apiAdmission.js';
import {authAdmin} from '../../dist/lib/firebaseAdmin.js';
import {supabaseAdmin} from '../../dist/lib/supabaseAdmin.js';
import {customerOrderRoutes,merchantOrderRoutes} from '../../dist/routes/orders.js';
import {pickupNotificationRoutes} from '../../dist/routes/pickupNotifications.js';
import merchantRoutes from '../../dist/routes/merchant.js';
const emit=(kind,x)=>console.log('H6B_'+kind+' '+JSON.stringify(x));
const stat=a=>{const v=[...a].sort((a,b)=>a-b);const q=p=>+v[Math.ceil(v.length*p)-1].toFixed(3);return {p50:q(.5),p95:q(.95),p99:q(.99),max:q(1)}};
let calls={},auth=0;
const original={from:supabaseAdmin.from,rpc:supabaseAdmin.rpc,verify:authAdmin.verifyIdToken};
const shops=Array.from({length:100},(_,i)=>({id:'shop-'+i,owner_id:'m-'+i,approval_status:'approved',is_active:true,effective_is_active:true,availability_revision:0,archived_at:null,lat:-26,lng:28}));
const orders=Array.from({length:2500},(_,i)=>({id:'order-'+i,user_id:'u-'+i,shop_id:'shop-'+i%100,delivery_type:'collection',status:i%5===0?'pending':'collected',payment_status:i%5===0?'unpaid':'paid',delivery_status:'none',revision:i%5===0?0:4,total_price:25,items:[]}));
const events=orders.filter(o=>o.status==='collected').map(o=>({id:'event-'+o.id,order_id:o.id,recipient_uid:o.user_id,kind:'ready',occurred_at:'2026-11-25T00:00:00Z'}));
const inc=k=>calls[k]=(calls[k]||0)+1;
supabaseAdmin.from=function(table){
 let rows=table==='orders'?orders:table==='pickup_order_events'?events:table==='shops'||table==='shops_with_availability'?shops:null;
 assert.ok(rows,'unexpected table '+table);
 let range=false,filtered=false;
 const q={select(){return q},eq(k,v){rows=rows.filter(x=>x[k]===v);return q},is(k,v){rows=rows.filter(x=>x[k]===v);return q},in(k,v){rows=rows.filter(x=>v.includes(x[k]));return q},or(){filtered=true;rows=rows.filter(x=>x.status==='pending');return q},order(){return q},limit(n){rows=rows.slice(0,n);return q},range(a,b){range=true;rows=rows.slice(a,b+1);return q},then(resolve,reject){inc(table+(range?':unfinished':filtered?':filter':''));return Promise.resolve({data:rows,error:null}).then(resolve,reject)}};
 return q;
};
supabaseAdmin.rpc=async(name,args)=>{assert.equal(name,'pickup_claim_push');assert.match(args.p_uid,/^u-/);inc('rpc:'+name);return {data:null,error:null}};
authAdmin.verifyIdToken=async(token,revoked)=>{assert.equal(revoked,true);auth++;return {uid:token}};
const endpoints={history:'/api/v1/orders',inbox:'/api/v1/notifications',orders:'/api/v1/merchant/orders',shop:'/api/v1/merchant/shop'};
async function lab(run){
 let now=0;calls={};auth=0;
 const app=express();app.use(createApiAdmission({...DEFAULT_LIMITS},()=>now));
 app.use('/api/v1/orders',customerOrderRoutes);app.use('/api/v1',pickupNotificationRoutes);app.use('/api/v1/merchant/orders',merchantOrderRoutes);app.use('/api/v1/merchant',merchantRoutes);
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
 const request=async(kind,uid)=>{const t=performance.now(),res=await fetch(base+endpoints[kind],{headers:{Authorization:'Bearer fb-'+uid},signal:AbortSignal.timeout(5000)});const body=await res.json();
  assert.ok([200,429].includes(res.status),'unexpected '+res.status+' '+kind);
  if(res.status===429){assert.equal(body.code,'RATE_LIMITED');assert.ok(+res.headers.get('retry-after')>0);}
  else {assert.equal(body.success,true);if(kind==='history')assert.ok(body.orders.every(o=>o.user_id===uid));if(kind==='orders')assert.ok(body.orders.every(o=>o.shop_id==='shop-'+uid.slice(2)));if(kind==='shop')assert.equal(body.shop.owner_id,uid);if(kind==='inbox')assert.ok(body.notifications.every(e=>e.order_id==='order-'+uid.slice(2)));}
  return {kind,status:res.status,ms:performance.now()-t};
 };
 try{await run(request,v=>now=v,()=>({calls:{...calls},auth}));}finally{server.close();await once(server,'close')}
}
try{
 // Same fixed 100 shops, 2500 orders, 2000 events every run. Three repeats;
 // 400 protected requests/4 seconds, paced 100/s; compare worker ceiling.
 for(let rep=1;rep<=3;rep++)for(const concurrency of [5,10,20])await lab(async(request,setNow,counts)=>{
  const delay=monitorEventLoopDelay({resolution:10});delay.enable();const cpu=process.cpuUsage(),start=performance.now();let peak=process.memoryUsage().rss;
  const timer=setInterval(()=>peak=Math.max(peak,process.memoryUsage().rss),10),rows=[];
  try{for(let batch=0;batch<400;batch+=concurrency){await sleep(Math.max(0,start+batch*10-performance.now()));
   rows.push(...await Promise.all(Array.from({length:Math.min(concurrency,400-batch)},(_,j)=>{const i=batch+j,k=['history','inbox','orders','shop'][i%4];return request(k,(i%4<2?'u-':'m-')+Math.floor(i/4)%100)})));
  }const elapsed=performance.now()-start,usage=process.cpuUsage(cpu);assert.equal(rows.length,400);assert.ok(rows.every(r=>r.status===200));const countsNow=counts();assert.equal(countsNow.auth,400);
  assert.equal(countsNow.calls['rpc:pickup_claim_push'],100);
  emit('HTTP',{rep,concurrency,requests:400,elapsed_ms:+elapsed.toFixed(1),rps:+(400000/elapsed).toFixed(2),latency:stat(rows.map(x=>x.ms)),by_route:Object.fromEntries(Object.keys(endpoints).map(k=>[k,stat(rows.filter(x=>x.kind===k).map(x=>x.ms))])),...countsNow,cpu_ms:(usage.user+usage.system)/1000,cpu_one_core_pct:+((usage.user+usage.system)/10/elapsed).toFixed(2),rss_peak_bytes:Math.max(peak,process.memoryUsage().rss),heap_bytes:process.memoryUsage().heapUsed,event_loop_p95_ms:+(delay.percentile(95)/1e6).toFixed(3)});
  }finally{clearInterval(timer);delay.disable()}
 });
 // Real-time sustained sub-cap trial: 8 protected requests/s for 65 seconds.
 await lab(async(request,setNow,counts)=>{
  const started=performance.now(),cpu=process.cpuUsage(),rows=[];let peak=process.memoryUsage().rss;
  const timer=setInterval(()=>peak=Math.max(peak,process.memoryUsage().rss),100);
  try{for(let i=0;i<520;i++){await sleep(Math.max(0,started+i*125-performance.now()));setNow(Math.floor(performance.now()-started));const k=['history','inbox','orders','shop'][i%4];rows.push(await request(k,(i%4<2?'u-':'m-')+Math.floor(i/4)%100));}
  const elapsed=performance.now()-started,used=process.cpuUsage(cpu);assert.ok(rows.every(r=>r.status===200));assert.equal(counts().auth,520);
  emit('SUSTAINED',{requests:520,elapsed_ms:+elapsed.toFixed(1),rps:+(520000/elapsed).toFixed(2),latency:stat(rows.map(x=>x.ms)),...counts(),cpu_ms:(used.user+used.system)/1000,rss_peak_bytes:peak,heap_bytes:process.memoryUsage().heapUsed,mutations:0});
  }finally{clearInterval(timer)}
 });
 // Actual middleware and routes, virtual time 2 exact windows, phase-spread steady polling.
 for(const [shopCount,foreground,active] of [[1,5,1],[5,20,4],[25,100,20],[25,225,79],[100,500,100]])await lab(async(request,setNow,counts)=>{
  const schedule=[];const add=(kind,uid,period,offset)=>{for(let t=offset;t<120000;t+=period)schedule.push({kind,uid,t})};
  for(let i=0;i<foreground;i++){const period=i<active?30000:120000;const offset=Math.floor(i*period/foreground);add('history','u-'+i,period,offset);add('inbox','u-'+i,period,offset);}
  for(let i=0;i<shopCount;i++){add('orders','m-'+i,15000,Math.floor(i*15000/shopCount));add('shop','m-'+i,30000,Math.floor(i*30000/shopCount));}
  schedule.sort((a,b)=>a.t-b.t);
  const windows=[{attempts:0,ok:0,limited:0,by:{}},{attempts:0,ok:0,limited:0,by:{}}];
  for(const e of schedule){setNow(e.t);const r=await request(e.kind,e.uid),w=windows[Math.floor(e.t/60000)];w.attempts++;w[r.status===200?'ok':'limited']++;const a=w.by[e.kind]??={ok:0,limited:0};a[r.status===200?'ok':'limited']++;}
  assert.ok(windows.every(w=>w.ok<=600));if(shopCount<=5)assert.ok(windows.every(w=>w.limited===0));if(shopCount===100)assert.ok(windows.every(w=>w.limited>0));
  emit('POLL',{shops:shopCount,foreground,active,virtual_ms:120000,windows,...counts(),provider_sends:0,mutations:0});
 });
}finally{supabaseAdmin.from=original.from;supabaseAdmin.rpc=original.rpc;authAdmin.verifyIdToken=original.verify}
