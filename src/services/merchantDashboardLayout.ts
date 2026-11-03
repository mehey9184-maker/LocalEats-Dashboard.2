import type {Order,MenuItem} from "../types";

type QueueOrder=Pick<Order,"status"|"pickup_status"|"delivery_type"|"order_type"|"created_at">;
export type KitchenQueue={pending:number;preparing:number;readyForPickup:number;completed:number};

export function summarizeKitchenQueue(orders:readonly QueueOrder[]):KitchenQueue{
  const summary:KitchenQueue={pending:0,preparing:0,readyForPickup:0,completed:0};
  for(const order of orders){
    if(order.status==="pending")summary.pending+=1;
    if(order.status==="preparing")summary.preparing+=1;
    if(order.status==="completed")summary.completed+=1;
    // "Ready" for delivery must never be advertised as "Ready for Pickup".
    const isPickup=order.delivery_type==="collection" ||
      order.order_type==="collection" || order.order_type==="pickup";
    if(isPickup && order.status!=="completed" && order.status!=="cancelled" &&
      (order.pickup_status==="ready_for_pickup" || order.status==="ready"))summary.readyForPickup+=1;
  }
  return summary;
}

export function recentKitchenOrders<T extends Pick<Order,"created_at">>(
  orders:readonly T[],limit=5,
):T[]{
  if(limit<=0)return [];
  return [...orders].sort((a,b)=>{
    const aTime=Date.parse(a.created_at ?? "");
    const bTime=Date.parse(b.created_at ?? "");
    const aValid=Number.isFinite(aTime)?aTime:-Infinity;
    const bValid=Number.isFinite(bTime)?bTime:-Infinity;
    return bValid-aValid;
  }).slice(0,limit);
}
export function lowStockMenuItems<T extends Pick<MenuItem,"is_available"|"stock_quantity">>(
  items:readonly T[],
):T[]{
  return items.filter(item=>
    item.is_available===true &&
    typeof item.stock_quantity==="number" &&
    Number.isFinite(item.stock_quantity) &&
    item.stock_quantity>=0 && item.stock_quantity<5
  );
}
