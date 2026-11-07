import test from "node:test";
import assert from "node:assert/strict";
import {verifyCollectedKotaEvidence,verifyMerchantReceiptAuthority,
  verifyAdminTransferAuthority,verifyManualRefundReview,
  type RewardEvidenceReader,type VerifiedFirebaseActor} from "./trustedEvidence.js";

const orderId="order-pickup-1", merchantUid="shop-owner", adminUid="admin-1";
const actor=(uid=merchantUid):VerifiedFirebaseActor=>({
  uid,verifiedBy:"firebase-admin-revocation-checked",anonymous:false
});
const order = () => ({
  id:orderId,user_id:"customer-1",shop_id:"shop-1",delivery_type:"collection",
  status:"collected",payment_status:"paid",test_record:false,simulated_checkout:false,
  create_intent_hash:"a".repeat(64),created_at:"2026-11-07T10:00:00Z",
  items:[{menu_item_id:"kota",quantity:4,unit_price:25},
    {menu_item_id:"soda",quantity:1,unit_price:10}]
});
const customer=()=>({uid:"customer-1",registered:true,anonymous:false,test_account:false});
const programmeShop=()=>({shop_id:"shop-1",approval_status:"approved",
  participating_at_purchase:true,programme_version:"r1-pilot",
  rewards_started_at:"2026-11-01T00:00:00Z",shop_approved_at:"2026-10-20T00:00:00Z"});
const pickupEvents=()=>[
  {order_id:orderId,kind:"accepted",command_id:"cmd-a",actor_uid:merchantUid,revision:1,
    occurred_at:"2026-11-07T10:01:00Z"},
  {order_id:orderId,kind:"payment_confirmed",command_id:"cmd-pay",actor_uid:merchantUid,revision:2,
    occurred_at:"2026-11-07T10:03:00Z"},
  {order_id:orderId,kind:"collected",command_id:"cmd-collected",actor_uid:merchantUid,revision:3,
    occurred_at:"2026-11-07T10:12:00Z"},
];
const eligibilitySnapshots=()=>[
  {line_index:0,order_id:orderId,shop_id:"shop-1",menu_item_id:"kota",
    programme_version:"r1-pilot",qualifying_kota:true,immutable:true,
    proof_source:"server-persisted-at-purchase",snapshot_at:"2026-11-07T09:59:59Z"},
  {line_index:1,order_id:orderId,shop_id:"shop-1",menu_item_id:"soda",
    programme_version:"r1-pilot",qualifying_kota:false,immutable:true,
    proof_source:"server-persisted-at-purchase",snapshot_at:"2026-11-07T09:59:59Z"}
];
const baseOrder=()=>({
  order:order(),programmeShop:programmeShop(),registeredCustomer:customer(),
  pickupEvents:pickupEvents(),eligibilitySnapshots:eligibilitySnapshots(),verifiedRefunds:[]
});
const payableId="payable:reward:customer-1:bronze";
const merchantBundle=()=>({
  payable:{id:payableId,shop_id:"shop-1",status:"sent",amount_minor:2400,transfer_id:"transfer-1"},
  shop:{id:"shop-1",owner_id:merchantUid},
  transfer:{id:"transfer-1",payable_id:payableId,amount_minor:2400}
});
const adminBundle=()=>({
  payable:{id:payableId,shop_id:"shop-1",status:"owed",amount_minor:2400,transfer_id:null},
  adminUser:{firebase_uid:adminUid,role:"super_admin",is_active:true},
  existingTransfer:null
});
const refundId="refund-1";
const refundBundle=()=>({
  refund:{id:refundId,order_id:orderId,line_id:orderId+":line:0",customer_id:"customer-1",
    shop_id:"shop-1",units:1,amount_minor:2500,bank_or_cash_reference:"CASH-SLIP-1",
    review_status:"verified",origin:"verified_manual_shop_refund",
    merchant_verified_by_uid:merchantUid,admin_verified_by_uid:adminUid},
  creditedLine:{order_id:orderId,line_id:orderId+":line:0",
    customer_id:"customer-1",credited_units:4},
  shop:{id:"shop-1",owner_id:merchantUid},
  adminUser:{firebase_uid:adminUid,role:"super_admin",is_active:true}
});
const reader=(overrides:Partial<{
  order:unknown,merchant:unknown,admin:unknown,refund:unknown
}>={}):RewardEvidenceReader=>({
  readCollectedOrderBundle:async()=>overrides.order??baseOrder(),
  readMerchantReceiptBundle:async()=>overrides.merchant??merchantBundle(),
  readAdminTransferBundle:async()=>overrides.admin??adminBundle(),
  readRefundReviewBundle:async()=>overrides.refund??refundBundle()
});
const expectOrderReject=async(change:Record<string,unknown>,code:RegExp)=>{
  await assert.rejects(()=>verifyCollectedKotaEvidence(reader({order:{...baseOrder(),...change}}),orderId),code);
};

test("only persisted paid+collected qualifying kota units become an immutable candidate",async()=>{
  const x=await verifyCollectedKotaEvidence(reader(),orderId);
  assert.equal(x.programmeVersion,"r1-pilot");
  assert.equal(x.shopId,"shop-1");
  assert.equal(x.customerId,"customer-1");
  assert.deepEqual(x.lines,[{
    orderId,lineId:orderId+":line:0",customerId:"customer-1",shopId:"shop-1",
    quantity:4,paid:true,collected:true,eligibleKota:true,testRecord:false,refunded:false
  }]);
});
test("no fake credit from an unconfirmed payment, cancelled/delivery order or simulated test",async()=>{
  for(const change of [
    {payment_status:"unpaid"}, {status:"preparing"}, {status:"cancelled"},
    {delivery_type:"delivery"},{test_record:true},{simulated_checkout:true},
    {create_intent_hash:null},{create_intent_hash:"invalid"}])
    await expectOrderReject({order:{...order(),...change}},/REWARDS_PICKUP_NOT_VERIFIABLY_PAID_AND_COLLECTED/);
});
test("order cannot be credited without real payment/collected command sequence",async()=>{
  for(const events of [
    [],pickupEvents().filter(e=>e.kind!=="payment_confirmed"),
    pickupEvents().filter(e=>e.kind!=="collected"),
    [...pickupEvents().slice(0,2),{...pickupEvents()[2],revision:1}],
    [...pickupEvents().slice(0,2),{...pickupEvents()[2],occurred_at:"2026-11-07T10:02:00Z"}],
    [...pickupEvents().slice(0,2),{...pickupEvents()[2],actor_uid:""}],
    [...pickupEvents().slice(0,2),{...pickupEvents()[2],order_id:"other"}]
  ])await expectOrderReject({pickupEvents:events},/REWARDS_(PAYMENT_AND_HANDOVER_PROOF_REQUIRED|PICKUP_EVENT_INVALID)/);
});
test("server programme opt-in must precede purchase; no retroactive paid rewards",async()=>{
  for(const shop of [
    {...programmeShop(),participating_at_purchase:false},
    {...programmeShop(),approval_status:"pending"},
    {...programmeShop(),rewards_started_at:"2026-11-08T00:00:00Z"},
    {...programmeShop(),shop_approved_at:"2026-11-08T00:00:00Z"},
    {...programmeShop(),shop_id:"shop-other"}])
    await expectOrderReject({programmeShop:shop},/REWARDS_PROGRAMME_NOT_ELIGIBLE_AT_PURCHASE/);
});
test("customers must be registered, verified, and not simulated/test accounts",async()=>{
  for(const x of [
    {...customer(),anonymous:true},
    {...customer(),registered:false},
    {...customer(),test_account:true},
    {...customer(),uid:"another-customer"}])
    await expectOrderReject({registeredCustomer:x},/REWARDS_REGISTERED_CUSTOMER_REQUIRED/);
});
test("missing immutability proof or mismatched eligibility prevents credit",async()=>{
  for(const snaps of [
    [],[...eligibilitySnapshots().slice(0,1)],
    [{...eligibilitySnapshots()[0],proof_source:"request-body"},eligibilitySnapshots()[1]],
    [{...eligibilitySnapshots()[0],immutable:false},eligibilitySnapshots()[1]],
    [{...eligibilitySnapshots()[0],line_index:1},eligibilitySnapshots()[1]],
    [{...eligibilitySnapshots()[0],shop_id:"other"},eligibilitySnapshots()[1]],
    [{...eligibilitySnapshots()[0],programme_version:"other"},eligibilitySnapshots()[1]],
    [{...eligibilitySnapshots()[0],snapshot_at:"2026-11-07T10:01:00Z"},eligibilitySnapshots()[1]]
  ])await expectOrderReject({eligibilitySnapshots:snaps},
      /REWARDS_(IMMUTABLE_LINES_REQUIRED|IMMUTABLE_ELIGIBILITY_UNCONFIRMED)/);
});
test("an uncertain or already refunded order fails closed instead of falsely awarding",async()=>{
  await expectOrderReject({verifiedRefunds:undefined},/REWARDS_REFUND_HISTORY_UNAVAILABLE/);
  await expectOrderReject({verifiedRefunds:[{refund_id:"r1"}]},/REWARDS_REFUNDED_ORDER_REQUIRES_REVIEW/);
  await expectOrderReject({eligibilitySnapshots:[
    {...eligibilitySnapshots()[0],qualifying_kota:false},eligibilitySnapshots()[1]]},
    /REWARDS_NO_QUALIFYING_KOTA/);
});
test("untrusted order source cannot invent identities, quantity or customer profile",async()=>{
  for(const change of [
    {id:"other"},{shop_id:"different"},{user_id:""},
    {items:[{menu_item_id:"kota",quantity:-4,unit_price:25},{...order().items[1]}]},
    {items:[{menu_item_id:"kota",quantity:4,unit_price:NaN},{...order().items[1]}]},
  ])await assert.rejects(()=>verifyCollectedKotaEvidence(
    reader({order:{...baseOrder(),order:{...order(),...change}}}),orderId));
  await assert.rejects(()=>verifyCollectedKotaEvidence(reader(),"wrong-id"),/REWARDS_ORDER_IDENTITY_MISMATCH/);
});
test("merchant receipt requires revoked-token-checked identity, actual shop ownership and paid transfer",async()=>{
  const ok=await verifyMerchantReceiptAuthority(reader(),actor(),payableId);
  assert.deepEqual(ok,{payableId,shopId:"shop-1",verifiedMerchantUid:merchantUid,
    amountMinor:2400,transferId:"transfer-1"});
  for(const impersonator of [
    {...actor(),uid:"another-owner"}, {...actor(),anonymous:true},
    {...actor(),verifiedBy:"browser-user-metadata"}])
    await assert.rejects(()=>verifyMerchantReceiptAuthority(reader(),
      impersonator as VerifiedFirebaseActor,payableId));
  for(const edit of [
    {payable:{...merchantBundle().payable,status:"owed"}},
    {payable:{...merchantBundle().payable,amount_minor:2500}},
    {shop:{id:"shop-1",owner_id:"other"}},
    {transfer:{...merchantBundle().transfer,payable_id:"different"}}
  ])await assert.rejects(()=>verifyMerchantReceiptAuthority(
    reader({merchant:{...merchantBundle(),...edit}}),actor(),payableId),
      /REWARDS_MERCHANT_RECEIPT_FORBIDDEN/);
});
test("only a revocation-checked active Super Admin may record a previously owed transfer",async()=>{
  const ok=await verifyAdminTransferAuthority(reader(),actor(adminUid),payableId);
  assert.deepEqual(ok,{payableId,verifiedAdminUid:adminUid,shopId:"shop-1",amountMinor:2400});
  for(const edit of [
    {adminUser:{...adminBundle().adminUser,is_active:false}},
    {adminUser:{...adminBundle().adminUser,role:"merchant"}},
    {adminUser:{...adminBundle().adminUser,firebase_uid:"other"}}
  ])await assert.rejects(()=>verifyAdminTransferAuthority(
    reader({admin:{...adminBundle(),...edit}}),actor(adminUid),payableId),
      /REWARDS_ACTIVE_SUPER_ADMIN_REQUIRED/);
  for(const edit of [
    {payable:{...adminBundle().payable,status:"sent"}},
    {payable:{...adminBundle().payable,amount_minor:-100}},
    {payable:{...adminBundle().payable,transfer_id:"already-sent"}}
  ])await assert.rejects(()=>verifyAdminTransferAuthority(
    reader({admin:{...adminBundle(),...edit}}),actor(adminUid),payableId),
      /REWARDS_PAYOUT_NOT_OWED_OR_ALREADY_SENT/);
});
test("cash/pay-at-shop refund needs independent merchant+admin approval, not customer input",async()=>{
  const ok=await verifyManualRefundReview(reader(),refundId);
  assert.deepEqual(ok,{refundId,orderId,lineId:orderId+":line:0",
    customerId:"customer-1",shopId:"shop-1",units:1,merchantUid,adminUid});
  for(const edit of [
    {refund:{...refundBundle().refund,review_status:"requested"}},
    {refund:{...refundBundle().refund,origin:"customer-input"}},
    {refund:{...refundBundle().refund,units:0}},
    {refund:{...refundBundle().refund,amount_minor:0}},
  ])await assert.rejects(()=>verifyManualRefundReview(
    reader({refund:{...refundBundle(),...edit}}),refundId),/REWARDS_REFUND_NOT_VERIFIED/);
});
test("refund source ownership, credited units and independent reviewer must match",async()=>{
  for(const edit of [
    {credit:{},creditedLine:{...refundBundle().creditedLine,credited_units:0}},
    {creditedLine:{...refundBundle().creditedLine,customer_id:"other"}},
    {creditedLine:{...refundBundle().creditedLine,credited_units:0}},
  ])await assert.rejects(()=>verifyManualRefundReview(
    reader({refund:{...refundBundle(),...edit}}),refundId),/REWARDS_REFUND_CREDIT_MISMATCH/);
  for(const edit of [
    {shop:{id:"shop-1",owner_id:"different"}},
    {adminUser:{...refundBundle().adminUser,is_active:false}},
    {refund:{...refundBundle().refund,admin_verified_by_uid:merchantUid}},
    {refund:{...refundBundle().refund,merchant_verified_by_uid:"different"}},
  ])await assert.rejects(()=>verifyManualRefundReview(
    reader({refund:{...refundBundle(),...edit}}),refundId),
      /REWARDS_INDEPENDENT_REFUND_APPROVAL_REQUIRED/);
});
test("missing server-backed evidence cannot be treated as a successful payout",async()=>{
  await assert.rejects(()=>verifyCollectedKotaEvidence(
    { ...reader(), readCollectedOrderBundle:async()=>null },orderId),/REWARDS_EVIDENCE_UNAVAILABLE/);
  await assert.rejects(()=>verifyAdminTransferAuthority(
    {...reader(),readAdminTransferBundle:async()=>null},actor(adminUid),payableId),
    /REWARDS_ADMIN_PROOF_UNAVAILABLE/);
  await assert.rejects(()=>verifyMerchantReceiptAuthority(
    {...reader(),readMerchantReceiptBundle:async()=>null},actor(),payableId),
    /REWARDS_PAYABLE_PROOF_UNAVAILABLE/);
  await assert.rejects(()=>verifyManualRefundReview(
    {...reader(),readRefundReviewBundle:async()=>null},refundId),
    /REWARDS_REFUND_PROOF_UNAVAILABLE/);
});
