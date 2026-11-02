import {getApps} from "firebase-admin/app";
import {getMessaging} from "firebase-admin/messaging";

// Best-effort FCM wake-ups for newly committed pickup facts. The canonical
// order remains in the authenticated API even when a device is offline.
// Customer Ready uses the existing durable pickup_push_outbox instead.
export type PickupPushPurpose="merchant_new_order"|"pickup_accepted"|"pickup_collected"|"pickup_rejected";
export type StoredPickupPushOrder={id:string;shop_id:string|number;user_id:string;delivery_type?:string;create_intent_hash?:string|null};
export type TokenReader={from:(table:string)=>any};
export type WakeSender=(tokens:string[],data:Record<string,string>)=>Promise<void>;
const realSender:WakeSender=async(tokens,data)=>{
 await getMessaging().sendEachForMulticast({
  tokens,data,
  webpush:{headers:{TTL:"300"}},
  android:{ttl:300_000},
 });
};
const statusForPurpose:Record<Exclude<PickupPushPurpose,"merchant_new_order">,string>={
 pickup_accepted:"preparing",pickup_collected:"completed",pickup_rejected:"cancelled",
};

export async function sendConfirmedPickupWake(
 client:TokenReader,
 order:StoredPickupPushOrder,
 purpose:PickupPushPurpose,
 sender?:WakeSender,
):Promise<boolean>{
 // Only a server-persisted controlled pickup order can produce a wake-up.
 if(!order?.id || !order.shop_id || !order.user_id || !order.create_intent_hash ||
    order.delivery_type!=="collection" || (!sender && !getApps().length))return false;
 try{
  let recipient=order.user_id;
  if(purpose==="merchant_new_order"){
   // Never trust a client-supplied merchant ID; load the owning merchant from
   // the same persisted shop referenced by the confirmed order.
   const {data,error}=await client.from("shops").select("owner_id").eq("id",order.shop_id)
     .is("archived_at",null).maybeSingle();
   if(error || typeof data?.owner_id!=="string" || !data.owner_id.trim())return false;
   recipient=data.owner_id;
  }
  if(!recipient)return false;
  const {data:devices,error}=await client.from("pickup_push_subscriptions").select("fcm_token")
    .eq("user_id",recipient).is("revoked_at",null).not("fcm_token","is",null).limit(20);
  if(error || !Array.isArray(devices))return false;
  const tokens=[...new Set(devices.map(item=>item?.fcm_token).filter(
   (token):token is string=>typeof token==="string" && token.length>=20 && token.length<=4096
  ))];
  if(!tokens.length)return false;
  const data:Record<string,string>=purpose==="merchant_new_order"
   ? {type:"merchant_new_order",order_id:order.id}
   : {type:"pickup_status",status:statusForPurpose[purpose],order_id:order.id};
  await (sender ?? realSender)(tokens,data);
  return true;
 }catch{
  // Never turn an already committed order into a false checkout failure or
  // leak device tokens through logs. The in-app API history is authoritative.
  return false;
 }
}
