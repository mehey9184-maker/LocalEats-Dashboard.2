export type MerchantOrderReadState="checking"|"confirmed"|"unavailable";

/** Never scope privileged order results to a cached or unverified shop. */
export function merchantOrderReadScope(uid:string|null|undefined,shopId:string|number|null|undefined,gate:string):string|null{
 if(!uid || shopId===null || shopId===undefined || String(shopId).trim()==="" || gate!=="ready")return null;
 return JSON.stringify([uid,String(shopId)]);
}

/** Background tabs do not need a continuous 15-second order poll. */
export function shouldPollMerchantOrders(visibility:string,scope:string|null):boolean{
 return scope!==null && visibility==="visible";
}

/** Preserve unknown totals as unknown, instead of fabricating R0. */
export function merchantDisplayOrderAmount(raw:unknown):number{
 if(typeof raw!=="number" && (typeof raw!=="string" || raw.trim()===""))return NaN;
 const number=Number(raw);
 return Number.isFinite(number) && number>=0 ? number : NaN;
}
