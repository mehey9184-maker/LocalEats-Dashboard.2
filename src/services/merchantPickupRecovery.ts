type Order=Record<string,any>;
type Command={path:string;body:{command_id:string;expected_revision:number;[key:string]:unknown}};
type Options={identity:()=>string|undefined;enabled:()=>boolean;storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>;
 transport:(order:Order,command:Command,signal:AbortSignal,uid:string)=>Promise<{status:number;data:any}>;
 mapOrder:(order:any)=>Order;timeoutMs?:number};
const kinds:Record<string,string>={accept:'accepted',ready:'ready',reject:'merchant_rejected','payment-confirmation':'payment_confirmed',collect:'collected'};
const states:Record<string,string[]>={accept:['preparing','ready_for_pickup','collected'],ready:['ready_for_pickup','collected'],reject:['cancelled'],'payment-confirmation':['ready_for_pickup','collected'],collect:['collected']};
function validCommand(value:any):value is Command {
 if(!value || !Object.hasOwn(kinds,value.path) || !value.body || typeof value.body!=='object' || Array.isArray(value.body) ||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.body.command_id) ||
  !Number.isSafeInteger(value.body.expected_revision) || value.body.expected_revision<0 || value.body.expected_revision>=Number.MAX_SAFE_INTEGER)return false;
 const extra=value.path==='reject' ? 'reason' : value.path==='collect' ? 'handover_confirmed' : value.path==='payment-confirmation' ? 'payment_method' : null;
 if(Object.keys(value).some(key=>!['path','body'].includes(key)) || Object.keys(value.body).some(key=>!['command_id','expected_revision',extra].includes(key)))return false;
 return value.path==='reject' ? typeof value.body.reason==='string' && !!value.body.reason.trim() && value.body.reason.length<=500 :
  value.path==='collect' ? value.body.handover_confirmed===true : value.path==='payment-confirmation' ? ['cash','card_machine'].includes(value.body.payment_method) : true;
}
export function createMerchantPickupRecovery(options:Options){
 const running=new Map<string,Promise<Order>>();
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
     if([400,403,404,409,422].includes(status))options.storage.removeItem(key);
     throw Error(typeof data?.error==='string' ? data.error : 'The API did not confirm persistence. Retry previous action.');
    }
    if(!data.order || typeof data.order!=='object')throw Error('The API did not confirm persistence. Retry previous action.');
    const confirmed=options.mapOrder(data.order),receipt=data.command_receipt,revision=exact.body.expected_revision+1;
    const state=confirmed.pickup_status ?? confirmed.status;
    if(confirmed.id!==order.id || String(confirmed.shop_id)!==String(order.shop_id) ||
     !receipt || receipt.command_id!==exact.body.command_id || receipt.order_id!==order.id || receipt.actor_uid!==uid ||
     receipt.kind!==kinds[exact.path] || receipt.revision!==revision || confirmed.revision<revision ||
     !states[exact.path].includes(state) ||
     (confirmed.revision>revision && data.replayed!==true) ||
     (exact.path==='payment-confirmation' && (confirmed.payment_status!=='paid' || confirmed.payment_method!==exact.body.payment_method)) ||
     (confirmed.revision===revision && exact.path==='ready' && confirmed.payment_status!=='unpaid') ||
     (confirmed.revision===revision && state!==states[exact.path][0]))
     throw Error('The API did not confirm this action. Retry previous action or refresh.');
    if(!unchanged())throw Error('Your session or pending action changed. Refresh before retrying.');
    options.storage.removeItem(key);return confirmed;
   }catch(error){
    const status=error && typeof error==='object' && 'status' in error ? Number(error.status) : 0;
    if(unchanged() && [400,403,404,409,422].includes(status))options.storage.removeItem(key);
    throw error;
   }finally{clearTimeout(timer);}
  })().finally(()=>running.delete(key));
  running.set(key,request);return request;
 };
 return {send:(order:Order,command:Command)=>run(order,command),retry:(order:Order)=>run(order)};
}
