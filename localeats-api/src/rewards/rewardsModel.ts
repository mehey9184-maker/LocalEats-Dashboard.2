/**
 * R2 OFFLINE REHEARSAL MODEL. There are no routes, migrations or production reward writes.
 * Production integration MUST read real paid/collected orders and merchant/admin identities
 * server-side and run every transition in a single atomic database transaction.
 */
export type Rank = "bronze" | "silver" | "gold" | "platinum";
export type Tier = Exclude<Rank, "platinum">;
export type PaymentStatus = "owed" | "sent" | "confirmed" | "disputed";
export interface Policy { active: boolean; budgetMinor: number; participatingShops: ReadonlySet<string>; }
export interface Progress { rank: Rank; stageUnits: number; lifetimeUnits: number; }
export interface PurchaseLine {
  orderId: string; lineId: string; customerId: string; shopId: string; quantity: number;
  paid: boolean; collected: boolean; eligibleKota: boolean; testRecord: boolean; refunded: boolean;
}
export interface Grant {
  id: string; customerId: string; tier: Tier; capMinor: number;
  status: "earned" | "fulfilled"; sourceOrderId: string;
}
export interface Payable {
  id: string; grantId: string; customerId: string; shopId: string; itemId: string;
  amountMinor: number; handoverId: string; status: PaymentStatus;
  transferId: string | null; receiptId: string | null;
}
export interface Transfer {
  id: string; payableId: string; adminUid: string; bankReference: string; amountMinor: number;
}
export interface Model {
  policy: Policy; customers: ReadonlyMap<string,Progress>;
  purchases: ReadonlyMap<string,PurchaseLine>; grants: ReadonlyMap<string,Grant>;
  payables: ReadonlyMap<string,Payable>; transfers: ReadonlyMap<string,Transfer>;
}
const thresholds: Record<Tier,number> = {bronze:4, silver:20, gold:40};
const caps: Record<Tier,number> = {bronze:2500, silver:12500, gold:20000};
const next: Record<Tier,Rank> = {bronze:"silver",silver:"gold",gold:"platinum"};
const goodId = (s:string) => typeof s==="string" && s.length>0 && s.length<=160 &&
  !/[\x00-\x1f\x7f]/.test(s) && s.trim()===s;
const positive = (n:number) => Number.isSafeInteger(n) && n>0;
const fail = (code:string): never => {throw Error(code);};
const check = (ok:boolean,code:string): void => {if(!ok)fail(code);};
const same = (a:unknown,b:unknown) => JSON.stringify(a)===JSON.stringify(b);

export function newModel(policy:Policy={active:false,budgetMinor:0,participatingShops:new Set()}):Model {
  check(Number.isSafeInteger(policy.budgetMinor)&&policy.budgetMinor>=0,"INVALID_BUDGET");
  return {policy:{active:policy.active===true,budgetMinor:policy.budgetMinor,
    participatingShops:new Set(policy.participatingShops)},
    customers:new Map(),purchases:new Map(),grants:new Map(),payables:new Map(),transfers:new Map()};
}
/** Budget exposure includes reserved unredeemed rewards AND all fulfilled reward expenses. */
export function exposureMinor(model:Model):number {
  let n=0;
  for(const g of model.grants.values())if(g.status==="earned")n+=g.capMinor;
  for(const p of model.payables.values())n+=p.amountMinor;
  check(Number.isSafeInteger(n),"EXPOSURE_OVERFLOW");
  return n;
}
/** ONLY the central order service may provide trusted persisted line events. */
export function creditCollectedLine(model:Model,event:PurchaseLine):Model {
  check(model.policy.active,"REWARDS_INACTIVE");
  check([event.orderId,event.lineId,event.customerId,event.shopId].every(goodId),"INVALID_PURCHASE_SOURCE");
  check(positive(event.quantity)&&event.quantity<=100,"INVALID_QUANTITY");
  check(event.paid===true&&event.collected===true&&event.eligibleKota===true&&
    event.testRecord===false&&event.refunded===false,"NOT_A_QUALIFYING_PURCHASE");
  check(model.policy.participatingShops.has(event.shopId),"SHOP_NOT_PARTICIPATING");
  const key=event.orderId+"\u001f"+event.lineId;
  const old=model.purchases.get(key);
  if(old){check(same(old,event),"PURCHASE_REPLAY_CONFLICT");return model;}
  const customers=new Map(model.customers),purchases=new Map(model.purchases),grants=new Map(model.grants);
  const before=customers.get(event.customerId)??{rank:"bronze" as const,stageUnits:0,lifetimeUnits:0};
  check(Number.isSafeInteger(before.lifetimeUnits+event.quantity),"LIFETIME_OVERFLOW");
  let rank:Rank=before.rank,stageUnits=before.stageUnits;
  for(let i=0;i<event.quantity;i++){
    if(rank==="platinum")continue;
    stageUnits++;
    if(stageUnits===thresholds[rank]){
      const id=event.customerId+":reward:"+rank;
      check(!grants.has(id),"DUPLICATE_MILESTONE");
      grants.set(id,{id,customerId:event.customerId,tier:rank,capMinor:caps[rank],
        status:"earned",sourceOrderId:event.orderId});
      rank=next[rank];stageUnits=0;
    }
  }
  customers.set(event.customerId,{rank,stageUnits,lifetimeUnits:before.lifetimeUnits+event.quantity});
  purchases.set(key,{...event});
  const result={...model,customers,purchases,grants};
  check(exposureMinor(result)<=model.policy.budgetMinor,"UNFUNDED_REWARD_PROMISE");
  return result;
}
export interface Handover {
  grantId:string;customerId:string;shopId:string;merchantShopId:string;handoverId:string;
  itemId:string;kind:"standard_kota"|"other_food"|"bundle";priceMinor:number;
}
/** Handover and payable are one indivisible synthetic transition; no payable on mere milestone. */
export function fulfil(model:Model,input:Handover):Model {
  check(model.policy.active,"REWARDS_INACTIVE");
  check([input.grantId,input.customerId,input.shopId,input.merchantShopId,input.handoverId,input.itemId].every(goodId),"INVALID_HANDOVER");
  check(input.shopId===input.merchantShopId&&model.policy.participatingShops.has(input.shopId),"MERCHANT_FORBIDDEN");
  const grant=model.grants.get(input.grantId);
  check(!!grant&&grant.customerId===input.customerId,"GRANT_NOT_OWNED");
  check(positive(input.priceMinor)&&input.priceMinor<=grant!.capMinor,"REWARD_PRICE_INVALID");
  if(grant!.tier==="bronze"){
    check(input.kind==="standard_kota"||input.kind==="other_food","BRONZE_ITEM_INVALID");
    if(input.kind==="other_food")check(input.priceMinor<2500,"ALTERNATIVE_FOOD_MUST_COST_BELOW_R25");
  }else check(input.kind==="bundle","BUNDLE_REQUIRED");
  const id=grant!.id+":payable",old=model.payables.get(id);
  if(old){
    check(old.customerId===input.customerId&&old.shopId===input.shopId&&
      old.handoverId===input.handoverId&&old.itemId===input.itemId&&old.amountMinor===input.priceMinor,
      "REDEMPTION_REPLAY_CONFLICT");
    return model;
  }
  check(grant!.status==="earned","ALREADY_FULFILLED");
  check(![...model.payables.values()].some(p=>p.handoverId===input.handoverId),"HANDOVER_REUSED");
  const grants=new Map(model.grants),payables=new Map(model.payables);
  grants.set(grant!.id,{...grant!,status:"fulfilled"});
  payables.set(id,{id,grantId:grant!.id,customerId:input.customerId,shopId:input.shopId,
    itemId:input.itemId,amountMinor:input.priceMinor,handoverId:input.handoverId,
    status:"owed",transferId:null,receiptId:null});
  return {...model,grants,payables};
}
export interface ExternalPayment {
  payableId:string;transferId:string;adminUid:string;bankReference:string;amountMinor:number;
}
/** Bank transfer is external; this only records an admin-verified reference, NOT settlement. */
export function recordTransfer(model:Model,input:ExternalPayment):Model {
  check(model.policy.active,"REWARDS_INACTIVE");
  check([input.payableId,input.transferId,input.adminUid,input.bankReference].every(goodId),"INVALID_PAYMENT_REFERENCE");
  const payable=model.payables.get(input.payableId);
  check(!!payable,"PAYABLE_NOT_FOUND");
  check(input.amountMinor===payable!.amountMinor,"PAYMENT_AMOUNT_MISMATCH");
  const prior=model.transfers.get(input.transferId);
  if(prior){
    check(same(prior,{id:input.transferId,payableId:input.payableId,adminUid:input.adminUid,
      bankReference:input.bankReference,amountMinor:input.amountMinor}),"PAYMENT_REPLAY_CONFLICT");
    return model;
  }
  check(payable!.status==="owed","PAYABLE_ALREADY_HANDLED");
  const payables=new Map(model.payables),transfers=new Map(model.transfers);
  payables.set(payable!.id,{...payable!,status:"sent",transferId:input.transferId});
  transfers.set(input.transferId,{id:input.transferId,payableId:input.payableId,
    adminUid:input.adminUid,bankReference:input.bankReference,amountMinor:input.amountMinor});
  return {...model,payables,transfers};
}
export interface MerchantReceipt {
  payableId:string;merchantShopId:string;receiptId:string;decision:"received"|"dispute";
}
/** The real integration must derive merchantShopId from authenticated shop ownership. */
export function merchantReceipt(model:Model,input:MerchantReceipt):Model {
  check(model.policy.active,"REWARDS_INACTIVE");
  check([input.payableId,input.merchantShopId,input.receiptId].every(goodId),"INVALID_RECEIPT");
  const payable=model.payables.get(input.payableId);
  check(!!payable&&payable.shopId===input.merchantShopId,"MERCHANT_FORBIDDEN");
  const target:PaymentStatus=input.decision==="received"?"confirmed":
    input.decision==="dispute"?"disputed":fail("RECEIPT_DECISION_INVALID");
  if(payable!.receiptId){
    check(payable!.receiptId===input.receiptId&&payable!.status===target,"RECEIPT_REPLAY_CONFLICT");
    return model;
  }
  check(payable!.status==="sent","PAYMENT_NOT_SENT");
  const payables=new Map(model.payables);
  payables.set(payable!.id,{...payable!,status:target,receiptId:input.receiptId});
  return {...model,payables};
}
