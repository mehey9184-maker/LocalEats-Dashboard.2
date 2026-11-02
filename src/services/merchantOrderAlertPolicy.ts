// Detect arrivals only after a successfully fetched, authenticated Merchant
// API snapshot. Counts or locally cached orders never trigger "new order".
export type MerchantAlertOrder = {id:string|number;status?:string;shop_id?:string|number};
export type MerchantAlertCursor = {scope:string;seenIds:Set<string>};

export function merchantOrderArrivals(
 orders:readonly MerchantAlertOrder[],
 ownerId:string,
 shopId:string,
 previous:MerchantAlertCursor|null,
):{cursor:MerchantAlertCursor;newPendingIds:string[]} {
 const scope=ownerId+"::"+shopId;
 const owned=orders.filter(order=>String(order.shop_id??"")===shopId);
 const seenIds=new Set(previous?.scope===scope ? previous.seenIds : []);
 const newPendingIds=previous?.scope===scope
  ? owned.filter(order=>String(order.status??"").toLowerCase()==="pending" &&
      !seenIds.has(String(order.id))).map(order=>String(order.id))
  : [];
 for(const order of owned)seenIds.add(String(order.id));
 return {cursor:{scope,seenIds},newPendingIds};
}
