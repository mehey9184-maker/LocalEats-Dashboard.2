/**
 * SYNTHETIC simulation, not a hosted capacity/latency test.
 * It imports the production pickup service but substitutes all persistence,
 * connectivity, customer details, shops and messaging with disposable fakes.
 * No network or live database access.
 *
 * From repository root:
 *   npm ci --prefix localeats-api
 *   npm run build --prefix localeats-api
 *   node --test localeats-api/tests/synthetic-180day-load.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { parsePickupInput, pickupPricing, pickupQuote, createPickup } from "../dist/orders/pickupService.js";

const CFG = Object.freeze({
  days:180, shops:20, virtualUsers:5000, ordersPerDay:150,
  burstMinutes:15, burstPerMinute:10, topTwoShopShare:0.45,
  beforeCommitFaultChance:0.02, committedResponseLostChance:0.08,
  duplicateClickChance:0.10, pushTemporaryFaultChance:0.12,
  pushUnavailableDeviceChance:0.035, attemptsPerOrder:6
});
const seedRng=(seed)=>()=>{
  let x=(seed=(Math.imul(seed,1664525)+1013904223)>>>0);
  return x/4294967296;
};
const uuid=(i)=>i.toString(16).padStart(8,"0")+"-0000-4000-8000-"+i.toString(16).padStart(12,"0");
const shopId=(i)=>"shop-"+String(i).padStart(2,"0");
const shop=(i)=>({
  id:shopId(i),name:"Synthetic Kitchen",location:"Tembisa",is_active:true,
  approval_status:"approved",archived_at:null,latitude:-26,longitude:28,lat:-26,lng:28
});
const menu=(id)=>({id:"item-"+id,shop_id:id,name:"Synthetic Meal",price:25,is_available:true});
const raw=(i,id,quantity)=>({
  contract_version:"pickup-v1",idempotency_key:uuid(i+1),
  shop_id:id,items:[{menu_item_id:"item-"+id,quantity}],
  delivery_type:"collection",delivery_schedule_mode:"standard",payment_method:"cash",
  customer_details:{name:"Synthetic Customer",phone:"+27712345678"},
  launch_location:{lat:-26,lng:28}
});

function sandbox(seed=1042026) {
  const random=seedRng(seed);
  const orders=new Map(), merchantInbox=new Map(), outbox=[];
  const shops=Array.from({length:CFG.shops},(_,i)=>shop(i));
  const shopsById=new Map(shops.map(s=>[s.id,s]));
  const repository={
    findOrderByIdempotencyKey:async key=>orders.get(key)||null,
    findShop:async id=>shopsById.get(id)||null,
    findMenuItems:async(id,itemIds)=>itemIds.includes("item-"+id)?[menu(id)]:[],
    insertOrder:async()=>{throw Error("Nonatomic order insertion is forbidden in this test");}
  };
  const counters={rpcCalls:0,preCommitFailures:0,lostAcknowledgments:0,
    attempts:0,replays:0,duplicateClicks:0,otherFailures:0};
  const rpc={async rpc(name,args){
    assert.equal(name,"pickup_create_order");
    counters.rpcCalls++;
    const record=args.p_record,hash=args.p_intent_hash,uid=args.p_uid;
    const old=orders.get(record.idempotency_key);
    if(old){
      if(old.create_intent_hash!==hash||old.user_id!==uid)
        return {data:null,error:{message:"IDEMPOTENCY_CONFLICT"}};
      return {data:{order:old,replayed:true},error:null};
    }
    if(random()<CFG.beforeCommitFaultChance){
      counters.preCommitFailures++;
      return {data:null,error:{message:"Synthetic database outage"}};
    }
    // Atomic stand-in for pickup_create_order: record + durable inbox + outbox.
    // No async boundaries, so two simultaneous attempts cannot both commit.
    const order={...record,id:uuid(1000000+orders.size),user_id:uid,
      create_intent_hash:hash,status:"pending",delivery_type:"collection",
      payment_status:"unpaid",revision:0};
    orders.set(record.idempotency_key,order);
    if(!merchantInbox.has(order.shop_id))merchantInbox.set(order.shop_id,[]);
    merchantInbox.get(order.shop_id).push(order.id);
    outbox.push({order_id:order.id,shop_id:order.shop_id,
      delivered:false,unavailable:false,attempts:0});
    if(random()<CFG.committedResponseLostChance){
      counters.lostAcknowledgments++;
      throw Error("Synthetic response lost after successful database commit");
    }
    return {data:{order,replayed:false},error:null};
  }};
  return {repository,rpc,orders,merchantInbox,outbox,counters,random};
}
async function pricedRequest(repository,i,id,quantity,cache) {
  const input=raw(i,id,quantity);
  const name=id+"-"+quantity;
  let quote=cache.get(name);
  if(!quote){
    quote=pickupQuote(await pickupPricing(repository,"synthetic",parsePickupInput(input,false)));
    cache.set(name,quote);
  }
  return parsePickupInput({...input,consent:{
    currency:"ZAR",total_minor:quote.total_minor,pricing_fingerprint:quote.pricing_fingerprint
  }},true);
}
async function submitWithRetry(box,uid,request) {
  for(let attempt=0;attempt<CFG.attemptsPerOrder;attempt++){
    box.counters.attempts++;
    try{
      const result=await createPickup(box.rpc,box.repository,uid,request);
      if(result.replayed)box.counters.replays++;
      return result.order;
    }catch(error){
      if(error && typeof error==="object" && error.status===409)throw error;
      if(attempt===CFG.attemptsPerOrder-1)throw error;
      // The same exact intent/key is retained; never create a second order
      // or silently change the agreed price on an unknown outcome.
    }
  }
  throw Error("Unreachable retry limit");
}
function chooseShop(random) {
  if(random()<CFG.topTwoShopShare)return random()<0.5?shopId(0):shopId(1);
  return shopId(2+Math.floor(random()*(CFG.shops-2)));
}
async function runSixMonths() {
  const box=sandbox(),priceCache=new Map();
  const usersSeen=new Set(),peakPerShop=new Map(),ordersPerShop=new Map();
  let intended=0,remaining=0;
  assert.equal(CFG.burstPerMinute*CFG.burstMinutes,CFG.ordersPerDay);
  for(let day=0;day<CFG.days;day++){
    for(let minute=0;minute<CFG.burstMinutes;minute++){
      const batch=[];
      for(let slot=0;slot<CFG.burstPerMinute;slot++){
        const i=day*CFG.ordersPerDay+minute*CFG.burstPerMinute+slot;
        intended++;
        const id=chooseShop(box.random),uid="customer-"+String(i%CFG.virtualUsers).padStart(4,"0");
        usersSeen.add(uid);
        ordersPerShop.set(id,(ordersPerShop.get(id)||0)+1);
        if(day===0)peakPerShop.set(id,(peakPerShop.get(id)||0)+1);
        batch.push((async()=>{
          const req=await pricedRequest(box.repository,i,id,1+(i%3),priceCache);
          const order=await submitWithRetry(box,uid,req);
          assert.equal(order.shop_id,id);
          assert.equal(order.user_id,uid);
          assert.equal(order.payment_status,"unpaid");
          if(box.random()<CFG.duplicateClickChance){
            box.counters.duplicateClicks++;
            const same=await submitWithRetry(box,uid,req);
            assert.equal(same.id,order.id);
          }
        })());
      }
      await Promise.all(batch);
    }
    if(day===0)remaining=peakPerShop.size;
  }
  assert.equal(intended,CFG.days*CFG.ordersPerDay);
  assert.equal(usersSeen.size,CFG.virtualUsers);
  assert.equal(ordersPerShop.size,CFG.shops);
  assert.equal(box.orders.size,intended,"Each intent must have exactly one persisted order");
  const inboxSize=[...box.merchantInbox.values()].reduce((a,events)=>a+events.length,0);
  assert.equal(inboxSize,intended,"Every committed order appears in a durable merchant inbox");
  assert.equal(box.outbox.length,intended,"Every order must enqueue one independent notification attempt");
  const uniqueIds=new Set([...box.orders.values()].map(o=>o.id));
  assert.equal(uniqueIds.size,intended);
  for(const job of box.outbox){
    if(box.random()<CFG.pushUnavailableDeviceChance){
      job.unavailable=true;
      continue;
    }
    for(let attempt=0;attempt<5;attempt++){
      job.attempts++;
      if(box.random()>=CFG.pushTemporaryFaultChance){
        job.delivered=true;break;
      }
    }
  }
  const delivered=box.outbox.filter(j=>j.delivered).length;
  const unavailable=box.outbox.filter(j=>j.unavailable).length;
  const missed=box.outbox.length-delivered;
  const busiest=[...peakPerShop.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4)
    .map(([id,count])=>({shop:id,ordersIn15Minutes:count,
      // Illustration only: kitchen can prepare one order in 8 minutes, one station.
      backlogAfterBurstAtOnePer8Minutes:Math.max(0,count-Math.ceil(CFG.burstMinutes/8))}));
  return {
    type:"synthetic offline correctness model; NOT a real Supabase/Vercel/Firebase load result",
    configuration:CFG,ordersIntended:intended,ordersCommitted:box.orders.size,
    uniqueCustomersWhoOrdered:usersSeen.size,shopsWithOrders:ordersPerShop.size,
    peakOrderArrivalsPerMinute:CFG.burstPerMinute,
    persistedMerchantInboxEntries:inboxSize,
    repeatSubmissions:box.counters.duplicateClicks,
    replayedResponses:box.counters.replays,
    transientPrecommitFailures:box.counters.preCommitFailures,
    committedButResponseLost:box.counters.lostAcknowledgments,
    totalCreateAttempts:box.counters.attempts,
    pushAttempts:box.outbox.reduce((n,j)=>n+j.attempts,0),
    pushDelivered:delivered,pushNotDelivered:missed,pushUnavailableDevices:unavailable,
    peakShopQueueExample:busiest,
    diskProjections:{
      scenarioBytesPerOrder:[4096,8192,16384,24576],
      // These are assumptions, not measured database row sizes.
      projectedOrderRelatedMB:[4096,8192,16384,24576].map(b=>Math.round(intended*b/1_000_000)),
      currentObservedDatabaseMB:21
    },
    sustained10PerMinuteFor180Days:10*60*24*CFG.days
  };
}
test("180 days, 5000 users, 20 shops, 150 orders/day, 10/min peak, retries, and push failures",{
  timeout:120000
},async()=>{
  const result=await runSixMonths();
  assert.equal(result.ordersIntended,27000);
  assert.equal(result.ordersCommitted,27000);
  assert.ok(result.transientPrecommitFailures>0);
  assert.ok(result.committedButResponseLost>0);
  assert.ok(result.replayedResponses>0);
  assert.ok(result.pushNotDelivered>0,"Notifications cannot be assumed guaranteed");
  assert.equal(result.persistedMerchantInboxEntries,result.ordersCommitted);
  console.log("SYNTHETIC_LOAD_RESULT "+JSON.stringify(result));
});

test("the real pickup service rejects key reuse by another customer or with changed intent",async()=>{
  const box=sandbox(8),cache=new Map(),id=shopId(0),uid="customer-a";
  const request=await pricedRequest(box.repository,0,id,1,cache);
  const [a,b]=await Promise.all([
    submitWithRetry(box,uid,request),submitWithRetry(box,uid,request)
  ]);
  assert.equal(a.id,b.id);
  assert.equal(box.orders.size,1);
  const changed=await pricedRequest(box.repository,0,id,2,cache);
  await assert.rejects(()=>createPickup(box.rpc,box.repository,uid,changed),
    e=>e?.status===409);
  await assert.rejects(()=>createPickup(box.rpc,box.repository,"customer-b",request),
    e=>e?.status===409);
  assert.equal(box.orders.size,1);
});

test("permanent database outage fails closed instead of reporting an invented order",async()=>{
  const box=sandbox(8),cache=new Map();
  const request=await pricedRequest(box.repository,7,shopId(0),1,cache);
  const down={rpc:async()=>({data:null,error:{message:"Synthetic database unavailable"}})};
  await assert.rejects(()=>createPickup(down,box.repository,"customer-x",request),
    e=>e?.status===503);
  assert.equal(box.orders.size,0);
  assert.equal(box.outbox.length,0);
  assert.equal(box.merchantInbox.size,0);
});