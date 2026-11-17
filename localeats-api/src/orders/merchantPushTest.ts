import {randomUUID} from "node:crypto";
import {getApps} from "firebase-admin/app";
import {getMessaging} from "firebase-admin/messaging";

const INSTALLATION_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COOLDOWN_MS=60_000;

export interface MerchantPushTestDependencies {
  hasApprovedShop:(uid:string)=>Promise<boolean>;
  findOwnedActiveDevice:(uid:string,installationId:string)=>Promise<string|null>;
  send:(token:string,testId:string)=>Promise<void>;
  now?:()=>number;
}
export type MerchantPushTestResult={status:202|400|403|404|429|503;code:string};

/**
 * Explicitly requested, merchant-owned, device-scoped TEST. No orders,
 * payments, messages, customer fields, or database writes.
 *
 * Process-local cooldown is defense in depth against rapid duplicate clicks,
 * not a distributed rate-limit guarantee. The authenticated user can reach only
 * their own device. Never return or log a token or Firebase message ID.
 */
export function createMerchantPushTestService(
  dependencies:MerchantPushTestDependencies,
  lastAttempt=new Map<string,number>()
):(uid:string,installationId:string)=>Promise<MerchantPushTestResult>{
  return async(uid,installationId)=>{
    if(!uid||!INSTALLATION_UUID.test(installationId))return {status:400,code:"TEST_INVALID_DEVICE"};
    const key=`${uid}:${installationId}`;
    const now=dependencies.now?.()??Date.now();
    const previous=lastAttempt.get(key);
    if(previous!==undefined && now-previous<COOLDOWN_MS)return {status:429,code:"TEST_PUSH_COOLDOWN"};
    // Reserve the attempt before asynchronous I/O to prevent concurrent
    // double-clicks from sending two notifications on the same instance.
    lastAttempt.set(key,now);
    try{
      if(!await dependencies.hasApprovedShop(uid))return {status:403,code:"TEST_MERCHANT_NOT_APPROVED"};
      const token=await dependencies.findOwnedActiveDevice(uid,installationId);
      if(!token)return {status:404,code:"TEST_DEVICE_NOT_REGISTERED"};
      await dependencies.send(token,randomUUID());
      return {status:202,code:"FCM_ACCEPTED_NOT_DEVICE_DELIVERED"};
    }catch{
      return {status:503,code:"TEST_FCM_UNAVAILABLE"};
    }finally{
      // Bounded process memory; eviction only affects this optional throttle.
      if(lastAttempt.size>1000){
        for(const [k,t] of lastAttempt)if(now-t>COOLDOWN_MS)lastAttempt.delete(k);
      }
    }
  };
}
export async function sendMerchantTestPushToFirebase(token:string,testId:string):Promise<void>{
  if(!getApps().length)throw new Error("FIREBASE_ADMIN_NOT_CONFIGURED");
  await getMessaging().send({
    token,
    data:{type:"merchant_push_test",test_id:testId},
    webpush:{headers:{TTL:"120",Urgency:"high"}}
  });
}
