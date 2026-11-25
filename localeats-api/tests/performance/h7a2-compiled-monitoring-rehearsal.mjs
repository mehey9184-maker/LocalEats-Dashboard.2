// SYNTHETIC ONLY. Run after API build, in loopback-only network namespace.
import assert from 'node:assert/strict';
import express from 'express';
import {once} from 'node:events';
import {request as httpRequest} from 'node:http';
import {performance} from 'node:perf_hooks';
import {setTimeout as sleep} from 'node:timers/promises';
import {createApiAdmission,beforeFirebaseVerification,afterFirebaseVerification,DEFAULT_LIMITS} from '../../dist/middleware/apiAdmission.js';
import {drainPickupPush} from '../../dist/orders/pickupPush.js';
const MAX=4294967295;
const names=['read','write','other'], outcomes=['ok','denied','failed','aborted','other'];
function collector(initial=0){
 const counts=new Uint32Array(15);counts[0]=initial;
 let dropped=0;
 return {record(family,outcome){const f=names.indexOf(family),o=outcomes.indexOf(outcome);if(f<0||o<0){dropped=Math.min(MAX,dropped+1);return;}const i=f*5+o;if(counts[i]===MAX){dropped=Math.min(MAX,dropped+1);return;}counts[i]++;},
 snapshot(){return {counts:Array.from(counts),dropped,bytes:counts.byteLength}}};
}
// A single pending synthetic export at most. No promise queue or retries. Never call a real sink.
// A synchronous/blocking arbitrary sink is not approved for production.
function exporter(sink){
 let pending=false,dropped=0,failed=0;
 return {offer(snapshot){if(pending){dropped=Math.min(MAX,dropped+1);return;}pending=true;
   Promise.resolve().then(()=>sink(snapshot)).catch(()=>{failed=Math.min(MAX,failed+1);}).finally(()=>{pending=false;});
 },state(){return {pending,dropped,failed}}};
}
function observer(c){
 return (req,res,next)=>{
   const family=req.method==='GET'||req.method==='HEAD'?'read':req.method==='POST'?'write':'other';let done=false;
   const finish=()=>complete(false),close=()=>complete(!res.writableFinished);
   function complete(aborted){if(done)return;done=true;res.off('finish',finish);res.off('close',close);
     try{c.record(family,aborted?'aborted':res.statusCode===429?'denied':res.statusCode>=500?'failed':res.statusCode>=200&&res.statusCode<300?'ok':'other');}catch{}
   }
   res.once('finish',finish);res.once('close',close);next();
 };
}
async function lab(mode,run){
 const c=collector();let mutations=0,verified=0,clock=0,entered,release;
 const enter=new Promise(r=>entered=r),hold=new Promise(r=>release=r);
 const app=express();
 if(mode==='observed')app.use(observer(c));
 if(mode==='throwing')app.use(observer({record(){throw Error('synthetic failure');}}));
 app.use(createApiAdmission({...DEFAULT_LIMITS},()=>clock));
 // Actual compiled admission functions, synthetic authentication boundary only.
 app.use((req,res,next)=>{if(!beforeFirebaseVerification(res))return;verified++;const uid=req.headers['x-fixture-actor'];
   if(!afterFirebaseVerification(res,typeof uid==='string'?uid:'fixture'))return;next();});
 app.get('/api/v1/read',(req,res)=>res.json({ok:true}));
 app.post('/api/v1/write',(req,res)=>{mutations++;res.json({receipt:'synthetic',count:mutations});});
 app.get('/api/v1/fail',(req,res)=>res.status(503).json({ok:false}));
 app.get('/api/v1/hold',async(req,res)=>{entered();await hold;if(!res.destroyed)res.json({ok:true});});
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 const base='http://127.0.0.1:'+server.address().port;
 const send=async(path,actor='fixture',method='GET')=>{const r=await fetch(base+path,{method,headers:{'x-fixture-actor':actor},signal:AbortSignal.timeout(5000)});return {status:r.status,retry:r.headers.get('retry-after'),body:await r.json()};};
 try{return await run({send,base,c,enter,release,counts:()=>({mutations,verified}),advance:()=>{clock+=60000;}});}
 finally{release();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
async function parity(mode){
 return lab(mode,async({send,counts,c})=>{
  const results=[];
  for(let i=0;i<241;i++){const r=await send('/api/v1/read?synthetic-secret=NEVER_EXPORT','same');results.push(r.status);if(i===240)assert.equal(r.retry,'60');}
  for(let i=0;i<60;i++)assert.equal((await send('/api/v1/write','writer','POST')).status,200);
  const blocked=await send('/api/v1/write','writer','POST');assert.equal(blocked.status,429);assert.equal(blocked.retry,'60');
  for(let i=0;i<298;i++)assert.equal((await send('/api/v1/read','actor-'+i)).status,200);
  const denied=await send('/api/v1/read','last');assert.equal(denied.status,429);assert.equal(denied.retry,'60');
  assert.equal(counts().verified,600);assert.equal(counts().mutations,60);
  assert.deepEqual(results,[...Array(240).fill(200),429]);
  if(mode==='observed'){const s=c.snapshot();assert.equal(s.counts.reduce((a,b)=>a+b,0),601);assert.equal(s.counts[1]+s.counts[6],3);assert.ok(!JSON.stringify(s).includes('NEVER_EXPORT'));}
  return {verified:counts().verified,mutations:counts().mutations,denied:3};
 });
}
const base=await parity('baseline');assert.deepEqual(await parity('observed'),base);assert.deepEqual(await parity('throwing'),base);
await lab('observed',async({send,base,c,enter,release,advance})=>{
 assert.equal((await send('/api/v1/fail')).status,503);
 const r=httpRequest(base+'/api/v1/hold',{headers:{'x-fixture-actor':'aborted'}});
 r.on('error',()=>{});r.end();await enter;r.destroy();
 for(let i=0;i<100&&c.snapshot().counts[3]===0;i++)await sleep(10);
 assert.equal(c.snapshot().counts[3],1);release();await sleep(20);
 assert.equal(c.snapshot().counts[3],1);assert.equal(c.snapshot().counts[2],1);
 advance();assert.equal((await send('/api/v1/read')).status,200);
 assert.equal(c.snapshot().counts[0],1);
});
const saturated=collector(MAX);saturated.record('read','ok');assert.equal(saturated.snapshot().counts[0],MAX);assert.equal(saturated.snapshot().dropped,1);
for(let i=0;i<10000;i++)saturated.record('private-'+i,'ok');assert.equal(saturated.snapshot().counts.length,15);assert.equal(saturated.snapshot().dropped,10001);
let unlock;const locked=new Promise(r=>unlock=r);const slow=exporter(()=>locked);
slow.offer({counts:[1]});for(let i=0;i<10000;i++)slow.offer({counts:[1]});assert.deepEqual(slow.state(),{pending:true,dropped:10000,failed:0});unlock();await sleep(0);assert.equal(slow.state().pending,false);
const rejected=exporter(async()=>{throw Error('synthetic secret');});rejected.offer({counts:[1]});await sleep(0);assert.deepEqual(rejected.state(),{pending:false,dropped:0,failed:1});
const thrown=exporter(()=>{throw Error('synthetic secret');});thrown.offer({counts:[1]});await sleep(0);assert.deepEqual(thrown.state(),{pending:false,dropped:0,failed:1});
// Urgent integrity or unknown outcome is not a routine warning and must not wait three windows.
const urgency=({integrity,unknown,overdue,verified})=>integrity?'critical':unknown||overdue?'priority':verified?'normal':'unknown';
assert.equal(urgency({integrity:true}),'critical');assert.equal(urgency({unknown:true}),'priority');assert.equal(urgency({overdue:true}),'priority');assert.equal(urgency({}),'unknown');
// Real compiled outbox drain with synthetic RPC and no provider. Preserve generation and exact lease.
const calls=[];let eligible=false,sends=0;
const lease='2026-11-25T00:00:30Z';
const client={rpc:async(name,args)=>{calls.push({name,args});if(name==='pickup_claim_push')return {data:eligible?{id:'fixture',attempts:2,lease_until:lease,event_id:'event',order_id:'order',token:'never-send'}:null,error:null};return {data:true,error:null};}};
const outbox=exporter(async()=>{throw Error('telemetry failed');});
await drainPickupPush(client,'fixture',async()=>{sends++;});outbox.offer({counts:[0]});eligible=true;
await drainPickupPush(client,'fixture',async()=>{sends++;});await sleep(0);
assert.equal(sends,1);assert.deepEqual(calls.map(x=>x.name),['pickup_claim_push','pickup_claim_push','pickup_push_sendable','pickup_finish_push']);
for(const x of calls.slice(2)){assert.equal(x.args.p_attempt,2);assert.equal(x.args.p_lease,lease);}
assert.equal(calls.at(-1).args.p_sent,true);
assert.equal(outbox.state().failed,1);
const times=[];
for(let trial=0;trial<3;trial++)for(const mode of trial%2?['observed','baseline']:['baseline','observed']){
 const stats=await lab(mode,async({send,c})=>{for(let i=0;i<20;i++)await send('/api/v1/read','warm-'+i);const t=performance.now();for(let i=0;i<300;i++)assert.equal((await send('/api/v1/read','bench-'+i)).status,200);return {ms:+(performance.now()-t).toFixed(3),bytes:c.snapshot().bytes};});
 times.push({trial,mode,...stats});
}
console.log('H7A2_COMPILED_REHEARSAL '+JSON.stringify({parity:base,abortedOnce:true,asyncSinkBounded:true,saturation:true,immediateUrgency:true,outboxFence:true,times,scope:'actual compiled admission/outbox; synthetic HTTP handlers/auth/sink; not deployed runtime or production order mutation'}));
