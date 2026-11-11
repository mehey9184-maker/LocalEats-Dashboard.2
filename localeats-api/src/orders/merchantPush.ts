import {getApps} from "firebase-admin/app";
import {getMessaging} from "firebase-admin/messaging";

/** Best-effort wake-up after a committed, first-time pickup creation.
 * The verified merchant API inbox is the durable source of truth; a missing,
 * delayed or rejected FCM message never erases or invents an order.
 */
export interface CommittedPickup {
  id:string;shop_id:string;status:string;delivery_type:string;
}
export type MerchantPushSender=(token:string,orderId:string)=>Promise<unknown>;
export interface MerchantPushLookup {
  findOwner(shopId:string):Promise<string|null>;
  findTokens(ownerUid:string):Promise<string[]>;
}
export async function tryMerchantPickupPush(
  lookup:MerchantPushLookup,order:CommittedPickup,replayed:boolean,
  sender:MerchantPushSender=async(token,orderId)=>{
    if(!getApps().length)throw Error("FCM_NOT_CONFIGURED");
    // data-only: the registered merchant worker displays exactly one alert.
    await getMessaging().send({
      token,data:{type:"pickup_new_order",order_id:orderId},
      android:{ttl:600_000,priority:"high"},
      webpush:{headers:{TTL:"600",Urgency:"high"}},
    });
  }
):Promise<{attempted:number;accepted:number}> {
  if(replayed || !order || order.status!=="pending" ||
     order.delivery_type!=="collection" || !order.id || !order.shop_id){
    return {attempted:0,accepted:0};
  }
  try{
    const owner=await lookup.findOwner(order.shop_id);
    if(!owner)return {attempted:0,accepted:0};
    const tokens=(await lookup.findTokens(owner)).filter(t=>typeof t==="string" && t.length>=20).slice(0,5);
    if(!tokens.length)return {attempted:0,accepted:0};
    const results=await Promise.allSettled(tokens.map(t=>sender(t,order.id)));
    const accepted=results.filter(r=>r.status==="fulfilled").length;
    // No order IDs, tokens or customer PII in provider diagnostics.
    if(accepted<tokens.length) console.warn("[pickup-push] Some merchant FCM attempts were not accepted.");
    return {attempted:tokens.length,accepted};
  }catch{
    // Never return a fake failure for a successfully persisted pickup order.
    console.warn("[pickup-push] Merchant push unavailable; authoritative inbox remains available.");
    return {attempted:0,accepted:0};
  }
}
