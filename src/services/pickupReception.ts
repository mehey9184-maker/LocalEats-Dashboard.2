import {auth} from '../lib/firebase';
import {getApiAuthHeaders} from '../lib/apiAuth';
import {pickupMutationsDisabled} from './merchantPickupPolicy';
export type Reception={shop_id:string;paused:boolean;revision:number;reminders?:number};
export async function pickupReception(shop:string,resumeRevision?:number,signal?:AbortSignal):Promise<Reception|null>{
 if(import.meta.env.VITE_PICKUP_ACCEPTANCE_ENABLED!=='true')return null;
 const uid=auth.currentUser?.uid;if(!uid)throw Error('Sign in to verify shop reception.');
 if(resumeRevision!==undefined)pickupMutationsDisabled();
 const base=import.meta.env.VITE_LOCALEATS_API_URL;if(!base)throw Error('Shop service is unavailable.');
 const headers=await getApiAuthHeaders();
 if(auth.currentUser?.uid!==uid)throw Error('Account changed. Refresh reception status.');
 const response=await fetch(`${base}/api/v1/merchant/${resumeRevision===undefined?`shops/${encodeURIComponent(shop)}/reception`:'shop/reception/resume'}`,{
  method:resumeRevision===undefined?'GET':'POST',headers,signal,
  ...(resumeRevision===undefined?{}:{body:JSON.stringify({shop_id:shop,expected_revision:resumeRevision})})});
 const data=await response.json();
 if(auth.currentUser?.uid!==uid)throw Error('Account changed. Refresh reception status.');
 if(!response.ok||data.success!==true)throw Error('Reception status was not confirmed. Refresh before retrying.');
 if(data.enabled===false)return null;
 const status=data.reception;
 if(status?.shop_id!==shop||typeof status.paused!=='boolean'||!Number.isSafeInteger(status.revision)||status.revision<0)throw Error('Reception status is unavailable.');
 return {...status,reminders:Array.isArray(data.notices)?data.notices.filter((n:{shop_id?:string;kind?:string})=>n.shop_id===shop&&n.kind==='merchant_reminder').length:0};
}
