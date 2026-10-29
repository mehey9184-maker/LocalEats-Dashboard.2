import { getApps } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { pickupRpc, type RpcClient } from "./pickupService.js";

export interface PushJob {id:string;attempts:number;lease_until:string;event_id:string;order_id:string;token:string;}
export type PushSender = (job:PushJob)=>Promise<void>;
const sendFcm:PushSender=async job=>{
  await getMessaging().send({token:job.token,data:{type:"pickup_ready",event_id:job.event_id,order_id:job.order_id},
    android:{ttl:60_000},webpush:{headers:{TTL:"60"}}});
};
// Exactly one awaited attempt per relevant request, no timer, detached promise, cron or worker.
export async function drainPickupPush(client:RpcClient,uid:string,sender?:PushSender):Promise<void> {
  if (!uid || (!sender && !getApps().length)) return;
  try {
    const job=await pickupRpc(client,"pickup_claim_push",{p_uid:uid}) as PushJob|null;
    if (!job) return;
    if (!job.id || !job.token || !Number.isInteger(job.attempts) || !job.lease_until) return;
    const args={p_uid:uid,p_job:job.id,p_attempt:job.attempts,p_lease:job.lease_until};
    const sendable=await pickupRpc(client,"pickup_push_sendable",{...args,p_token:job.token});
    if (sendable!==true) {
      await pickupRpc(client,"pickup_finish_push",{...args,p_sent:false,p_permanent:true}); return;
    }
    let sent=false,permanent=false;
    try { await (sender ?? sendFcm)(job); sent=true; }
    catch(error) {
      const code=(error as {code?:string})?.code;
      permanent=code==="messaging/registration-token-not-registered" || code==="messaging/invalid-registration-token";
    }
    await pickupRpc(client,"pickup_finish_push",{...args,p_sent:sent,p_permanent:permanent});
  } catch { /* Provider/outbox failure never rolls back a committed Ready or hides the inbox. No tokens logged. */ }
}
