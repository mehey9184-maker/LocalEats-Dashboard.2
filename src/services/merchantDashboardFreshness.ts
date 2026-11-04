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

/** First successful hydration is the baseline, not a new-order event. */
export function newMerchantPendingOrders(
  rows:readonly {id:string|number;status:string}[],
  previous:ReadonlySet<string>|null,
):{current:Set<string>;newIds:string[]}{
  const current=new Set(rows.filter(row=>row.status==="pending" && row.id!==null &&
    row.id!==undefined && String(row.id).trim()!=="").map(row=>String(row.id)));
  return {current,newIds:previous===null?[]:[...current].filter(id=>!previous.has(id))};
}

/** A payment or handover action requires a recent, API-verified order list.
 * A failed, missing, or older-than-90s read must never authorize a pickup action.
 */
export function merchantPickupReadCurrent(
  state:MerchantOrderReadState,
  verifiedAt:number|null|undefined,
  now:number=Date.now()
):boolean{
  return state==="confirmed" && typeof verifiedAt==="number" &&
    Number.isFinite(verifiedAt) && Number.isFinite(now) &&
    verifiedAt<=now && now-verifiedAt<=90000;
}
