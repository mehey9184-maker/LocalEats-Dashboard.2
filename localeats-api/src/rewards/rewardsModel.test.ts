import test from "node:test";
import assert from "node:assert/strict";
import {newModel,creditCollectedLine,fulfil,recordTransfer,merchantReceipt,exposureMinor,
  type Model,type PurchaseLine} from "./rewardsModel.js";

const customer="customer-a",shop="my-kota";
const state=(budgetMinor=50000,active=true):Model=>
  newModel({active,budgetMinor,participatingShops:new Set([shop,"shop-b"])});
const line=(orderId:string,quantity:number,customerId=customer):PurchaseLine=>({
  orderId,lineId:"line-1",customerId,shopId:shop,quantity,paid:true,collected:true,
  eligibleKota:true,testRecord:false,refunded:false,
});
const credit=(s:Model,id:string,n:number)=>creditCollectedLine(s,line(id,n));
const handover=(s:Model,change:Partial<Parameters<typeof fulfil>[1]>={})=>fulfil(s,{
  grantId:customer+":reward:bronze",customerId:customer,shopId:shop,
  merchantShopId:shop,handoverId:"handover-a",itemId:"kota25",kind:"standard_kota",priceMinor:2500,...change,
});
const payableId=customer+":reward:bronze:payable";
const payment={payableId,transferId:"transfer-a",adminUid:"verified-admin",bankReference:"BANK-1",amountMinor:2500};

test("inactive rewards never credit a purchase or create financial claims",()=>{
  assert.throws(()=>credit(state(50000,false),"o1",4),/REWARDS_INACTIVE/);
  assert.equal(newModel().grants.size,0);
});
test("four paid collected kota units earn Bronze reward, promote Silver, reset stage counter",()=>{
  let s=credit(state(),"o1",3);
  assert.deepEqual(s.customers.get(customer),{rank:"bronze",stageUnits:3,lifetimeUnits:3});
  s=credit(s,"o2",1);
  assert.deepEqual(s.customers.get(customer),{rank:"silver",stageUnits:0,lifetimeUnits:4});
  assert.equal(s.grants.get(customer+":reward:bronze")?.capMinor,2500);
  assert.equal(s.payables.size,0);
  s=credit(s,"o3",2);
  assert.deepEqual(s.customers.get(customer),{rank:"silver",stageUnits:2,lifetimeUnits:6});
});
test("20 more units earn Silver, 40 more earn Gold; Platinum is permanent",()=>{
  let s=credit(state(),"o1",64);
  assert.deepEqual(s.customers.get(customer),{rank:"platinum",stageUnits:0,lifetimeUnits:64});
  assert.deepEqual([...s.grants.values()].map(x=>[x.tier,x.capMinor]),
    [["bronze",2500],["silver",12500],["gold",20000]]);
  assert.equal(exposureMinor(s),35000);
  s=credit(s,"o2",10);
  assert.equal(s.customers.get(customer)?.rank,"platinum");
  assert.equal(s.grants.size,3);
});
test("source order-line idempotency: exact replay is safe, conflicting quantity/user denied",()=>{
  const e=line("o1",4),s=creditCollectedLine(state(),e);
  assert.equal(creditCollectedLine(s,e),s);
  assert.throws(()=>creditCollectedLine(s,{...e,quantity:5}),/PURCHASE_REPLAY_CONFLICT/);
  assert.throws(()=>creditCollectedLine(s,{...e,customerId:"other"}),/PURCHASE_REPLAY_CONFLICT/);
});
test("test/unpaid/uncollected/refunded/non-kota/out-of-programme purchase earns nothing",()=>{
  const base=line("o1",4);
  for(const change of [{testRecord:true},{paid:false},{collected:false},{refunded:true},
    {eligibleKota:false},{shopId:"not-eligible"}])
    assert.throws(()=>creditCollectedLine(state(),{...base,...change}));
  for(const quantity of [0,-2,0.5,101,Number.MAX_SAFE_INTEGER])
    assert.throws(()=>creditCollectedLine(state(),{...base,quantity}),/INVALID_QUANTITY/);
});
test("reserve sufficient budget before any new promise; insufficient event leaves original untouched",()=>{
  const s=state(2499);
  assert.throws(()=>credit(s,"o1",4),/UNFUNDED_REWARD_PROMISE/);
  assert.equal(s.purchases.size,0);
  assert.equal(s.customers.size,0);
  const funded=credit(state(2500),"o1",4);
  assert.equal(exposureMinor(funded),2500);
  assert.throws(()=>credit(funded,"o2",20),/UNFUNDED_REWARD_PROMISE/);
  assert.equal(funded.grants.size,1);
});
test("handing over reward creates exactly one payable and uses actual item price",()=>{
  const earned=credit(state(),"o1",4);
  assert.equal(earned.payables.size,0);
  const supplied=handover(earned,{priceMinor:2400});
  assert.equal(supplied.payables.get(payableId)?.status,"owed");
  assert.equal(supplied.payables.get(payableId)?.amountMinor,2400);
  assert.equal(exposureMinor(supplied),2400);
  assert.equal(earned.payables.size,0);
  assert.equal(handover(supplied,{priceMinor:2400}),supplied);
  assert.throws(()=>handover(supplied,{priceMinor:2500}),/REDEMPTION_REPLAY_CONFLICT/);
});
test("Bronze free standard kota may cost R25; other eligible food must cost strictly less",()=>{
  const earned=credit(state(),"o1",4);
  assert.equal(handover(earned,{kind:"standard_kota",priceMinor:2500}).payables.size,1);
  assert.equal(handover(earned,{kind:"other_food",priceMinor:2499}).payables.size,1);
  assert.throws(()=>handover(earned,{kind:"other_food"}),/ALTERNATIVE_FOOD_MUST_COST_BELOW_R25/);
  assert.throws(()=>handover(earned,{priceMinor:2501}),/REWARD_PRICE_INVALID/);
  assert.throws(()=>handover(earned,{kind:"bundle"}),/BRONZE_ITEM_INVALID/);
});
test("cannot steal reward, impersonate another merchant or reuse a handover",()=>{
  const earned=credit(state(),"o1",24);
  assert.throws(()=>handover(earned,{customerId:"other"}),/GRANT_NOT_OWNED/);
  assert.throws(()=>handover(earned,{merchantShopId:"shop-b"}),/MERCHANT_FORBIDDEN/);
  assert.throws(()=>handover(earned,{shopId:"unknown",merchantShopId:"unknown"}),/MERCHANT_FORBIDDEN/);
  const redeemed=handover(earned);
  assert.throws(()=>fulfil(redeemed,{grantId:customer+":reward:silver",customerId:customer,shopId:shop,
    merchantShopId:shop,handoverId:"handover-a",itemId:"bundle",kind:"bundle",priceMinor:12000}),/HANDOVER_REUSED/);
});
test("bank transfer stays sent until correct merchant confirms; settled expense remains spent",()=>{
  const owed=handover(credit(state(),"o1",4));
  assert.throws(()=>merchantReceipt(owed,{payableId,merchantShopId:shop,receiptId:"r1",decision:"received"}),/PAYMENT_NOT_SENT/);
  const sent=recordTransfer(owed,payment);
  assert.equal(sent.payables.get(payableId)?.status,"sent");
  assert.equal(recordTransfer(sent,payment),sent);
  const settled=merchantReceipt(sent,{payableId,merchantShopId:shop,receiptId:"r1",decision:"received"});
  assert.equal(settled.payables.get(payableId)?.status,"confirmed");
  assert.equal(merchantReceipt(settled,{payableId,merchantShopId:shop,receiptId:"r1",decision:"received"}),settled);
  assert.equal(exposureMinor(settled),2500);
  assert.throws(()=>recordTransfer(sent,{...payment,transferId:"t2"}),/PAYABLE_ALREADY_HANDLED/);
  assert.throws(()=>recordTransfer(sent,{...payment,amountMinor:2400}),/PAYMENT_AMOUNT_MISMATCH/);
  assert.throws(()=>recordTransfer(sent,{...payment,bankReference:"changed"}),/PAYMENT_REPLAY_CONFLICT/);
  assert.throws(()=>merchantReceipt(sent,{payableId,merchantShopId:"shop-b",receiptId:"r2",decision:"received"}),/MERCHANT_FORBIDDEN/);
});
test("merchant disputes a payment without falsely settling it",()=>{
  const owed=handover(credit(state(),"o1",4)),sent=recordTransfer(owed,payment);
  const disputed=merchantReceipt(sent,{payableId,merchantShopId:shop,receiptId:"r2",decision:"dispute"});
  assert.equal(disputed.payables.get(payableId)?.status,"disputed");
  assert.throws(()=>merchantReceipt(disputed,{payableId,merchantShopId:shop,receiptId:"r3",decision:"received"}),/RECEIPT_REPLAY_CONFLICT/);
});
