import test from "node:test";
import assert from "node:assert/strict";
import {
  createInertR30FinancialReviewExecutor,
  type ReadOnlyFinancialTransaction,
  type ReadOnlyFinancialTransactionStore,
} from "./secureExecutorR30.js";
import type {FinancialTokenVerifier} from "./financeActor.js";

const payableId="payable-r30",shopId="shop-r30",ownerUid="merchant-owner-r30";
const adminUid="admin-owner-r30";
const adminHeader="Bearer fb-valid-admin-token",ownerHeader="Bearer fb-valid-owner-token";
type FixtureState={
  currentOwner:string;
  adminActive:boolean;
  adminRole:string;
  payableStatus:string;
  amountMinor:number;
  hasExistingTransfer:boolean;
  transferAmountMinor:number;
};
const initial=():FixtureState=>({
  currentOwner:ownerUid,adminActive:true,adminRole:"super_admin",
  payableStatus:"owed",amountMinor:2400,hasExistingTransfer:false,
  transferAmountMinor:2400,
});
function setup(options?:{state?:Partial<FixtureState>;revoked?:boolean;
  anonymous?:boolean;verifierException?:boolean}) {
  const state={...initial(),...options?.state};
  let transactions=0,reads=0,verifications=0;
  const verifyIdToken:FinancialTokenVerifier=async (token,checkRevoked)=>{
    verifications++;
    assert.equal(checkRevoked,true,"R3.0 must always check token revocation");
    if(options?.revoked || options?.verifierException || token.includes("revoked"))
      throw Error("FIREBASE_ID_TOKEN_REVOKED_OR_DISABLED");
    const uid=token==="valid-admin-token"?adminUid:
      token==="valid-owner-token"?ownerUid:
      token==="valid-attacker-token"?"attacker":"";
    if(!uid)throw Error("FIREBASE_TOKEN_INVALID");
    return {uid,firebase:{sign_in_provider:options?.anonymous?"anonymous":"password"},
      // User-controlled metadata is deliberately not read for role/owner.
      user_metadata:{role:"super_admin",owner_uid:ownerUid}};
  };
  const transaction:ReadOnlyFinancialTransaction={
    readCollectedOrderBundle:async()=>{throw Error("NOT_A_CREDIT_ENDPOINT");},
    readRefundReviewBundle:async()=>{throw Error("NOT_A_REFUND_ENDPOINT");},
    readAdminTransferBundle:async()=>{
      reads++;
      return {
        payable:{id:payableId,shop_id:shopId,status:state.payableStatus,
          amount_minor:state.amountMinor,transfer_id:null},
        adminUser:{firebase_uid:adminUid,role:state.adminRole,is_active:state.adminActive},
        existingTransfer:state.hasExistingTransfer?{id:"already-transferred"}:null,
      };
    },
    readMerchantReceiptBundle:async()=>{
      reads++;
      return {
        payable:{id:payableId,shop_id:shopId,status:state.payableStatus,
          amount_minor:state.amountMinor,transfer_id:"transfer-r30"},
        shop:{id:shopId,owner_id:state.currentOwner},
        transfer:{id:"transfer-r30",payable_id:payableId,
          amount_minor:state.transferAmountMinor},
      };
    },
  };
  const store:ReadOnlyFinancialTransactionStore={
    readOnlySerializable:async fn=>{
      transactions++;
      return fn(transaction);
    },
  };
  const executor=createInertR30FinancialReviewExecutor({verifyIdToken,transactions:store});
  return {executor,state,counts:()=>({transactions,reads,verifications})};
}

test("R3.0: server startup requires a fixed verifier and transactional reader",()=>{
  assert.throws(()=>createInertR30FinancialReviewExecutor(
    null as unknown as Parameters<typeof createInertR30FinancialReviewExecutor>[0]),
    /REWARDS_FINANCIAL_REVIEW_NOT_CONFIGURED/);
});

test("R3.0: revocation-checked Super Admin can review ONLY, never settle or transfer",async()=>{
  const {executor,counts}=setup();
  const result=await executor.reviewAdminTransfer(adminHeader,payableId);
  assert.deepEqual(result,{
    mode:"review-only",payableId,actorUid:adminUid,shopId,amountMinor:2400,
    kind:"admin-proposed-transfer",canSettlePayment:false,
  });
  assert.equal(Object.isFrozen(result),true);
  assert.equal(typeof (executor as unknown as {sendMoney?:unknown}).sendMoney,"undefined");
  assert.equal(typeof (executor as unknown as {creditOrder?:unknown}).creditOrder,"undefined");
  assert.deepEqual(counts(),{transactions:1,reads:1,verifications:1});
});

test("R3.0: current shop owner may only review receipt supported by matching sent transfer",async()=>{
  const {executor,counts,state}=setup({state:{payableStatus:"sent"}});
  const result=await executor.reviewMerchantReceipt(ownerHeader,payableId);
  assert.deepEqual(result,{
    mode:"review-only",payableId,actorUid:ownerUid,shopId,amountMinor:2400,
    kind:"merchant-proposed-receipt",canSettlePayment:false,
  });
  assert.equal(counts().reads,1);
  assert.equal(state.payableStatus,"sent","Review must not change financial status");
});

test("R3.0: revoked/disabled/anonymous/forged/expired tokens never enter DB transaction",async()=>{
  for(const variant of [
    {header:undefined},
    {header:"Bearer forged-client-token"},
    {header:"Bearer fb-bad"},
    {header:"Bearer fb-valid owner token"},
    {header:ownerHeader,revoked:true},
    {header:ownerHeader,anonymous:true},
    {header:ownerHeader,verifierException:true},
  ]){
    const {executor,counts}=setup(variant);
    await assert.rejects(
      ()=>executor.reviewMerchantReceipt(variant.header,payableId),
      /REWARDS_FINANCIAL_AUTH_REQUIRED/);
    assert.equal(counts().transactions,0);
    assert.equal(counts().reads,0);
  }
});

test("R3.0: forged client metadata cannot make a normal user a Super Admin",async()=>{
  const {executor,counts}=setup();
  await assert.rejects(
    ()=>executor.reviewAdminTransfer("Bearer fb-valid-attacker-token",payableId),
    /REWARDS_ACTIVE_SUPER_ADMIN_REQUIRED/);
  assert.deepEqual(counts(),{transactions:1,reads:1,verifications:1});
});

test("R3.0: merchant role/ownership is rechecked after token verification",async()=>{
  const {executor,state}=setup({state:{payableStatus:"sent"}});
  // The Firebase identity is still valid but ownership has transferred in DB.
  state.currentOwner="new-owner-uid";
  await assert.rejects(
    ()=>executor.reviewMerchantReceipt(ownerHeader,payableId),
    /REWARDS_MERCHANT_RECEIPT_FORBIDDEN/);
});

test("R3.0: active admin role and transferred payable are evaluated inside the DB read",async()=>{
  for(const state of [
    {adminActive:false},
    {adminRole:"merchant"},
    {payableStatus:"sent"},
    {hasExistingTransfer:true},
    {amountMinor:-25},
  ]){
    const {executor}=setup({state});
    await assert.rejects(()=>executor.reviewAdminTransfer(adminHeader,payableId),
      /REWARDS_(ACTIVE_SUPER_ADMIN_REQUIRED|PAYOUT_NOT_OWED_OR_ALREADY_SENT)/);
  }
});

test("R3.0: merchant cannot claim a receipt if transfer amount changed or payable unsent",async()=>{
  for(const state of [
    {payableStatus:"owed"},
    {payableStatus:"sent",transferAmountMinor:1400},
    {payableStatus:"sent",currentOwner:"different-owner"},
    {payableStatus:"sent",amountMinor:0},
  ]){
    const {executor}=setup({state});
    await assert.rejects(()=>executor.reviewMerchantReceipt(ownerHeader,payableId),
      /REWARDS_MERCHANT_RECEIPT_FORBIDDEN/);
  }
});

test("R3.0: private reader errors fail closed, never return a fabricated financial success",async()=>{
  const verifyIdToken:FinancialTokenVerifier=async (_,checkRevoked)=>{
    assert.equal(checkRevoked,true);
    return {uid:adminUid,firebase:{sign_in_provider:"password"}};
  };
  const transactions:ReadOnlyFinancialTransactionStore={
    readOnlySerializable:async ()=>{throw Error("DATABASE_READ_UNAVAILABLE");},
  };
  const executor=createInertR30FinancialReviewExecutor({verifyIdToken,transactions});
  await assert.rejects(()=>executor.reviewAdminTransfer(adminHeader,payableId),
    /DATABASE_READ_UNAVAILABLE/);
});

test("R3.0: callback configuration is captured once, not changeable per HTTP request",async()=>{
  const {executor,counts}=setup();
  await executor.reviewAdminTransfer(adminHeader,payableId);
  await assert.rejects(()=>executor.reviewAdminTransfer(ownerHeader,payableId),
    /REWARDS_ACTIVE_SUPER_ADMIN_REQUIRED/);
  assert.deepEqual(counts(),{transactions:2,reads:2,verifications:2});
});
