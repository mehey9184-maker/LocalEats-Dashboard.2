import {OrderContractError} from "../orders/orderContract.js";

/**
 * L3-N8U-Q: existing single-test-identity admission is retained as the default
 * when no beta configuration is set. The public beta is an EXPLICIT second
 * mode; an accidental enabled top-level pickup switch is never enough.
 *
 * All cohort values come from server-side environment settings, never headers,
 * Firebase profile metadata, request body, public VITE_ variables or email.
 */
export const CONTROLLED_PICKUP_SHOP = "shop-my-kota-ivory-park";
const MAX_BETA_SHOPS=3;
const MAX_BETA_CUSTOMERS=20;
const MAX_BETA_WINDOW_MS=30*24*60*60*1000;
const BETA_CONFIGURATION_KEYS=[
 "PICKUP_BETA_ADMISSION_ENABLED","PICKUP_BETA_SHOP_IDS",
 "PICKUP_BETA_CUSTOMER_UIDS","PICKUP_BETA_EXPIRES_AT",
] as const;

type Candidate={shop_id?:unknown;user_id?:unknown};
type PersistedPickup=Candidate & {delivery_type?:unknown;create_intent_hash?:unknown};

const deny=(status:number,code:string):never=>{throw new OrderContractError(status,code,code);};
const globalWritesEnabled=(environment:NodeJS.ProcessEnv)=>environment.PICKUP_WRITES_ENABLED==="true";
const validIdentifier=(value:unknown):value is string =>
 typeof value==="string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);

function parseList(raw:string|undefined,max:number):Set<string> {
 if(typeof raw!=="string" || raw.length===0 || raw.length>max*129) return deny(503,"PICKUP_BETA_CONFIGURATION_REQUIRED");
 const entries=raw.split(",");
 if(entries.length<1 || entries.length>max || entries.some(x=>!validIdentifier(x)))
  return deny(503,"PICKUP_BETA_CONFIGURATION_REQUIRED");
 if(new Set(entries).size!==entries.length)return deny(503,"PICKUP_BETA_CONFIGURATION_REQUIRED");
 return new Set(entries);
}

function assertBetaConfigured(environment:NodeJS.ProcessEnv,now:Date):{
 customers:Set<string>;shops:Set<string>;
}{
 if(environment.PICKUP_BETA_ADMISSION_ENABLED!=="true")
  return deny(503,"PICKUP_BETA_ADMISSION_PAUSED");
 const shops=parseList(environment.PICKUP_BETA_SHOP_IDS,MAX_BETA_SHOPS);
 const customers=parseList(environment.PICKUP_BETA_CUSTOMER_UIDS,MAX_BETA_CUSTOMERS);
 const expires=environment.PICKUP_BETA_EXPIRES_AT;
 if(typeof expires!=="string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(expires))
  return deny(503,"PICKUP_BETA_CONFIGURATION_REQUIRED");
 const expiry=Date.parse(expires),nowMs=now.getTime();
 if(!Number.isFinite(expiry) || !Number.isFinite(nowMs) ||
    new Date(expiry).toISOString()!==expires.replace("Z",".000Z") ||
    expiry<=nowMs || expiry-nowMs>MAX_BETA_WINDOW_MS)
  return deny(503,"PICKUP_BETA_CONFIGURATION_REQUIRED");
 return {customers,shops};
}

function requireBetaMode(environment:NodeJS.ProcessEnv):boolean {
 const mode=environment.PICKUP_BETA_ENABLED;
 if(mode==="true")return true;
 // A typo or a partially configured beta must NOT fall back to the old
 // test UID when the global pickup switch happens to be enabled.
 if((mode!==undefined && mode!=="false") ||
    BETA_CONFIGURATION_KEYS.some(key=>environment[key]!==undefined))
  return deny(503,"PICKUP_BETA_CONFIGURATION_REQUIRED");
 return false;
}

const assertGlobalPickupSwitch=(environment:NodeJS.ProcessEnv)=>{
 if(!globalWritesEnabled(environment))
  deny(503,"PICKUP_WRITES_DISABLED");
};

/** New order admission ONLY. Must be checked before pricing/database writes. */
export function assertControlledPickup(
 order:Candidate,environment:NodeJS.ProcessEnv=process.env,now:Date=new Date(),
):void {
 assertGlobalPickupSwitch(environment);
 if(requireBetaMode(environment)){
  const {customers,shops}=assertBetaConfigured(environment,now);
  if(!validIdentifier(order.user_id) || !validIdentifier(order.shop_id) ||
     !customers.has(order.user_id) || !shops.has(order.shop_id))
   deny(403,"PICKUP_BETA_NOT_ALLOWED");
  return;
 }
 // Historical single customer/single shop gate remains byte-for-byte in
 // intent for existing safe rehearsals and regression fixtures.
 const customer=environment.PICKUP_TEST_CUSTOMER_UID;
 if(typeof customer!=="string" || !customer || customer.length>128 ||
    customer.trim()!==customer || /[\s\x00-\x1f\x7f]/.test(customer))
  deny(503,"PICKUP_TEST_ALLOWLIST_REQUIRED");
 if(order.shop_id!==CONTROLLED_PICKUP_SHOP || order.user_id!==customer)
  deny(403,"PICKUP_TEST_NOT_ALLOWED");
}

/**
 * Commands against persisted pickup orders must remain possible if the
 * inviter closes admission, a cohort expires, or invited UIDs change.
 *
 * This is NOT authorization by itself: the existing API must load the order
 * for the authenticated customer/merchant and the SQL RPC must enforce
 * ownership, expected revision, status, and server-authoritative transitions.
 */
export function assertControlledPickupContinuation(
 order:PersistedPickup,environment:NodeJS.ProcessEnv=process.env,
):void {
 assertGlobalPickupSwitch(environment);
 if(requireBetaMode(environment)){
  if(!validIdentifier(order.user_id) || !validIdentifier(order.shop_id) ||
     order.delivery_type!=="collection" ||
     typeof order.create_intent_hash!=="string" ||
     !/^[0-9a-f]{64}$/.test(order.create_intent_hash))
   deny(403,"PICKUP_BETA_EXISTING_ORDER_REQUIRED");
  return;
 }
 assertControlledPickup(order,environment);
}

export function canSubmitControlledPickup(
 order:Candidate,environment:NodeJS.ProcessEnv=process.env,now:Date=new Date(),
):boolean {
 try{
  assertControlledPickup(order,environment,now);
  return true;
 }catch(error){
  if(error instanceof OrderContractError)return false;
  throw error;
 }
}
