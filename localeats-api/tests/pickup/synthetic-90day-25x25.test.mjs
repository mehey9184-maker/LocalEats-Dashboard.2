/**
 * LocalEats accelerated synthetic pickup pilots.
 *
 * 25 fake merchants and 25 fake customers, with up to six virtual calendar months.
 * Invokes the REAL compiled pickup pricing/create/command service logic, but
 * replaces the storage RPC adapter, inbox, notification transport, identities
 * and money with disposable memory-only fixtures. No network, Firebase, real
 * customers, payments, accounts, Supabase or production credentials are used.
 *
 * All synthetic data is erased and checked at the end of the run.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  parsePickupInput, pickupPricing, pickupQuote, createPickup, commandPickup
} from "../../dist/orders/pickupService.js";

const DAYS = 90;
const MERCHANTS = 25;
const CUSTOMERS = 25;
const ORDERS_PER_DAY = 10;
const UUID = n => n.toString(16).padStart(8,"0")+"-0000-4000-8000-"+n.toString(16).padStart(12,"0");
const MERCHANT = i => "synthetic-merchant-"+String(i).padStart(2,"0");
const CUSTOMER = i => "synthetic-customer-"+String(i).padStart(2,"0");
const SHOP = i => "synthetic-kota-shop-"+String(i).padStart(2,"0");
const makeInput = (index,shopId,paymentMethod="cash") => ({
  contract_version:"pickup-v1",
  idempotency_key:UUID(1000+index),
  shop_id:shopId,
  items:[{menu_item_id:"item-"+shopId,quantity:1}],
  delivery_type:"collection",
  delivery_schedule_mode:"standard",
  payment_method:paymentMethod,
  customer_details:{name:"Fictional Customer",phone:"+27700000000"},
  launch_location:{lat:-26,lng:28}
});

function makeSandbox(){
  const merchants = Array.from({length:MERCHANTS},(_,i)=>MERCHANT(i));
  const customers = Array.from({length:CUSTOMERS},(_,i)=>CUSTOMER(i));
  const shops = Array.from({length:MERCHANTS},(_,i)=>({
    id:SHOP(i),owner_id:MERCHANT(i),name:"Fictional Kota Shop",
    is_active:true,approval_status:"approved",archived_at:null,
    latitude:-26,longitude:28,lat:-26,lng:28
  }));
  const byShop = new Map(shops.map(s=>[s.id,s]));
  const ordersByKey=new Map(),ordersById=new Map(),merchantInbox=new Map();
  const events=[],pushNotices=[],commandsById=new Map();
  const dropAcknowledgments=new Set();
  let now;
  const stats={createAttempts:0,precommitFailures:0,lostAfterCommit:0,
    duplicateClicks:0,recoveredRetries:0,crossTenantDenied:0,
    badTransitionsDenied:0,paid:0,collected:0,cancelled:0,rejected:0,
    noShows:0,undeliveredPush:0};
  let commandSequence=0;
  const repository={
    findOrderByIdempotencyKey:async key=>ordersByKey.get(key)||null,
    findShop:async id=>byShop.get(id)||null,
    findMenuItems:async (id,ids)=>ids.includes("item-"+id)?[
      {id:"item-"+id,shop_id:id,name:"Synthetic R25 Kota",price:25,is_available:true}
    ]:[],
    insertOrder:async()=>{throw Error("Unsafe nonatomic insert was attempted");}
  };
  const rpc={async rpc(name,args){
    if(name==="pickup_create_order"){
      stats.createAttempts++;
      const r=args.p_record,uid=args.p_uid;
      const old=ordersByKey.get(r.idempotency_key);
      if(old){
        if(old.user_id!==uid||old.create_intent_hash!==args.p_intent_hash)
          return {data:null,error:{message:"IDEMPOTENCY_CONFLICT"}};
        return {data:{order:old,replayed:true},error:null};
      }
      // Deterministic, retryable fault before committing any order.
      if(stats.createAttempts%31===0){
        stats.precommitFailures++;
        return {data:null,error:{message:"Synthetic temporary database failure"}};
      }
      const id=UUID(2000000+ordersByKey.size);
      const order={...r,id,user_id:uid,create_intent_hash:args.p_intent_hash,created_at:now,
        status:"pending",revision:0,delivery_type:"collection",
        delivery_status:"none",rider_id:null,payment_status:"unpaid",
        service_fee:0,delivery_fee:0,total_price:25};
      ordersByKey.set(r.idempotency_key,order);
      ordersById.set(order.id,order);
      if(!merchantInbox.has(order.shop_id))merchantInbox.set(order.shop_id,[]);
      merchantInbox.get(order.shop_id).push(order.id);
      events.push({order_id:id,kind:"created",revision:0,actor_uid:uid});
      // A committed request can lose its HTTP acknowledgment. The client
      // MUST retry the unchanged key, not submit another paid order.
      if(ordersByKey.size%17===0){
        stats.lostAfterCommit++;
        throw Error("Synthetic network response lost after commit");
      }
      return {data:{order,replayed:false},error:null};
    }
    if(name!=="pickup_order_command")throw Error("Unexpected RPC "+name);
    const order=ordersById.get(args.p_order_id);
    if(!order)return {data:null,error:{message:"ORDER_NOT_FOUND"}};
    const shop=byShop.get(order.shop_id);
    const action=args.p_action,actor=args.p_uid,revision=args.p_expected_revision;
    const isCustomer=actor===order.user_id,isMerchant=actor===shop.owner_id;
    if(!((action==="cancel"&&isCustomer)||(action!=="cancel"&&isMerchant)))
      return {data:null,error:{message:"FORBIDDEN"}};
    const prior=commandsById.get(args.p_command_id);
    if(prior)return prior.actor===actor && prior.orderId===order.id && prior.action===action
      ? {data:{order,replayed:true,event:prior.event},error:null}
      : {data:null,error:{message:"IDEMPOTENCY_CONFLICT"}};
    if(revision!==order.revision)return {data:null,error:{message:"ORDER_STATE_CHANGED"}};
    let kind;
    if(action==="accept" && order.status==="pending"){
      order.status="preparing";kind="accepted";
    }else if(action==="ready" && order.status==="preparing"){
      order.status="ready_for_pickup";kind="ready";
      const delivered=(pushNotices.length+1)%11!==0;
      pushNotices.push({order_id:order.id,recipient_uid:order.user_id,delivered});
      if(!delivered)stats.undeliveredPush++;
    }else if(action==="confirm_payment" && order.status==="ready_for_pickup" &&
      order.payment_status==="unpaid" && ["cash","card_machine"].includes(args.p_payment_method)){
      order.payment_status="paid";order.payment_method=args.p_payment_method;kind="payment_confirmed";stats.paid++;
    }else if(action==="collect" && order.status==="ready_for_pickup" &&
      order.payment_status==="paid" && args.p_handover_confirmed===true){
      order.status="collected";kind="collected";stats.collected++;
    }else if(action==="cancel" && order.status==="pending"){
      order.status="cancelled";kind="customer_cancelled";stats.cancelled++;
    }else if(action==="reject" && order.status==="pending"){
      order.status="cancelled";kind="merchant_rejected";stats.rejected++;
    }else return {data:null,error:{message:"INVALID_ORDER_TRANSITION"}};
    order.revision++;
    const event={order_id:order.id,kind,revision:order.revision,occurred_at:now,
      actor_uid:actor,command_id:args.p_command_id,details:kind==="payment_confirmed" ?
        {amount:order.total_price,currency:"ZAR",method:order.payment_method} : {}};
    events.push(event);
    commandsById.set(args.p_command_id,{actor,action,orderId:order.id,event});
    if(dropAcknowledgments.delete(kind))throw Error("Synthetic merchant response lost after commit");
    return {data:{order,replayed:false,event},error:null};
  }};
  function customerHistory(uid){
    if(!customers.includes(uid))return [];
    return [...ordersById.values()].filter(o=>o.user_id===uid);
  }
  function merchantOrders(uid,shopId){
    if(byShop.get(shopId)?.owner_id!==uid)throw Object.assign(
      new Error("FORBIDDEN"),{status:403});
    return (merchantInbox.get(shopId)||[]).map(id=>ordersById.get(id));
  }
  function eraseAll(){
    ordersByKey.clear();ordersById.clear();merchantInbox.clear();
    events.length=0;pushNotices.length=0;commandsById.clear();
    dropAcknowledgments.clear();
    shops.length=0;customers.length=0;merchants.length=0;byShop.clear();
    assert.equal(ordersByKey.size,0);
    assert.equal(ordersById.size,0);
    assert.equal(events.length,0);
    assert.equal(pushNotices.length,0);
    assert.equal(customers.length,0);
    assert.equal(merchants.length,0);
    assert.equal(shops.length,0);
  }
  const nextCommand=()=>UUID(4000000+(++commandSequence));
  return {repository,rpc,merchants,customers,shops,ordersById,ordersByKey,
    merchantInbox,events,pushNotices,commandsById,stats,customerHistory,merchantOrders,eraseAll,nextCommand,
    setTime:milliseconds=>{now=new Date(milliseconds).toISOString();},
    dropAcknowledgment:kind=>dropAcknowledgments.add(kind)};
}

async function submit(box,uid,raw){
  const quote=pickupQuote(await pickupPricing(box.repository,uid,parsePickupInput(raw,false)));
  const req=parsePickupInput({...raw,consent:{
    currency:"ZAR",total_minor:quote.total_minor,pricing_fingerprint:quote.pricing_fingerprint
  }},true);
  let recovered=false;
  for(let n=0;n<6;n++){
    try{
      const result=await createPickup(box.rpc,box.repository,uid,req);
      if(recovered)box.stats.recoveredRetries++;
      return {order:result.order,request:req,quote};
    }catch(e){
      if(e?.status===409||n===5)throw e;
      recovered=true;
    }
  }
  throw Error("Unreachable submission branch");
}
async function command(box,actor,order,action,extra={}){
  const result=await commandPickup(box.rpc,actor,order.id,action,{
    command_id:box.nextCommand(),expected_revision:order.revision,...extra
  });
  return result.order;
}
async function confirmWithRecovery(box,merchant,order,action,details,lostEvent){
  const request={...details,command_id:box.nextCommand(),expected_revision:order.revision};
  const send=()=>commandPickup(box.rpc,merchant,order.id,action,request);
  if(lostEvent){
    box.dropAcknowledgment(lostEvent);
    await assert.rejects(send,/Synthetic merchant response lost after commit/);
  }
  const confirmation=await send();
  assert.equal(confirmation.replayed,Boolean(lostEvent));
  assert.equal(confirmation.event.command_id,request.command_id);
  return confirmation.event;
}

async function run(days=DAYS,workload){
  const box=makeSandbox();
  const start=new Date("2026-11-11T00:00:00Z");
  const calendar=Array.from({length:days},(_,day)=>new Date(start.getTime()+day*86400000));
  const weights=calendar.map(date=>[0,6].includes(date.getUTCDay())?2:1);
  const totalWeight=weights.reduce((sum,weight)=>sum+weight,0);
  const dayVolumes=[];
  const monthlyOrders={};
  const daysCovered=new Set(),merchantsUsed=new Set(),customersUsed=new Set();
  const merchantCustomerPairsUsed=new Set();
  const allOrderIds=new Set();
  let completed=0,cancelled=0,rejected=0,noShows=0;
  let cashHandover=0,cardTerminalHandover=0,paymentMethodChangedAtShop=0,lateCollections=0;
  let recoveredPaymentAcknowledgments=0,recoveredHandoverAcknowledgments=0;
  let submitted=0,weightBefore=0;
  for(let day=0;day<days;day++){
    const virtualDate=calendar[day].toISOString().slice(0,10);
    daysCovered.add(virtualDate);
    const dayOrders=workload
      ? Math.floor((weightBefore+weights[day])*workload/totalWeight)-Math.floor(weightBefore*workload/totalWeight)
      : ORDERS_PER_DAY;
    weightBefore+=weights[day];
    dayVolumes.push(dayOrders);
    const month=virtualDate.slice(0,7);
    monthlyOrders[month]=(monthlyOrders[month]??0)+dayOrders;
    for(let slot=0;slot<dayOrders;slot++){
      const i=submitted++;
      // Rotate customers independently of shops so all 25x25 merchant/customer
      // combinations are exercised, not just 25 permanently paired accounts.
      const shopIdx=(i*7)%MERCHANTS,customerIdx=Math.floor(i/MERCHANTS)%CUSTOMERS;
      const shopId=SHOP(shopIdx),merchant=MERCHANT(shopIdx),customer=CUSTOMER(customerIdx);
      merchantsUsed.add(merchant);customersUsed.add(customer);
      merchantCustomerPairsUsed.add(merchant+"|"+customer);
      const orderTime=calendar[day].getTime()+9*3600000+slot*900000;
      box.setTime(orderTime);
      const selectedMethod=workload && i%2===1?"card_machine":"cash";
      const {order,request,quote}=await submit(box,customer,makeInput(i,shopId,selectedMethod));
      assert.equal(quote.total_minor,2500);
      assert.equal(order.total_price,25);
      assert.equal(order.payment_status,"unpaid");
      assert.equal(order.delivery_type,"collection");
      assert.equal(order.rider_id,null);
      assert.equal(order.service_fee,0);
      assert.equal(order.delivery_fee,0);
      assert.equal(box.merchantOrders(merchant,shopId).some(o=>o.id===order.id),true);
      allOrderIds.add(order.id);
      assert.equal(box.customerHistory(customer).some(o=>o.id===order.id),true);
      // Every 9th checkout double-clicks with the same intent and must replay.
      if(i%9===0){
        const replay=await createPickup(box.rpc,box.repository,customer,request);
        assert.equal(replay.order.id,order.id);
        assert.equal(replay.replayed,true);
        box.stats.duplicateClicks++;
      }
      // Every 10th action attempts a cross-account merchant mutation and
      // cross-tenant inbox read; both must be rejected.
      if(i%10===0){
        const stranger=MERCHANT((shopIdx+1)%MERCHANTS);
        await assert.rejects(()=>command(box,stranger,order,"accept"),
          e=>e?.status===403);
        assert.throws(()=>box.merchantOrders(stranger,shopId),e=>e?.status===403);
        const wrongCustomer=CUSTOMER((customerIdx+1)%CUSTOMERS);
        assert.equal(box.customerHistory(wrongCustomer).some(o=>o.id===order.id),false);
        await assert.rejects(()=>createPickup(box.rpc,box.repository,wrongCustomer,request),
          e=>e?.status===409);
        box.stats.crossTenantDenied+=4;
      }
      const outcome=workload? i%20 : slot;
      if(outcome===7){
        await command(box,customer,order,"cancel",{reason:"Synthetic changed mind"});
        assert.equal(order.status,"cancelled");
        cancelled++;continue;
      }
      if(outcome===8){
        await command(box,merchant,order,"reject",{reason:"Synthetic stock unavailable"});
        assert.equal(order.status,"cancelled");
        rejected++;continue;
      }
      await command(box,merchant,order,"accept");
      const readyTime=orderTime+20*60000;
      box.setTime(readyTime);
      await command(box,merchant,order,"ready");
      if(outcome===9){
        assert.equal(order.payment_status,"unpaid");
        assert.equal(order.status,"ready_for_pickup");
        await assert.rejects(()=>command(box,merchant,order,"collect",{handover_confirmed:true}),
          e=>e?.status===409);
        box.stats.badTransitionsDenied++;
        noShows++;continue;
      }
      // Real application service rejects handover without explicit confirmation.
      await assert.rejects(()=>commandPickup(box.rpc,merchant,order.id,"collect",{
        command_id:box.nextCommand(),expected_revision:order.revision,handover_confirmed:false
      }),e=>e?.status===400);
      box.stats.badTransitionsDenied++;
      await assert.rejects(()=>command(box,customer,order,"confirm_payment",{payment_method:"cash"}),
        e=>e?.status===403);
      box.stats.crossTenantDenied++;
      const late=Boolean(workload && i%7===0);
      const handoverTime=readyTime+(late?45:8)*60000;
      box.setTime(handoverTime);
      const actualMethod=workload && i%13===0
        ? (selectedMethod==="cash"?"card_machine":"cash") : selectedMethod;
      const lostPayment=Boolean(workload && i%29===0);
      const lostHandover=Boolean(workload && i%23===0);
      const payment=await confirmWithRecovery(box,merchant,order,"confirm_payment",
        {payment_method:actualMethod},lostPayment?"payment_confirmed":null);
      assert.equal(order.payment_status,"paid");
      assert.equal(order.status,"ready_for_pickup");
      const collected=await confirmWithRecovery(box,merchant,order,"collect",
        {handover_confirmed:true},lostHandover?"collected":null);
      assert.equal(order.status,"collected");
      assert.deepEqual(payment.details,{amount:25,currency:"ZAR",method:actualMethod});
      assert.equal(collected.occurred_at,new Date(handoverTime).toISOString());
      assert.equal(order.payment_method,actualMethod);
      if(actualMethod==="cash")cashHandover++;
      else cardTerminalHandover++;
      if(actualMethod!==selectedMethod)paymentMethodChangedAtShop++;
      if(late)lateCollections++;
      if(lostPayment)recoveredPaymentAcknowledgments++;
      if(lostHandover)recoveredHandoverAcknowledgments++;
      completed++;
    }
  }
  const intended=workload??days*ORDERS_PER_DAY;
  assert.equal(daysCovered.size,days);
  assert.equal(merchantsUsed.size,MERCHANTS);
  assert.equal(customersUsed.size,CUSTOMERS);
  assert.equal(merchantCustomerPairsUsed.size,MERCHANTS*CUSTOMERS);
  assert.equal(allOrderIds.size,intended);
  assert.equal(box.ordersById.size,intended);
  assert.equal(box.ordersByKey.size,intended);
  assert.equal([...box.merchantInbox.values()].reduce((a,b)=>a+b.length,0),intended);
  assert.equal(completed+cancelled+rejected+noShows,intended);
  assert.equal(box.stats.collected,completed);
  assert.equal(box.stats.paid,completed);
  assert.equal(box.stats.cancelled,cancelled);
  assert.equal(box.stats.rejected,rejected);
  assert.equal(box.pushNotices.length,completed+noShows);
  assert.equal(new Set(box.pushNotices.map(n=>n.order_id)).size,completed+noShows);
  assert.equal(box.events.filter(event=>event.kind==="payment_confirmed").length,completed);
  assert.equal(box.events.filter(event=>event.kind==="collected").length,completed);
  assert.ok(box.stats.undeliveredPush>0);
  assert.ok(box.stats.precommitFailures>0);
  assert.ok(box.stats.lostAfterCommit>0);
  assert.ok(box.stats.recoveredRetries>0);
  const summary={
    mode:"OFFLINE_SYNTHETIC_MODEL_NOT_LIVE_PRODUCTION_TEST",
    timelineStart:[...daysCovered][0],timelineEnd:[...daysCovered].at(-1),
    virtualDays:days,syntheticMerchants:MERCHANTS,syntheticCustomers:CUSTOMERS,
    distinctMerchantCustomerPairs:merchantCustomerPairsUsed.size,
    fictionalOrders:intended,collectedModel:completed,cancelledModel:cancelled,
    rejectedModel:rejected,readyButUnpaidModel:noShows,
    fictionalCashCollectedZAR:cashHandover*25,
    fictionalCardTerminalCollectedZAR:cardTerminalHandover*25,
    cashHandover,cardTerminalHandover,paymentMethodChangedAtShop,lateCollections,
    recoveredPaymentAcknowledgments,recoveredHandoverAcknowledgments,monthlyOrders,
    minOrdersPerDay:Math.min(...dayVolumes),maxOrdersPerDay:Math.max(...dayVolumes),
    actualCashCollectedZAR:0,
    uniqueOrderIDs:allOrderIds.size,merchantInboxEntries:intended,
    simulatedPushFailures:box.stats.undeliveredPush,
    duplicateClicks:box.stats.duplicateClicks,
    recoveredAfterSyntheticFault:box.stats.recoveredRetries,
    simulatedPrecommitFailures:box.stats.precommitFailures,
    simulatedLostCommitAcknowledgments:box.stats.lostAfterCommit,
    attemptedAndDeniedCrossAccountAccess:box.stats.crossTenantDenied,
    rejectedInvalidHandover:box.stats.badTransitionsDenied,
    notificationFallback:"merchant inbox persists even without push",
    productionWrites:0,realAccountsCreated:0,realPayments:0
  };
  box.eraseAll();
  summary.syntheticRecordsAfterCleanup=box.ordersById.size;
  summary.syntheticCustomersAfterCleanup=box.customers.length;
  summary.syntheticMerchantsAfterCleanup=box.merchants.length;
  assert.equal(summary.syntheticRecordsAfterCleanup,0);
  console.log("L2_"+days+"_DAY_25X25_SYNTHETIC_RESULT "+JSON.stringify(summary));
  return summary;
}

test("90 virtual days x 25 fictional merchants x 25 fictional customers: order lifecycles, isolation, retries and full in-memory cleanup",{
  timeout:120000
},async()=>{
  const result=await run();
  assert.equal(result.productionWrites,0);
  assert.equal(result.realAccountsCreated,0);
  assert.equal(result.syntheticRecordsAfterCleanup,0);
  assert.equal(result.uniqueOrderIDs,900);
});


test("180 virtual days (six months) x 25 merchants x 25 customers: no duplicate or missing synthetic orders, full cleanup",{
  timeout:120000
},async()=>{
  const result=await run(180);
  assert.equal(result.virtualDays,180);
  assert.equal(result.uniqueOrderIDs,1800);
  assert.equal(result.collectedModel,1260);
  assert.equal(result.cancelledModel,180);
  assert.equal(result.rejectedModel,180);
  assert.equal(result.readyButUnpaidModel,180);
  assert.equal(result.syntheticRecordsAfterCleanup,0);
  assert.equal(result.syntheticCustomersAfterCleanup,0);
  assert.equal(result.syntheticMerchantsAfterCleanup,0);
  assert.equal(result.actualCashCollectedZAR,0);
});

test("2,500 pickup orders across six calendar months exercise both sides of payment and handover", {
  timeout:120000
}, async () => {
  const result=await run(181,2500);
  assert.equal(result.timelineStart,"2026-11-11");
  assert.equal(result.timelineEnd,"2027-05-10");
  assert.equal(result.uniqueOrderIDs,2500);
  assert.equal(result.distinctMerchantCustomerPairs,625);
  assert.equal(result.merchantInboxEntries,2500);
  assert.equal(result.collectedModel+result.cancelledModel+result.rejectedModel+result.readyButUnpaidModel,2500);
  assert.equal(result.cashHandover+result.cardTerminalHandover,result.collectedModel);
  assert.ok(result.cashHandover>0 && result.cardTerminalHandover>0);
  assert.ok(result.paymentMethodChangedAtShop>0);
  assert.ok(result.lateCollections>0);
  assert.ok(result.recoveredPaymentAcknowledgments>0 && result.recoveredHandoverAcknowledgments>0);
  assert.ok(result.maxOrdersPerDay>result.minOrdersPerDay);
  assert.equal(result.syntheticRecordsAfterCleanup,0);
  assert.equal(result.realPayments,0);
});
