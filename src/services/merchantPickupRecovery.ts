type Order=Record<string,unknown>;
type Command={path:string;body:{command_id:string;expected_revision:number;[key:string]:unknown}};
type Options={identity:()=>string|undefined;enabled:()=>boolean;storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>;
 transport:(order:Order,command:Command,signal:AbortSignal,uid:string)=>Promise<{status:number;data:Record<string,unknown>}>;
 mapOrder:(order:unknown)=>Order;timeoutMs?:number};
const kinds:Record<string,string>={accept:'accepted',ready:'ready',reject:'merchant_rejected','payment-confirmation':'payment_confirmed',collect:'collected'};
// Only fresh, explicit contract refusals can resolve a never-previously-uncertain action.
const terminalCodes:Record<number,ReadonlySet<string>>={400:new Set(["INVALID_REQUEST","INVALID_COMMAND","INVALID_PAYMENT_METHOD","INVALID_CANCELLATION","HANDOVER_CONFIRMATION_REQUIRED"]),403:new Set(["FORBIDDEN"]),404:new Set(["ORDER_NOT_FOUND"]),409:new Set(["ORDER_STATE_CHANGED","INVALID_ORDER_TRANSITION"])};
function definitiveRefusal(status:number,data:Record<string,unknown>):boolean{
 return data?.success===false && typeof data.code==="string" && typeof data.error==="string" && !!terminalCodes[status]?.has(data.code);
}
const states:Record<string,string[]>={accept:['preparing','ready_for_pickup','collected'],ready:['ready_for_pickup','collected'],reject:['cancelled'],'payment-confirmation':['ready_for_pickup','collected'],collect:['collected']};
function validCommand(value:unknown):value is Command {
 if(!value || typeof value!=="object" || Array.isArray(value))return false;
 const candidate=value as Record<string,unknown>;
 const path=candidate.path,body=candidate.body;
 if(typeof path!=="string" || !Object.hasOwn(kinds,path) ||
    !body || typeof body!=="object" || Array.isArray(body))return false;
 const fields=body as Record<string,unknown>;
 if(typeof fields.command_id!=="string" ||
   !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(fields.command_id) ||
   typeof fields.expected_revision!=="number" || !Number.isSafeInteger(fields.expected_revision) ||
   fields.expected_revision<0 || fields.expected_revision>=Number.MAX_SAFE_INTEGER)return false;
 const extra=path==='reject' ? 'reason' : path==='collect' ? 'handover_confirmed' : path==='payment-confirmation' ? 'payment_method' : null;
 if(Object.keys(candidate).some(key=>!['path','body'].includes(key)) ||
  Object.keys(fields).some(key=>!['command_id','expected_revision',extra].includes(key)))return false;
 return path==='reject' ? typeof fields.reason==='string' && !!fields.reason.trim() && fields.reason.length<=500 :
  path==='collect' ? fields.handover_confirmed===true :
  path==='payment-confirmation' ? ['cash','card_machine'].includes(String(fields.payment_method)) : true;
}
export function createMerchantPickupRecovery(options:Options){
 const running=new Map<string,Promise<Order>>();
 const pendingPath=(order:Order):string|null=>{
  const uid=options.identity();
  if(!uid || !order?.id || order.delivery_type!=='collection')return null;
  let saved:string|null;
  try{saved=options.storage.getItem(`pickup-command:${uid}:${order.id}`);}catch{return null;}
  if(!saved)return null;
  try{
   const command:unknown=JSON.parse(saved);
   return validCommand(command) ? command.path : 'unknown';
  }catch{return 'unknown';}
 };
 const run=async(order:Order,command?:Command):Promise<Order>=>{
  if(!options.enabled())throw Error('Pickup actions are not enabled. No change was saved.');
  const uid=options.identity();if(!uid || !order.id || !order.shop_id || order.delivery_type!=='collection')throw Error('Sign in to the merchant account for this pickup.');
  const key=`pickup-command:${uid}:${order.id}`;
  const active=running.get(key);if(active)return active;
  let saved:string|null;
  try{saved=options.storage.getItem(key);}catch{throw Error('Safe retry storage is unavailable. Enable session storage before changing a pickup.');}
  if(command && saved)throw Error('Use Retry previous action before sending another command.');
  let pending:unknown=command;
  if(!command){if(!saved)throw Error('No unresolved command exists.');try{pending=JSON.parse(saved);}catch{throw Error('The saved action needs recovery. Refresh before retrying.');}}
  if(!validCommand(pending))throw Error(command ? 'Check the action, order revision and rejection reason (maximum 500 characters).' : 'The saved action needs recovery. Refresh before retrying.');
  const serialized=JSON.stringify(pending),exact=JSON.parse(serialized) as Command;
  try{options.storage.setItem(key,serialized);}catch{throw Error('Safe retry storage is unavailable. Enable session storage before changing a pickup.');}
  const request=(async()=>{
   let timer:ReturnType<typeof setTimeout>|undefined;const controller=new AbortController();
   const unchanged=()=>{try{return options.identity()===uid && options.storage.getItem(key)===serialized;}catch{return false;}};
   try{
    const deadline=new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('The response took too long. The outcome is unconfirmed. Retry previous action.'));},options.timeoutMs??15000);});
    const {status,data}=await Promise.race([options.transport(order,exact,controller.signal,uid),deadline]);
    if(!unchanged())throw Error('Your session or pending action changed. Refresh before retrying.');
    if(status<200 || status>=300 || data?.success!==true){
     // A later refusal cannot prove an earlier uncertain command never committed.
     if(!saved && definitiveRefusal(status,data))options.storage.removeItem(key);
     throw Error(typeof data?.error==='string' ? data.error : 'The API did not confirm persistence. Retry previous action.');
    }
    if(!data.order || typeof data.order!=='object' || Array.isArray(data.order))throw Error('The API did not confirm persistence. Retry previous action.');
    const confirmed=options.mapOrder(data.order),revision=exact.body.expected_revision+1;
    const receipt=data.command_receipt && typeof data.command_receipt==='object' && !Array.isArray(data.command_receipt)
     ? data.command_receipt as Record<string,unknown> : null;
    const state=confirmed.pickup_status ?? confirmed.status;
    const confirmedRevision=confirmed.revision;
    if(confirmed.id!==order.id || String(confirmed.shop_id)!==String(order.shop_id) ||
     !receipt || receipt.command_id!==exact.body.command_id || receipt.order_id!==order.id || receipt.actor_uid!==uid ||
     receipt.kind!==kinds[exact.path] || receipt.revision!==revision ||
     typeof confirmedRevision!=='number' || !Number.isSafeInteger(confirmedRevision) || confirmedRevision<revision ||
     typeof state!=='string' || !states[exact.path].includes(state) ||
     (confirmedRevision>revision && data.replayed!==true) ||
     (exact.path==='payment-confirmation' && (confirmed.payment_status!=='paid' || confirmed.payment_method!==exact.body.payment_method)) ||
     (confirmedRevision===revision && exact.path==='ready' && confirmed.payment_status!=='unpaid') ||
     (confirmedRevision===revision && state!==states[exact.path][0]))
     throw Error('The API did not confirm this action. Retry previous action or refresh.');
    if(!unchanged())throw Error('Your session or pending action changed. Refresh before retrying.');
    options.storage.removeItem(key);return confirmed;
   }finally{clearTimeout(timer);}
  })().finally(()=>running.delete(key));
  running.set(key,request);return request;
 };
 return {send:(order:Order,command:Command)=>run(order,command),retry:(order:Order)=>run(order),pendingPath};
}
