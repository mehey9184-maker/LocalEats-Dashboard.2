import { getApps } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { pickupRpc, type RpcClient } from "./pickupService.js";

export interface PushJob {id:string;attempts:number;lease_until:string;event_id:string;order_id:string;token:string;}
export type PushSender = (job:PushJob)=>Promise<void>;

const sendFcm:PushSender=async job=>{
  await getMessaging().send({token:job.token,data:{type:"pickup_ready",event_id:job.event_id,order_id:job.order_id},
    android:{ttl:60_000},webpush:{headers:{TTL:"60"}}});
};

// HTTP responses must not depend on a push provider staying responsive.
// The SQL outbox still owns delivery attempts, fencing and exponential retries.
export const PICKUP_PUSH_REQUEST_BUDGET_MS=4_000;
class PushDeadlineExceeded extends Error {}

async function beforeDeadline<T>(deadline:number,work:()=>Promise<T>):Promise<T> {
  const remaining=deadline-Date.now();
  if (remaining<=0) throw new PushDeadlineExceeded();
  let timer:ReturnType<typeof setTimeout>|undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(work),
      new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new PushDeadlineExceeded()),remaining);})
    ]);
  } finally {
    if(timer!==undefined) clearTimeout(timer);
  }
}

/**
 * Makes at most one outbox attempt for this authenticated account or merchant.
 *
 * A provider/DB stall cannot indefinitely hold a Ready receipt or notification
 * inbox response. A timed-out claim/send/finish is UNKNOWN, never reported as
 * delivered: its fenced outbox lease may expire and become retryable.
 *
 * An FCM send cannot be cancelled by Promise.race. It might finish after the
 * request deadline; later outbox retries can therefore duplicate a push.
 * Notifications are best-effort hints, not exactly-once order receipts.
 * Order persistence and the authoritative merchant/customer inbox are primary.
 *
 * Caller-supplied budget is for isolated tests only; Production never exceeds
 * the 4s maximum. No detached fire-and-forget work or retry loop is started.
 */
export async function drainPickupPush(
  client:RpcClient,uid:string,sender?:PushSender,maxWaitMs=PICKUP_PUSH_REQUEST_BUDGET_MS
):Promise<void> {
  if (!uid || (!sender && !getApps().length)) return;
  const budget=Number.isFinite(maxWaitMs)
    ? Math.max(50,Math.min(PICKUP_PUSH_REQUEST_BUDGET_MS,Math.floor(maxWaitMs)))
    : PICKUP_PUSH_REQUEST_BUDGET_MS;
  const started=Date.now(), finishDeadline=started+budget;
  // Reserve time to persist success/transient/permanent failure while the lease
  // is still held. If the reservation expires, do not invent a completion.
  const workDeadline=finishDeadline-Math.min(750,Math.floor(budget/4));
  try {
    const job=await beforeDeadline(workDeadline,()=>pickupRpc(client,"pickup_claim_push",{p_uid:uid})) as PushJob|null;
    if (!job || !job.id || !job.token || !Number.isInteger(job.attempts) || !job.lease_until) return;
    const args={p_uid:uid,p_job:job.id,p_attempt:job.attempts,p_lease:job.lease_until};
    const sendable=await beforeDeadline(workDeadline,()=>pickupRpc(client,"pickup_push_sendable",{...args,p_token:job.token}));
    if (sendable!==true) {
      await beforeDeadline(finishDeadline,()=>pickupRpc(client,"pickup_finish_push",
        {...args,p_sent:false,p_permanent:true}));
      return;
    }
    let sent=false,permanent=false;
    try {
      await beforeDeadline(workDeadline,()=>(sender ?? sendFcm)(job));
      sent=true;
    } catch (error) {
      // The SDK may still send after a deadline. Leave the lease in place and
      // let the outbox's retry policy reconcile; never claim delivered/failed.
      if (error instanceof PushDeadlineExceeded) return;
      const code=(error as {code?:string})?.code;
      permanent=code==="messaging/registration-token-not-registered"
        || code==="messaging/invalid-registration-token";
    }
    await beforeDeadline(finishDeadline,()=>pickupRpc(client,"pickup_finish_push",
      {...args,p_sent:sent,p_permanent:permanent}));
  } catch {
    // Best effort only: timed-out or failed provider/DB must not roll back a
    // committed Ready state, fabricate delivery, or suppress the order inbox.
    // Do not log FCM tokens or customer personal data.
  }
}
