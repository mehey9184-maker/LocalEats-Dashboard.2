import {OrderContractError} from "../orders/orderContract.js";

export const CONTROLLED_PICKUP_SHOP = "shop-my-kota-ivory-park";
const PILOT_MAX_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Only an explicitly selected first real shop may admit public pickup customers.
// This gate supplements, never replaces, approved/effective-open shop status,
// authenticated non-anonymous Firebase identity, real menu/price, and 4 km checks.
function isValidFirebaseUid(value:unknown):value is string{
 return typeof value==="string" && value.length>=1 && value.length<=128 &&
  value.trim()===value && /^[A-Za-z0-9:_-]+$/.test(value);
}

export function assertControlledPickup(
 order:{shop_id?:unknown;user_id?:unknown},
 environment:NodeJS.ProcessEnv=process.env,
 now:number=Date.now()
):void {
 if(environment.PICKUP_WRITES_ENABLED!=="true")
  throw new OrderContractError(503,"PICKUP_WRITES_DISABLED","Pickup writes are disabled.");

 if(environment.PICKUP_PUBLIC_PILOT_ENABLED==="true"){
  // Fail closed on a typo, wrong shop, empty expiry, malformed/expired expiry,
  // or a 7+ day invitation. No env setting can authorize arbitrary new shops.
  if(environment.PICKUP_PUBLIC_PILOT_SHOP_ID!==CONTROLLED_PICKUP_SHOP)
   throw new OrderContractError(503,"PICKUP_PUBLIC_PILOT_SHOP_INVALID","Public pickup pilot shop is not configured.");
  const until=environment.PICKUP_PUBLIC_PILOT_EXPIRES_AT;
  const expires=typeof until==="string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(until)
   ? Date.parse(until) : NaN;
  if(!Number.isFinite(now) || !Number.isFinite(expires) ||
     expires<=now || expires-now>PILOT_MAX_WINDOW_MS)
   throw new OrderContractError(503,"PICKUP_PUBLIC_PILOT_EXPIRED","Public pickup pilot is not active.");
  if(order.shop_id!==CONTROLLED_PICKUP_SHOP || !isValidFirebaseUid(order.user_id))
   throw new OrderContractError(403,"PICKUP_PILOT_NOT_ALLOWED","Pickup is unavailable for this shop or customer.");
  return;
 }

 // Existing single-invited-customer acceptance remains available separately.
 // Never derive test identity from the request body, email or merchant owner.
 const customer=environment.PICKUP_TEST_CUSTOMER_UID;
 if(!isValidFirebaseUid(customer))
  throw new OrderContractError(503,"PICKUP_TEST_ALLOWLIST_REQUIRED","Controlled pickup test identity is not configured.");
 if(order.shop_id!==CONTROLLED_PICKUP_SHOP || order.user_id!==customer)
  throw new OrderContractError(403,"PICKUP_TEST_NOT_ALLOWED","This order is outside the controlled pickup test.");
}

export function canSubmitControlledPickup(order:{shop_id?:unknown;user_id?:unknown}):boolean{
 try{assertControlledPickup(order);return true;}
 catch(error){if(error instanceof OrderContractError)return false;throw error;}
}
