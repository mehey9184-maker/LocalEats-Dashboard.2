import test from "node:test";
import assert from "node:assert/strict";
import {creditCollectedLine,newModel,type Model} from "./rewardsModel.js";
import {verifyFinancialActor,type FinancialTokenVerifier} from "./financeActor.js";
import {rehearseCollectedPickupCredit,rehearseVerifiedManualRefundHold,
  rehearseAdminTransferReview,rehearseMerchantReceiptReview,
  type RewardsTransactionalReader,type RewardsTransactionalStore,
  type CreditCommit,type RefundHoldCommit,type ProgrammeSnapshot} from "./transactionRehearsal.js";

const orderId="order-rehearsal", customerId="user-1", shopId="shop-1",payableId="p-1";
const shopOwner="shop-owner-1",adminUid="super-admin-1";
function orderBundle(extra?: {secondQualifying?:boolean,refund?:boolean,unpaid?:boolean}){
  const second=extra?.secondQualifying??false;
  return {
    order:{
      id:orderId,user_id:customerId,shop_id:shopId,delivery_type:"collection",
      status:"collected",payment_status:extra?.unpaid?"unpaid":"paid",
      test_record:false,simulated_checkout:false,create_intent_hash:"a".repeat(64),
      created_at:"2026-11-07T10:00:00Z",
      items:[{menu_item_id:"kota",quantity:4,unit_price:25},
        {menu_item_id:"kota2",quantity:20,unit_price:25}],
    },
    programmeShop:{shop_id:shopId,approval_status:"approved",
      participating_at_purchase:true,programme_version:"pilot-v1",
      rewards_started_at:"2026-11-01T00:00:00Z",shop_approved_at:"2026-10-20T00:00:00Z"},
    registeredCustomer:{uid:customerId,registered:true,anonymous:false,test_account:false},
    pickupEvents:[
      {order_id:orderId,kind:"payment_confirmed",command_id:"payment-1",actor_uid:shopOwner,
        revision:1,occurred_at:"2026-11-07T10:04:00Z"},
      {order_id:orderId,kind:"collected",command_id:"collect-1",actor_uid:shopOwner,
        revision:2,occurred_at:"2026-11-07T10:07:00Z"},
    ],
    eligibilitySnapshots:[
      {order_id:orderId,line_index:0,shop_id:shopId,menu_item_id:"kota",
        programme_version:"pilot-v1",qualifying_kota:true,immutable:true,
        proof_source:"server-persisted-at-purchase",snapshot_at:"2026-11-07T09:59:59Z"},
      {order_id:orderId,line_index:1,shop_id:shopId,menu_item_id:"kota2",
        programme_version:"pilot-v1",qualifying_kota:second,immutable:true,
        proof_source:"server-persisted-at-purchase",snapshot_at:"2026-11-07T09:59:59Z"},
    ],
    verifiedRefunds:extra?.refund?[{refund_id:"ref-pre-credit"}]:[],
  };
}
function refundBundle(){
  return {
    refund:{id:"ref-1",order_id:orderId,line_id:orderId+":line:0",customer_id:customerId,
      shop_id:shopId,units:1,amount_minor:2500,bank_or_cash_reference:"CASH-RECON-1",
      review_status:"verified",origin:"verified_manual_shop_refund",
      merchant_verified_by_uid:shopOwner,admin_verified_by_uid:adminUid},
    creditedLine:{order_id:orderId,line_id:orderId+":line:0",
      customer_id:customerId,credited_units:4},
    shop:{id:shopId,owner_id:shopOwner},
    adminUser:{firebase_uid:adminUid,role:"super_admin",is_active:true},
  };
}
function merchantBundle(){
  return {payable:{id:payableId,shop_id:shopId,status:"sent",amount_minor:2400,
      transfer_id:"bank-transfer-1"},
    shop:{id:shopId,owner_id:shopOwner},
    transfer:{id:"bank-transfer-1",payable_id:payableId,amount_minor:2400}};
}
function adminBundle(){
  return {payable:{id:payableId,shop_id:shopId,status:"owed",amount_minor:2400,
      transfer_id:null},
    adminUser:{firebase_uid:adminUid,role:"super_admin",is_active:true},
    existingTransfer:null};
}

class SyntheticAtomicStore implements RewardsTransactionalStore {
  model:Model;
  private chain:Promise<void>=Promise.resolve();
  holds = new Map<string,string>();
  programme:ProgrammeSnapshot={active:true,version:"pilot-v1",funded:true};
  orderData=orderBundle();
  refundData=refundBundle();
  adminData: Omit<ReturnType<typeof adminBundle>, "existingTransfer"> & {existingTransfer:unknown}=adminBundle();
  merchantData=merchantBundle();
  transactionCalls=0;
  writes=0;
  constructor(budget=35000){
    this.model=newModel({active:true,budgetMinor:budget,participatingShops:new Set([shopId])});
  }
  async serializable<T>(work:(transaction:RewardsTransactionalReader)=>Promise<T>):Promise<T>{
    const previous=this.chain;
    let release!:()=>void;
    this.chain=new Promise<void>(resolve=>{release=resolve;});
    await previous;
    this.transactionCalls++;
    let model=this.model;
    const holds=new Map(this.holds);
    const tx: RewardsTransactionalReader = {
      readProgrammeSnapshot:async()=>({...this.programme}),
      readCollectedOrderBundle:async()=>{
        const base=this.orderData;
        return {...base,verifiedRefunds:holds.has(customerId)?
          [{refund_id:holds.get(customerId)}]:base.verifiedRefunds};
      },
      readMerchantReceiptBundle:async()=>this.merchantData,
      readAdminTransferBundle:async()=>this.adminData,
      readRefundReviewBundle:async()=>this.refundData,
      applyCreditCandidate:async proof=>{
        const previousModel=model;
        for(const line of proof.lines)model=creditCollectedLine(model,line);
        const newUnits=proof.lines.filter(line=>!previousModel.purchases.has(line.orderId+"\u001f"+line.lineId))
          .reduce((sum,line)=>sum+line.quantity,0);
        return {orderId:proof.orderId,customerId:proof.customerId,
          newUnits,replayed:newUnits===0} satisfies CreditCommit;
      },
      applyVerifiedRefundHold:async proof=>{
        const previous=holds.get(proof.customerId);
        if(previous && previous!==proof.refundId)throw Error("REFUND_REPLAY_CONFLICT");
        holds.set(proof.customerId,proof.refundId);
        return {refundId:proof.refundId,customerId:proof.customerId,
          held:true,replayed:previous===proof.refundId} satisfies RefundHoldCommit;
      }
    };
    try {
      const result=await work(tx);
      this.model=model;
      this.holds=holds;
      this.writes++;
      return result;
    }finally{release();}
  }
}
const tokenVerifier=(uid:string,provider="password"):FinancialTokenVerifier=>
  async (token,revokedCheck)=>{
    assert.equal(revokedCheck,true,"revocation check must be mandatory");
    if(token==="revoked-token")throw Error("TOKEN_REVOKED");
    return {uid,firebase:{sign_in_provider:provider}};
  };
const header="Bearer fb-valid-token-12345";

test("R2.6: checkout evidence to atomic credit -> 4 units -> Bronze reward; replay does not duplicate",async()=>{
  const s=new SyntheticAtomicStore();
  const first=await rehearseCollectedPickupCredit(s,orderId);
  assert.deepEqual(first,{orderId,customerId,newUnits:4,replayed:false});
  assert.equal(s.model.customers.get(customerId)?.rank,"silver");
  assert.equal(s.model.grants.size,1);
  assert.equal(s.model.payables.size,0,"credit must never create merchant payable");
  assert.equal(s.model.purchases.size,1);
  const replay=await rehearseCollectedPickupCredit(s,orderId);
  assert.deepEqual(replay,{orderId,customerId,newUnits:0,replayed:true});
  assert.equal(s.model.grants.size,1);
  assert.equal(s.model.purchases.size,1);
});
test("R2.6: simultaneous request retries serialize, only one credit commits",async()=>{
  const s=new SyntheticAtomicStore();
  const [a,b,c]=await Promise.all([
    rehearseCollectedPickupCredit(s,orderId),
    rehearseCollectedPickupCredit(s,orderId),
    rehearseCollectedPickupCredit(s,orderId)
  ]);
  assert.deepEqual([a.newUnits,b.newUnits,c.newUnits],[4,0,0]);
  assert.equal(s.model.purchases.size,1);
  assert.equal(s.model.grants.size,1);
  assert.equal(s.model.customers.get(customerId)?.lifetimeUnits,4);
});
test("R2.6: multi-item order is all-or-nothing if second reward exceeds budget",async()=>{
  const s=new SyntheticAtomicStore(2500);
  s.orderData=orderBundle({secondQualifying:true});
  await assert.rejects(()=>rehearseCollectedPickupCredit(s,orderId),
    /UNFUNDED_REWARD_PROMISE/);
  assert.equal(s.model.customers.size,0);
  assert.equal(s.model.purchases.size,0);
  assert.equal(s.model.grants.size,0);
  assert.equal(s.model.payables.size,0);
});
test("R2.6: with enough funding an order containing 4+20 qualified items credits both together",async()=>{
  const s=new SyntheticAtomicStore(15000);
  s.orderData=orderBundle({secondQualifying:true});
  const out=await rehearseCollectedPickupCredit(s,orderId);
  assert.equal(out.newUnits,24);
  assert.equal(s.model.customers.get(customerId)?.rank,"gold");
  assert.equal(s.model.customers.get(customerId)?.lifetimeUnits,24);
  assert.equal(s.model.grants.size,2);
  assert.equal(s.model.payables.size,0);
});
test("R2.6: policy disabled/unfunded/version drift stops BEFORE any attempted ledger commit",async()=>{
  for(const policy of [
    {active:false,version:"pilot-v1",funded:true},
    {active:true,version:"pilot-v1",funded:false},
    {active:true,version:"other-version",funded:true},
    {active:true,version:"",funded:true}
  ]){
    const s=new SyntheticAtomicStore();
    s.programme=policy;
    await assert.rejects(()=>rehearseCollectedPickupCredit(s,orderId),
      /REWARDS_(PROGRAMME_NOT_FUNDED_OR_ACTIVE|PROGRAMME_VERSION_MISMATCH)/);
    assert.equal(s.model.purchases.size,0);
    assert.equal(s.model.grants.size,0);
  }
});
test("R2.6: unpaid/previously-refunded proof cannot call ledger",async()=>{
  for(const options of [{unpaid:true},{refund:true}]){
    const s=new SyntheticAtomicStore();
    s.orderData=orderBundle(options);
    await assert.rejects(()=>rehearseCollectedPickupCredit(s,orderId),
      /REWARDS_(PICKUP_NOT_VERIFIABLY_PAID_AND_COLLECTED|REFUNDED_ORDER_REQUIRES_REVIEW)/);
    assert.equal(s.model.purchases.size,0);
  }
});
test("R2.6: verified independent manual refund adds hold without removing existing reward",async()=>{
  const s=new SyntheticAtomicStore();
  await rehearseCollectedPickupCredit(s,orderId);
  const before=s.model;
  const first=await rehearseVerifiedManualRefundHold(s,"ref-1");
  assert.deepEqual(first,{refundId:"ref-1",customerId,held:true,replayed:false});
  const again=await rehearseVerifiedManualRefundHold(s,"ref-1");
  assert.deepEqual(again,{refundId:"ref-1",customerId,held:true,replayed:true});
  assert.equal(s.model,before);
  assert.equal(s.model.grants.size,1);
  assert.equal(s.holds.get(customerId),"ref-1");
  await assert.rejects(()=>rehearseCollectedPickupCredit(s,orderId),
    /REWARDS_REFUNDED_ORDER_REQUIRES_REVIEW/);
});
test("R2.6: incorrect refund/customer identity cannot modify holds",async()=>{
  const s=new SyntheticAtomicStore();
  s.refundData={...refundBundle(),creditedLine:{...refundBundle().creditedLine,customer_id:"forged"}};
  await assert.rejects(()=>rehearseVerifiedManualRefundHold(s,"ref-1"),
    /REWARDS_REFUND_CREDIT_MISMATCH/);
  assert.equal(s.holds.size,0);
});
test("R2.6: financial verification rejects nonbearer, anonymous and revoked tokens",async()=>{
  for(const h of [undefined,"Bearer wrong-token","Bearer fb-x","Bearer fb-a token"]){
    await assert.rejects(()=>verifyFinancialActor(h,tokenVerifier(adminUid)),
      /REWARDS_FINANCIAL_AUTH_REQUIRED/);
  }
  await assert.rejects(()=>verifyFinancialActor("Bearer fb-revoked-token",tokenVerifier(adminUid)),
    /REWARDS_FINANCIAL_AUTH_REQUIRED/);
  await assert.rejects(()=>verifyFinancialActor(header,tokenVerifier(adminUid,"anonymous")),
    /REWARDS_FINANCIAL_AUTH_REQUIRED/);
  const actor=await verifyFinancialActor(header,tokenVerifier(adminUid));
  assert.deepEqual(actor,{uid:adminUid,verifiedBy:"firebase-admin-revocation-checked",anonymous:false});
});
test("R2.6: admin review checks active super_admin and existing transfer inside tx (no payout)",async()=>{
  const s=new SyntheticAtomicStore();
  const result=await rehearseAdminTransferReview(s,header,tokenVerifier(adminUid),payableId);
  assert.deepEqual(result,{payableId,actorUid:adminUid,shopId,amountMinor:2400,
    outcome:"admin-review-only"});
  assert.equal(s.model.payables.size,0);
  assert.equal(s.model.transfers.size,0);
  const disabled=new SyntheticAtomicStore();
  disabled.adminData={...adminBundle(),adminUser:{...adminBundle().adminUser,is_active:false}};
  await assert.rejects(()=>rehearseAdminTransferReview(disabled,header,
    tokenVerifier(adminUid),payableId),/REWARDS_ACTIVE_SUPER_ADMIN_REQUIRED/);
  assert.equal(disabled.model.transfers.size,0);
  const already=new SyntheticAtomicStore();
  already.adminData={...adminBundle(),existingTransfer:{id:"already-paid"}};
  await assert.rejects(()=>rehearseAdminTransferReview(already,header,
    tokenVerifier(adminUid),payableId),/REWARDS_PAYOUT_NOT_OWED_OR_ALREADY_SENT/);
});
test("R2.6: only verified shop owner may review receipt, no settlement side effects",async()=>{
  const s=new SyntheticAtomicStore();
  const result=await rehearseMerchantReceiptReview(s,header,tokenVerifier(shopOwner),payableId);
  assert.deepEqual(result,{payableId,actorUid:shopOwner,shopId,amountMinor:2400,
    outcome:"merchant-review-only"});
  await assert.rejects(()=>rehearseMerchantReceiptReview(s,header,
    tokenVerifier("other-merchant"),payableId),/REWARDS_MERCHANT_RECEIPT_FORBIDDEN/);
  const wrong=new SyntheticAtomicStore();
  wrong.merchantData={...merchantBundle(),
    payable:{...merchantBundle().payable,status:"owed"}};
  await assert.rejects(()=>rehearseMerchantReceiptReview(wrong,header,
    tokenVerifier(shopOwner),payableId),/REWARDS_MERCHANT_RECEIPT_FORBIDDEN/);
  assert.equal(s.model.payables.size,0);
});
