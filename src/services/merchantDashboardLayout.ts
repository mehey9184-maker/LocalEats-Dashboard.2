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


/** South African merchant reporting uses one SAST calendar day, not UTC strings. */
export function merchantJohannesburgDayKey(value:Date|string|number|null|undefined):string|null{
  if(value===null || value===undefined || value==="")return null;
  const date=value instanceof Date?value:new Date(value);
  if(!Number.isFinite(date.getTime()))return null;
  const parts=new Intl.DateTimeFormat("en-GB",{
    timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit",day:"2-digit",
  }).formatToParts(date);
  const year=parts.find(part=>part.type==="year")?.value;
  const month=parts.find(part=>part.type==="month")?.value;
  const day=parts.find(part=>part.type==="day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : null;
}

export function merchantDailyOrderCounts(
  orders:readonly Pick<Order,"created_at">[],now:Date=new Date(),
):{today:number;yesterday:number}{
  const todayKey=merchantJohannesburgDayKey(now);
  const yesterdayKey=merchantJohannesburgDayKey(new Date(now.getTime()-86400000));
  let today=0;
  let yesterday=0;
  for(const order of orders){
    const key=merchantJohannesburgDayKey(order.created_at);
    if(key===null)continue;
    if(key===todayKey)today++;
    else if(key===yesterdayKey)yesterday++;
  }
  return {today,yesterday};
}
