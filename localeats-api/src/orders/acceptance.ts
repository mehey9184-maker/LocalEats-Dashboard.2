import {OrderContractError} from './orderContract.js';
import {assertPickupWritesDisabled} from '../middleware/pickupWriteGate.js';
import {pickupRpc,type RpcClient} from './pickupService.js';
export const acceptanceEnabled=()=>process.env.PICKUP_ACCEPTANCE_ENABLED==='true';
const fail=(status:number,code:string):never=>{throw new OrderContractError(status,code,code);};
export async function readAcceptanceInbox(client:RpcClient,uid:string){
 if(!uid?.trim())return fail(401,'UNAUTHORIZED');
 if(!acceptanceEnabled())return {enabled:false,notices:[]};
 const data=await pickupRpc(client,'pickup_acceptance_inbox',{p_uid:uid});
 if(!Array.isArray(data))return fail(503,'ACCEPTANCE_UNAVAILABLE');
 return {enabled:true,notices:data};
}
export async function readReception(client:RpcClient,uid:string,shop:string){
 if(!uid?.trim())return fail(401,'UNAUTHORIZED');
 if(!acceptanceEnabled())return {enabled:false};
 const reception=await pickupRpc(client,'pickup_reception_status',{p_uid:uid,p_shop:shop});
 const inbox=await readAcceptanceInbox(client,uid);
 return {enabled:true,reception,notices:inbox.notices.filter(n=>n?.shop_id===shop)};
}
export async function resumeReception(client:RpcClient,uid:string,input:unknown){
 if(!uid?.trim())return fail(401,'UNAUTHORIZED');
 if(!acceptanceEnabled())return fail(503,'ACCEPTANCE_DISABLED');
 assertPickupWritesDisabled({delivery_type:'collection'});
 if(!input||typeof input!=='object'||Array.isArray(input))return fail(400,'INVALID_REQUEST');
 const body=input as Record<string,unknown>;
 if(Object.keys(body).some(k=>!['shop_id','expected_revision'].includes(k))||typeof body.shop_id!=='string'||!body.shop_id.trim()
  ||!Number.isSafeInteger(body.expected_revision)||Number(body.expected_revision)<0)return fail(400,'INVALID_REQUEST');
 const data=await pickupRpc(client,'pickup_resume_reception',{p_uid:uid,p_shop:body.shop_id,p_revision:body.expected_revision});
 if(!data||typeof data!=='object'||Array.isArray(data))return fail(503,'RECEPTION_UNCONFIRMED');
 const reception=data as Record<string,unknown>;
 if(reception.shop_id!==body.shop_id||reception.paused!==false||!Number.isSafeInteger(reception.revision))return fail(503,'RECEPTION_UNCONFIRMED');
 return {shop_id:reception.shop_id,paused:false,revision:reception.revision};
}
