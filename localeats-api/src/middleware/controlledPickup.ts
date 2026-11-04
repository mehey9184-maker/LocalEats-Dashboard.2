import {OrderContractError} from "../orders/orderContract.js";
export const CONTROLLED_PICKUP_SHOP = "shop-my-kota-ivory-park";
// Server-only configuration. Never derive test identity from a request body, email or shop owner.
export function assertControlledPickup(order:{shop_id?:unknown;user_id?:unknown},environment:NodeJS.ProcessEnv=process.env):void {
 if(environment.PICKUP_WRITES_ENABLED!=="true")throw new OrderContractError(503,"PICKUP_WRITES_DISABLED","Pickup writes are disabled.");
 const customer=environment.PICKUP_TEST_CUSTOMER_UID;
 if(typeof customer!=="string" || !customer || customer.length>128 || customer.trim()!==customer || /[\s\x00-\x1f\x7f]/.test(customer))
  throw new OrderContractError(503,"PICKUP_TEST_ALLOWLIST_REQUIRED","Controlled pickup test identity is not configured.");
 if(order.shop_id!==CONTROLLED_PICKUP_SHOP || order.user_id!==customer)
  throw new OrderContractError(403,"PICKUP_TEST_NOT_ALLOWED","This order is outside the controlled pickup test.");
}
