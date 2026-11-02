// Detect arrivals only from a successfully fetched, Firebase-authorized
// merchant API snapshot. An existing pending order on initial hydration is
// not "new", and order counts must not determine the alert.
export type MerchantAlertOrder = {id:string|number;status?:string;shop_id?:string|number};
export type MerchantAlertCursor = {scope:string;seenIds:Set<string>};
export function merchantOrderArrivals(
 orders:readonly MerchantAlertOrder[],
 scope:string,
 previous:MerchantAlertCursor|null,
):{cursor:MerchantAlertCursor;newPendingIds:string[]} {
 const owned=orders.filter(order=>String(order.shop_id??"")===scope.split(":").slice(1).join(":"));
 const seenIds=new Set(previous?.scope===scope ? previous.seenIds : []);
 const fresh=previous?.scope===scope
  ? owned.filter(order=>String(order.status).toLowerCase()==="pending" &&
      !seenIds.has(String(order.id))).map(order=>String(order.id))
  : [];
 for(const order of owned)seenIds.add(String(order.id));
 return {cursor:{scope,seenIds},newPendingIds:fresh};
}
