// H6A bounded loopback-only workload. Real router/admission/auth middleware,
// in-memory repositories and verifier; NOT a hosted service or end-to-end DB benchmark.
import assert from 'node:assert/strict';
import express from 'express';
import {once} from 'node:events';
import {performance,monitorEventLoopDelay} from 'node:perf_hooks';
import {makeCatalogRouter} from '../../dist/routes/catalog.js';
import {createApiAdmission,DEFAULT_LIMITS} from '../../dist/middleware/apiAdmission.js';
import {authenticateFirebase} from '../../dist/middleware/authenticateFirebase.js';
import {authAdmin} from '../../dist/lib/firebaseAdmin.js';
const stages=[[1,25,5,2,100,10],[5,100,20,5,200,30],[25,500,100,10,400,80],[100,2500,500,20,800,200]];
const stats=a=>{const v=[...a].sort((a,b)=>a-b);return {n:v.length,p50:+v[Math.ceil(v.length*.5)-1].toFixed(3),p95:+v[Math.ceil(v.length*.95)-1].toFixed(3),p99:+v[Math.ceil(v.length*.99)-1].toFixed(3),max:+v.at(-1).toFixed(3)}};
const emit=(kind,data)=>console.log('H6A_'+kind+' '+JSON.stringify(data));
const original=authAdmin.verifyIdToken;
let authCalls=0;
Object.assign(authAdmin,{verifyIdToken:async(token,revoked)=>{assert.equal(revoked,true);authCalls++;return {uid:token};}});
async function lab(stage,stress=false){
 const [shopCount,population,active,concurrency,count,orders]=stage;
 const shops=Array.from({length:shopCount},(_,i)=>({id:'h6a-shop-'+i,name:'Synthetic shop '+i,is_active:true,lat:-26,lng:28,story:'Synthetic description'}));
 const menus=shops.flatMap(s=>Array.from({length:20},(_,i)=>({id:s.id+'-menu-'+i,shop_id:s.id,name:'Synthetic meal',price:25,is_available:true,description:'Synthetic item'})));
 const calls={shops:0,shop:0,menu:0,batchShops:0,batchMenus:0};
 const app=express();app.use(createApiAdmission());
 app.use('/api/v1/catalog',makeCatalogRouter({
  getApprovedShops:async()=>{calls.shops++;return shops;},
  getApprovedShopById:async id=>{calls.shop++;return shops.find(s=>s.id===id)||null;},
  getMenuByShopId:async id=>{calls.menu++;return menus.filter(s=>s.shop_id===id);},
  getApprovedShopsByIds:async ids=>{calls.batchShops++;return shops.filter(s=>ids.includes(s.id));},
  getMenusByShopIds:async ids=>{calls.batchMenus++;return menus.filter(s=>ids.includes(s.shop_id));}
 },null));
 app.get('/api/v1/protected-fixture',authenticateFirebase,(_req,res)=>res.json({success:true}));
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 const base='http://127.0.0.1:'+server.address().port;
 const delay=monitorEventLoopDelay({resolution:10});delay.enable();
 const rows=[];let rssPeak=process.memoryUsage().rss;const rssBefore=rssPeak;let authBefore=authCalls;
 const sample=setInterval(()=>{rssPeak=Math.max(rssPeak,process.memoryUsage().rss)},10);
 try{
  // Deterministic mix: public list, priority menu, bounded batch, authenticated fixture.
  // Stress uses protected fixture only so 600/min auth then 1200/min all can be observed.
  const n=stress?1300:count,started=performance.now();
  let next=0;
  await Promise.all(Array.from({length:concurrency},async()=>{
   while(true){
    const i=next++;if(i>=n)return;
    const kind=stress?'auth':['catalog','menu','batch','auth'][i%4];
    const shop=shops[Math.floor(i/4)%shopCount];
    const ids=shops.slice(0,Math.min(6,shopCount)).map(s=>s.id);
    const path=kind==='catalog'?'/api/v1/catalog/shops':kind==='menu'?'/api/v1/catalog/shops/'+shop.id+'/menu':kind==='batch'?'/api/v1/catalog/menus?ids='+ids.join(','):'/api/v1/protected-fixture';
    const start=performance.now();
    const response=await fetch(base+path,{headers:{Authorization:'Bearer fb-h6a-'+(Math.floor(i/4)%active)},signal:AbortSignal.timeout(5000)});
    const bytes=await response.arrayBuffer();const ms=performance.now()-start;
    const body=JSON.parse(new TextDecoder().decode(bytes));assert.ok([200,429].includes(response.status));
    if(response.status===429){assert.equal(body.code,'RATE_LIMITED');assert.ok(Number(response.headers.get('retry-after'))>0);}
    else if(kind==='catalog')assert.equal(body.shops.length,shopCount);
    else if(kind==='menu')assert.equal(body.menu_items.length,20);
    else if(kind==='batch'){assert.equal(body.menus.length,ids.length);assert.ok(body.menus.every(s=>s.menu_items.length===20));}
    rows.push({kind,status:response.status,ms,bytes:bytes.byteLength});
   }
  }));
  const elapsed=performance.now()-started;const ok=rows.filter(x=>x.status===200),limited=rows.filter(x=>x.status===429);
  if(!stress)assert.equal(ok.length,n);else{assert.equal(ok.length,600);assert.equal(limited.length,700);assert.equal(authCalls-authBefore,600);}
  emit(stress?'ADMISSION':'API',{shops:shopCount,registered:population,active,concurrency,requests:n,ok:ok.length,limited:limited.length,elapsed_ms:+elapsed.toFixed(1),rps:+(n*1000/elapsed).toFixed(1),goodput_rps:+(ok.length*1000/elapsed).toFixed(1),latency:stats(ok.map(x=>x.ms)),per_route:Object.fromEntries([...new Set(ok.map(x=>x.kind))].map(k=>[k,{...stats(ok.filter(x=>x.kind===k).map(x=>x.ms)),mean_bytes:Math.round(ok.filter(x=>x.kind===k).reduce((a,x)=>a+x.bytes,0)/ok.filter(x=>x.kind===k).length)}])),repository_calls:calls,auth_verifications:authCalls-authBefore,rss_before_bytes:rssBefore,rss_peak_bytes:Math.max(rssPeak,process.memoryUsage().rss),heap_bytes:process.memoryUsage().heapUsed,event_loop_p95_ms:+(delay.percentile(95)/1e6).toFixed(3)});
  if(!stress){
   // Model, not measured traffic: 20% of foreground customers active/unknown,
   // remaining verified idle. One history + one inbox read per tick.
   const activeOrders=Math.ceil(active*.2),idle=active-activeOrders;
   const customerCycles=activeOrders*2+idle*.5;
   const protectedPerMinute=customerCycles*2+shopCount*6;
   emit('DEMAND',{shops:shopCount,registered:population,foreground:active,active_orders:activeOrders,verified_idle:idle,customer_history_per_min:customerCycles,customer_inbox_per_min:customerCycles,merchant_orders_per_min:shopCount*4,merchant_shop_per_min:shopCount*2,protected_per_min:protectedPerMinute,auth_budget_per_min:DEFAULT_LIMITS.auth,all_budget_per_min:DEFAULT_LIMITS.all,auth_budget_utilization_pct:+(100*protectedPerMinute/DEFAULT_LIMITS.auth).toFixed(1),order_journeys_in_db_lab:orders,push_opportunities_if_one_device_each:orders*2,one_visit_catalog_http:shopCount===1?2:3,one_visit_catalog_repository_calls:shopCount===1?3:5,menu_preview_shops:Math.min(6,shopCount)});
  }
 }finally{clearInterval(sample);delay.disable();server.close();await once(server,'close');}
}
try{emit('ENV',{node:process.version,limits:DEFAULT_LIMITS});for(const stage of stages)await lab(stage);await lab(stages.at(-1),true);}finally{Object.assign(authAdmin,{verifyIdToken:original});}
