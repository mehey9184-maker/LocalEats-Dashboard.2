import {randomUUID} from "node:crypto";
import {getApps} from "firebase-admin/app";
import {getMessaging} from "firebase-admin/messaging";

const INSTALLATION_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type CustomerPushTestResult={status:202|400|403|404|429|503;code:string};
export interface CustomerPushTestDependencies {
  enabled:()=>boolean;
  allowUser:(uid:string)=>boolean;
  findOwnedActiveDevice:(uid:string,installationId:string)=>Promise<string|null>;
  /** Atomic, distributed 60-second AND per-day test limit. Fail closed if absent. */
  claimQuota:(uid:string)=>Promise<boolean>;
  send:(token:string,testId:string)=>Promise<void>;
}
/**
 * Explicit customer-owned, allowlisted diagnostic only. No order creation,
 * payment mutation, purchase action or public FCM token lookup.
 * The distributed quota claim occurs BEFORE send, even on provider failure.
 * Firebase acceptance is not evidence the device displayed an alert.
 */
export function createCustomerPushTestService(d:CustomerPushTestDependencies) {
  return async(uid:string,installationId:string):Promise<CustomerPushTestResult>=>{
    if(!d.enabled()) return {status:503,code:"CUSTOMER_TEST_DISABLED"};
    if(!INSTALLATION_UUID.test(installationId) || !uid) return {status:400,code:"TEST_INVALID_DEVICE"};
    if(!d.allowUser(uid)) return {status:403,code:"TEST_CUSTOMER_NOT_AUTHORIZED"};
    try {
      const token=await d.findOwnedActiveDevice(uid,installationId);
      if(!token) return {status:404,code:"TEST_DEVICE_NOT_REGISTERED"};
      if(!await d.claimQuota(uid)) return {status:429,code:"TEST_PUSH_COOLDOWN"};
      await d.send(token,randomUUID());
      return {status:202,code:"FCM_ACCEPTED_NOT_DEVICE_DELIVERED"};
    } catch {
      // No provider message ID, token, UID or order details in the response/log.
      return {status:503,code:"TEST_FCM_UNAVAILABLE"};
    }
  };
}
export function customerPushTestEnabled(env:NodeJS.ProcessEnv=process.env):boolean {
  // A generic Vercel Preview might share Production resources; require an
  // independently provisioned staging Supabase hostname and explicit switches.
  if(env.CUSTOMER_PUSH_TEST_ENABLED!=="true" ||
     env.CUSTOMER_PUSH_TEST_ISOLATED!=="true" ||
     env.VERCEL_ENV!=="preview" ||
     env.PICKUP_WRITES_ENABLED==="true") return false;
  const expected=env.CUSTOMER_PUSH_TEST_STAGING_SUPABASE_HOST;
  const url=env.SUPABASE_URL;
  if(!expected || !url) return false;
  try {
    const parsed=new URL(url);
    return parsed.protocol==="https:" && parsed.hostname===expected &&
      expected.endsWith(".supabase.co");
  } catch {return false;}
}
export function customerPushTestAllowUser(uid:string,env:NodeJS.ProcessEnv=process.env):boolean {
  // Explicit staging Firebase test account allowlist; never all signed-in users.
  return !!uid && (env.CUSTOMER_PUSH_TEST_UIDS||"").split(",").map(x=>x.trim()).filter(Boolean).includes(uid);
}
export async function sendCustomerTestPushToFirebase(token:string,testId:string):Promise<void> {
  if(!getApps().length)throw Error("FIREBASE_ADMIN_NOT_CONFIGURED");
  await getMessaging().send({
    token,
    data:{type:"customer_push_test",test_id:testId},
    webpush:{headers:{TTL:"120",Urgency:"high"}}
  });
}
