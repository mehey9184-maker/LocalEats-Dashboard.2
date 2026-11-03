import type {Order} from "../types";

// Merchant order totals are informational, not proof of payment or a payout.
// Use only completed orders with finite nonnegative catalog totals.
export function completedOrderValue(order:Pick<Order,"status"|"total_price">):number|null{
  if(order.status!=="completed")return null;
  const amount=Number(order.total_price);
  return Number.isFinite(amount) && amount>=0 ? amount : null;
}
export function completedOrderTotal(orders:readonly Pick<Order,"status"|"total_price">[]):number{
  return orders.reduce((sum,order)=>sum+(completedOrderValue(order)??0),0);
}
export function completedDeliveryArea(
  order:Pick<Order,"status"|"total_price"|"order_type"|"delivery_type"|"city">,
):{city:string;value:number}|null{
  const value=completedOrderValue(order);
  if(value===null || (order.order_type!=="delivery" && order.delivery_type!=="delivery"))return null;
  const city=typeof order.city==="string" ? order.city.trim() : "";
  return city ? {city,value} : null;
}
