import {getApps} from 'firebase-admin/app';
import {getMessaging} from 'firebase-admin/messaging';
import {pickupRpc,type RpcClient} from './pickupService.js';
import {acceptanceEnabled} from './acceptance.js';
type Job={id:string;attempts:number;lease_until:string;token:string;order_id:string;kind?:string};
type Sender=(job:Job)=>Promise<void>;
const send:Sender=async job=>{
 const copy=job.kind==='customer_expired'?{title:'The shop didn’t accept in time',body:'Your request expired. Open LocalEats to find another shop.'}:
  job.kind==='merchant_paused'?{title:'New pickup orders paused',body:'Open your dashboard and resume when you can respond.'}:
  {title:'A pickup order is waiting',body:'Open your dashboard to respond before the five-minute deadline.'};
 await getMessaging().send({token:job.token,notification:copy,
  data:{type:'pickup_acceptance',order_id:job.order_id},webpush:{headers:{TTL:'300',Urgency:'high'}}});
};
/** Trusted worker adapter only. No HTTP endpoint, timer or automatic invocation. One bounded attempt per call. */
export async function drainAcceptancePush(client:RpcClient,sender?:Sender):Promise<void>{
 if(!acceptanceEnabled()||process.env.PICKUP_ACCEPTANCE_PUSH_ENABLED!=='true'||process.env.PICKUP_WRITES_ENABLED!=='true'||(!sender&&!getApps().length))return;
 try{
  const job=await pickupRpc(client,'pickup_claim_acceptance_push',{}) as Job|null;
  if(!job?.id||!job.token||!job.lease_until||!Number.isSafeInteger(job.attempts)||job.attempts<1||job.attempts>3)return;
  const args={p_job:job.id,p_attempt:job.attempts,p_lease:job.lease_until};
  if(await pickupRpc(client,'pickup_acceptance_push_sendable',{...args,p_token:job.token})!==true){
   await pickupRpc(client,'pickup_finish_acceptance_push',{...args,p_sent:false,p_permanent:true});return;
  }
  let sent=false,permanent=false;
  try{await (sender??send)(job);sent=true;}catch(error){
   const code=error&&typeof error==='object'&&'code' in error&&typeof error.code==='string'?error.code:null;
   permanent=code!==null&&['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(code);
  }
  await pickupRpc(client,'pickup_finish_acceptance_push',{...args,p_sent:sent,p_permanent:permanent});
 }catch{/* Durable inbox is authoritative. No tokens or provider messages are logged. */}
}
