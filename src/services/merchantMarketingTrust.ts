export type VerifiedMarketingStats = {
  totalOrders:number;
  uniqueDiners:number|null;
  repeatDiners:number|null;
  repeatRate:number|null;
  averageOrderValue:number|null;
};

/** Marketing is not a go-live signal. Launch/publishing needs a separate
 * approved workflow and verified customer-facing checkout, so stay locked. */
export function merchantMarketingPublishingEnabled():boolean {return false;}

type MarketingOrder = {
  shop_id?:unknown;
  user_id?:unknown;
  total_price?:unknown;
};

/** Read-only order metrics; never invent customers from names, phone numbers,
 * cached data or percentage-based guesses. Null means unverified/unknown. */
export function verifiedMarketingStats(
  rows:readonly MarketingOrder[],
  shopId:string|number|null|undefined,
  ordersReadState:"checking"|"confirmed"|"unavailable"
):VerifiedMarketingStats|null {
  if(ordersReadState!=="confirmed" || shopId===null || shopId===undefined || String(shopId)==="")return null;
  const shopOrders=rows.filter(row=>row && String(row.shop_id)===String(shopId));
  const counts=new Map<string,number>();
  let identityIncomplete=false;
  let amountIncomplete=false;
  let amountTotal=0;
  for(const order of shopOrders) {
    if(typeof order.user_id!=="string" || !order.user_id.trim()){
      identityIncomplete=true;
    } else {
      const uid=order.user_id.trim();
      counts.set(uid,(counts.get(uid)||0)+1);
    }
    if(typeof order.total_price!=="number" || !Number.isFinite(order.total_price) || order.total_price<0){
      amountIncomplete=true;
    } else {
      amountTotal+=order.total_price;
    }
  }
  const uniqueDiners=identityIncomplete?null:counts.size;
  const repeatDiners=identityIncomplete?null:[...counts.values()].filter(count=>count>1).length;
  return {
    totalOrders:shopOrders.length,
    uniqueDiners,
    repeatDiners,
    repeatRate:uniqueDiners===null||repeatDiners===null?null:uniqueDiners?Math.round(100*repeatDiners/uniqueDiners):0,
    averageOrderValue:amountIncomplete?null:shopOrders.length?Math.round(100*amountTotal/shopOrders.length)/100:0,
  };
}
