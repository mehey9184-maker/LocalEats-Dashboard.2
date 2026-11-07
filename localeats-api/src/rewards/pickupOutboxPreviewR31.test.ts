import test from "node:test";
import assert from "node:assert/strict";
import {createInertR31PickupOutboxPreview,type PreviewOutboxReader,type PreviewOutboxStore} from "./pickupOutboxPreviewR31.js";
import type {FinancialTokenVerifier} from "./financeActor.js";

const orderId="00000000-0000-4000-8000-000000000402";
const collectedCommandId="00000000-0000-4000-8000-000000000422";
const paymentCommandId="00000000-0000-4000-8000-000000000412";
const merchantUid="merchant-1";
const header="Bearer fb-valid-merchant-token";

function proof(){
  return {
    order:{id:orderId,origin:"authoritative_pickup",status:"collected",
      payment_status:"paid",registered:true,is_test:false,shop_id:"shop-1",
      customer_uid:"customer-1",created_at:"2026-11-08T10:00:00Z"},
    shop:{id:"shop-1",owner_uid:merchantUid,approval_status:"approved"},
    checkoutProof:{order_id:orderId,shop_id:"shop-1",customer_uid:"customer-1",
      programme_version:"future-v1",approved_at_purchase:true,enrolled_at_purchase:true,
      eligible_units:4,captured_at:"2026-11-08T10:00:00Z"},
    programme:{version:"future-v1",active:true,starts_at:"2026-11-08T09:00:00Z"},
    pickupEvents:[
      {order_id:orderId,command_id:paymentCommandId,kind:"payment_confirmed",
        actor_uid:merchantUid,revision:1,occurred_at:"2026-11-08T10:01:00Z"},
      {order_id:orderId,command_id:collectedCommandId,kind:"collected",
        actor_uid:merchantUid,revision:2,occurred_at:"2026-11-08T10:02:00Z"},
    ],
    outbox:{order_id:orderId,collected_command_id:collectedCommandId,
      collected_revision:2,state:"pending"},
  };
}
type Bundle=ReturnType<typeof proof>;
function setup(modify?:(value:Bundle)=>void, mode?:"revoked"|"anonymous"|"invalid"){
  const record=proof();
  modify?.(record);
  let verifies=0,transactions=0,reads=0;
  const verifier:FinancialTokenVerifier=async (token,checkRevoked)=>{
    verifies++;
    assert.equal(checkRevoked,true);
    if(mode==="revoked" || mode==="invalid" || token!=="valid-merchant-token")
      throw Error("FIREBASE_AUTH_FAILED");
    return {uid:merchantUid,firebase:{sign_in_provider:mode==="anonymous"?"anonymous":"password"},
      user_metadata:{role:"super_admin",shop_owner_uid:"another-shop"}};
  };
  const tx:PreviewOutboxReader={readCollectedOutboxBundle:async ()=>{
    reads++;
    return record;
  }};
  const db:PreviewOutboxStore={readOnlySerializable:async work=>{
    transactions++;
    return work(tx);
  }};
  const adapter=createInertR31PickupOutboxPreview({verifyIdToken:verifier,transactionStore:db});
  return {adapter,counts:()=>({verifies,transactions,reads})};
}
test("R3.1: eligible collected outbox can be INSPECTED, never credited/acknowledged",async()=>{
  const {adapter,counts}=setup();
  const result=await adapter.inspect(header,orderId,collectedCommandId);
  assert.deepEqual(result,{mode:"preview-read-only",orderId,
    commandId:collectedCommandId,shopId:"shop-1",
    verifiedMerchantUid:merchantUid,eligibleUnits:4,
    canCredit:false,canAcknowledge:false});
  assert.equal(Object.isFrozen(result),true);
  assert.equal(typeof (adapter as unknown as {credit?:unknown}).credit,"undefined");
  assert.equal(typeof (adapter as unknown as {enqueue?:unknown}).enqueue,"undefined");
  assert.equal(typeof (adapter as unknown as {acknowledge?:unknown}).acknowledge,"undefined");
  assert.deepEqual(counts(),{verifies:1,transactions:1,reads:1});
});
test("R3.1: malformed UUID and revoked/anonymous/forged Firebase identity never query DB",async()=>{
  for(const [h,mode] of [
    [undefined,undefined],["Bearer forged",undefined],[header,"revoked"],
    [header,"anonymous"],[header,"invalid"]
  ] as const){
    const {adapter,counts}=setup(undefined,mode);
    await assert.rejects(()=>adapter.inspect(h,orderId,collectedCommandId),
      /REWARDS_FINANCIAL_AUTH_REQUIRED/);
    assert.equal(counts().transactions,0);
  }
  const {adapter,counts}=setup();
  await assert.rejects(()=>adapter.inspect(header,"not-uuid",collectedCommandId),
    /REWARDS_R31_BAD_UUID/);
  assert.equal(counts().transactions,0);
});
test("R3.1: revoked owner after shop transfer cannot inspect the old event",async()=>{
  const {adapter}=setup(x=>{x.shop.owner_uid="new-owner";});
  await assert.rejects(()=>adapter.inspect(header,orderId,collectedCommandId),
    /REWARDS_R31_UNTRUSTED_TRANSITION/);
});
test("R3.1: spoofed browser metadata grants no authority over real source",async()=>{
  const {adapter}=setup(x=>{x.pickupEvents[1]!.actor_uid="impostor";});
  await assert.rejects(()=>adapter.inspect(header,orderId,collectedCommandId),
    /REWARDS_R31_UNTRUSTED_TRANSITION/);
});
test("R3.1: pickup source rejects missing payment, reversed revision and wrong order",async()=>{
  for(const change of [
    (p:Bundle)=>{p.pickupEvents.splice(0,1);},
    (p:Bundle)=>{p.pickupEvents[1]!.revision=1;},
    (p:Bundle)=>{p.pickupEvents[0]!.order_id="wrong";},
    (p:Bundle)=>{p.order.payment_status="unpaid";},
    (p:Bundle)=>{p.order.status="pending";},
    (p:Bundle)=>{p.outbox.collected_command_id=paymentCommandId;},
    (p:Bundle)=>{p.outbox.collected_revision=3;},
    (p:Bundle)=>{p.outbox.state="consumed";},
  ]){
    const {adapter}=setup(change);
    await assert.rejects(()=>adapter.inspect(header,orderId,collectedCommandId),
      /REWARDS_R31_UNTRUSTED_TRANSITION/);
  }
});
test("R3.1: no current-programme or purchase-time eligible evidence means no inspection",async()=>{
  for(const change of [
    (p:Bundle)=>{p.programme.active=false;},
    (p:Bundle)=>{p.checkoutProof.eligible_units=0;},
    (p:Bundle)=>{p.checkoutProof.approved_at_purchase=false;},
    (p:Bundle)=>{p.checkoutProof.enrolled_at_purchase=false;},
    (p:Bundle)=>{p.checkoutProof.programme_version="old";},
    (p:Bundle)=>{p.checkoutProof.captured_at="2026-11-09T10:00:00Z";},
    (p:Bundle)=>{p.programme.starts_at="2026-11-09T09:00:00Z";},
    (p:Bundle)=>{p.order.is_test=true;},
    (p:Bundle)=>{p.order.registered=false;},
    (p:Bundle)=>{p.shop.approval_status="suspended";},
    (p:Bundle)=>{p.checkoutProof.customer_uid="another-user";},
  ]){
    const {adapter}=setup(change);
    await assert.rejects(()=>adapter.inspect(header,orderId,collectedCommandId),
      /REWARDS_R31_UNTRUSTED_TRANSITION/);
  }
});
test("R3.1: failures from the database reader fail closed, no invented outbox",async()=>{
  const verifier:FinancialTokenVerifier=async (_,checkRevoked)=>{
    assert.equal(checkRevoked,true);
    return {uid:merchantUid,firebase:{sign_in_provider:"password"}};
  };
  const transactionStore:PreviewOutboxStore={
    readOnlySerializable:async ()=>{throw Error("TRANSIENT_DB_ERROR");}
  };
  const adapter=createInertR31PickupOutboxPreview({verifyIdToken:verifier,transactionStore});
  await assert.rejects(()=>adapter.inspect(header,orderId,collectedCommandId),/TRANSIENT_DB_ERROR/);
});
test("R3.1: invalid bootstrap dependencies are rejected before any auth use",()=>{
  assert.throws(()=>createInertR31PickupOutboxPreview(
    {} as Parameters<typeof createInertR31PickupOutboxPreview>[0]),
    /REWARDS_R31_NOT_CONFIGURED/);
});
