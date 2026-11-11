/**
 * Advisory only: detect a Ready pickup that has awaited counter payment.
 * Never auto-charge, auto-cancel, change the authoritative order status, or
 * infer money from elapsed time.
 */
export function pickupUnpaidWaitingMinutes(order:{
  status?:unknown;pickup_status?:unknown;payment_status?:unknown;updated_at?:unknown;
},now:number=Date.now()):number|null {
  const status=order.pickup_status ?? order.status;
  if(!["ready","ready_for_pickup"].includes(String(status)) || order.payment_status!=="unpaid")return null;
  if(typeof order.updated_at!=="string" && typeof order.updated_at!=="number")return null;
  const timestamp=typeof order.updated_at==="number" ? order.updated_at : Date.parse(order.updated_at);
  if(!Number.isFinite(timestamp)||!Number.isFinite(now)||timestamp>now+60_000)return null;
  return Math.max(0,Math.floor((now-timestamp)/60_000));
}
export function pickupNeedsUncollectedAttention(order:{
  status?:unknown;pickup_status?:unknown;payment_status?:unknown;updated_at?:unknown;
},now:number=Date.now()):boolean {
  const minutes=pickupUnpaidWaitingMinutes(order,now);
  return minutes!==null && minutes>=30;
}
