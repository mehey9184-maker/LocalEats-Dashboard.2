import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMerchantOrderReadCoordinator } from "../src/services/merchantOrderRecovery.ts";
import { readCompleteMerchantInbox } from "../localeats-api/dist/orders/merchantInboxRead.js";
import { drainPickupPush } from "../localeats-api/dist/orders/pickupPush.js";

const shops = Array.from({length:20},(_,i)=>"shop-"+String(i+1).padStart(2,"0"));
const virtualUsers = Array.from({length:5000},(_,i)=>"synthetic-user-"+i);
const asOrder=(id,shop_id,status,created_at)=>({id,shop_id,status,created_at,
  user_id:"synthetic-user",rider_id:null,payment_status:"unpaid",total_price:25});

function makeStore(){
  const store=[];
  const oldPending=asOrder("historic-pending","shop-01","pending","2026-10-01T12:00:00.000Z");
  store.push(oldPending);
  for(let i=0;i<270;i++){
    store.push(asOrder("historic-completed-"+i,"shop-01","collected",
      new Date(Date.UTC(2026,10,1,12,0,i)).toISOString()));
  }
  const allNew=[];
  // Thirty minutes at the *platform* peak 10 orders/minute, not ten/shop.
  for(let minute=0;minute<30;minute++){
    for(let x=0;x<10;x++){
      const id=minute*10+x;
      const row=asOrder("burst-"+id,shops[id%20],"pending",
        new Date(Date.UTC(2026,10,5,7,minute,x)).toISOString());
      row.user_id=virtualUsers[id];store.push(row);allNew.push(row);
    }
  }
  return {store,oldPending,allNew};
}
function apiSource(rows,merchantShop,options={}){
  const scope=rows.filter(r=>r.shop_id===merchantShop);
  const sorted=(values)=>[...values].sort((a,b)=>
    b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id));
  const recent=sorted(scope).slice(0,250);
  const open=sorted(scope.filter(r=>!["collected","cancelled","completed","delivered"].includes(r.status)));
  let calls=0;
  return {
    calls:()=>calls,
    recent:async()=>{calls++;if(options.failRecent)throw Error("Simulated network unavailable");return recent;},
    unfinishedPage:async(start,end)=>{
      calls++;if(options.failSecondPage && start>=250)throw Error("Simulated Supabase page outage");
      return open.slice(start,end+1);
    }
  };
}
function merchantRead(store,scope,options) {
  const source=apiSource(store,scope,options);
  return readCompleteMerchantInbox(source,[scope]);
}

test("30-minute merchant outage: 300 virtual orders across 20 shops, 5000 registered users, no missed pending orders",async()=>{
  const {store,oldPending,allNew}=makeStore();
  assert.equal(virtualUsers.length,5000);
  assert.equal(allNew.length,300);
  assert.equal(new Set(allNew.map(o=>o.id)).size,300);
  assert.equal(new Set(allNew.map(o=>o.shop_id)).size,20);
  for(const shop of shops)
    assert.equal(allNew.filter(o=>o.shop_id===shop).length,15);
  const reader=createMerchantOrderReadCoordinator();
  reader.activate("merchant-1:shop-01");

  // Merchant had a successful sync before a half-hour offline period.
  const before=await reader.refresh("merchant-1:shop-01",
    ()=>merchantRead(store.filter(r=>!r.id.startsWith("burst-")),"shop-01"));
  assert.equal(before.kind,"fresh");
  let verified=before.rows;

  // During outage: no API calls, no queueing browser mutations, no local cache.
  const disconnected=await reader.refresh("merchant-1:shop-01",
    ()=>merchantRead(store,"shop-01",{failRecent:true}));
  assert.equal(disconnected.kind,"failed");
  assert.equal(verified.length,251,"Failure preserves the last verified 250 recent plus older pending row, with a warning");

  // First online recovery fetch is authoritative. The older unfinished order
  // is absent from a naive newest-250 query, but present after reconciliation.
  const oldCap=apiSource(store,"shop-01");
  assert.equal((await oldCap.recent()).some(x=>x.id===oldPending.id),false);
  const after=await reader.refresh("merchant-1:shop-01",()=>merchantRead(store,"shop-01"));
  assert.equal(after.kind,"fresh");
  verified=after.rows;
  assert.ok(verified.some(x=>x.id===oldPending.id));
  assert.equal(verified.filter(x=>x.status==="pending").length,16);
  assert.equal(new Set(verified.map(x=>x.id)).size,verified.length);

  // Recovery separately scoped to another verified shop cannot leak data.
  reader.activate("merchant-1:shop-02");
  const second=await reader.refresh("merchant-1:shop-02",()=>merchantRead(store,"shop-02"));
  assert.equal(second.kind,"fresh");
  assert.equal(second.rows.length,15);
  assert.ok(second.rows.every(row=>row.shop_id==="shop-02"));
});

test("privacy: changing shop during an unfinished read discards prior results even after reconnect",async()=>{
  const {store}=makeStore(),reader=createMerchantOrderReadCoordinator();
  reader.activate("merchant-1:shop-01");
  let release;
  const held=new Promise(resolve=>release=resolve);
  const old=reader.refresh("merchant-1:shop-01",async()=>{
    await held;return merchantRead(store,"shop-01");
  });
  reader.activate("merchant-1:shop-02");
  const fresh=await reader.refresh("merchant-1:shop-02",()=>merchantRead(store,"shop-02"));
  release();
  assert.equal((await old).kind,"stale");
  assert.equal(fresh.kind,"fresh");
  assert.ok(fresh.rows.every(row=>row.shop_id==="shop-02"));
  const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
  assert.match(app,/useLayoutEffect\(\(\)=>\{\s*orderReadCoordinator\.current\.activate\(orderReadScope\);\s*setOrders\(\[\]\);/);
});

test("notification outbox: transient FCM failure survives a 30-minute outage and is retried only on a later request",async()=>{
  let now=0,attempts=0,sends=0;
  const job={id:"synthetic-job",attempts:0,lease_until:"",
    event_id:"event-1",order_id:"order-1",token:"synthetic-fcm-token",state:"pending",next:0};
  const rpc={rpc:async(name,args)=>{
    if(name==="pickup_claim_push"){
      if(job.state!=="pending"||now<job.next)return {data:null,error:null};
      job.state="sending";job.attempts++;job.lease_until=String(now+30);
      return {data:{id:job.id,attempts:job.attempts,lease_until:job.lease_until,
        event_id:job.event_id,order_id:job.order_id,token:job.token},error:null};
    }
    if(name==="pickup_push_sendable")
      return {data:job.state==="sending"&&args.p_attempt===job.attempts,error:null};
    if(name==="pickup_finish_push"){
      attempts++;
      assert.equal(args.p_attempt,job.attempts);
      job.state=args.p_sent?"sent":args.p_permanent?"abandoned":"pending";
      if(!args.p_sent)job.next=now+60;
      return {data:true,error:null};
    }
    throw Error("Unexpected RPC "+name);
  }};
  await drainPickupPush(rpc,"customer-1",async()=>{
    sends++;throw Object.assign(new Error("FCM outage"),{code:"messaging/unavailable"});
  });
  assert.equal(job.state,"pending");
  assert.equal(attempts,1);
  assert.equal(sends,1);
  now=30*60;
  await drainPickupPush(rpc,"customer-1",async()=>{sends++;});
  assert.equal(job.state,"sent");
  assert.equal(job.attempts,2);
  assert.equal(attempts,2);
  assert.equal(sends,2);
  // "sent" here means accepted by our fake sender, NOT delivered on device.
});

test("notification outbox: invalid device token is abandoned without retry storm",async()=>{
  let state="pending",attempt=0,finishes=0;
  const rpc={rpc:async(name,args)=>{
    if(name==="pickup_claim_push"){
      if(state!=="pending")return {data:null,error:null};
      state="sending";attempt++;return {data:{id:"j",attempts:attempt,lease_until:"fence",
        token:"synthetic-device",event_id:"e",order_id:"o"},error:null};
    }
    if(name==="pickup_push_sendable")return {data:true,error:null};
    if(name==="pickup_finish_push"){
      finishes++;assert.equal(args.p_permanent,true);assert.equal(args.p_sent,false);
      state="abandoned";return {data:true,error:null};
    }
    throw Error("Unexpected RPC "+name);
  }};
  await drainPickupPush(rpc,"customer-1",async()=>{throw Object.assign(
    new Error("revoked"),{code:"messaging/registration-token-not-registered"});});
  await drainPickupPush(rpc,"customer-1",async()=>{throw Error("Must not retry invalid token");});
  assert.equal(state,"abandoned");
  assert.equal(attempt,1);
  assert.equal(finishes,1);
});

test("launch remains blocked: pickup writes, payment claims, rider activation and DB mutation stay disabled",()=>{
 const merchant=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
 const pickup=readFileSync(new URL("../localeats-api/src/middleware/pickupWriteGate.ts",import.meta.url),"utf8");
 assert.match(merchant,/pickupOrderingEnabled/);
 assert.match(pickup,/PICKUP_WRITES_ENABLED/);
 assert.match(merchant,/orderReadCoordinator/);
 assert.doesNotMatch(merchant,/localStorage\.setItem\(["']localeats_cached_orders/);
});
