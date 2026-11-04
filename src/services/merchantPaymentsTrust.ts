/** The Payments page has no authoritative billing/settlement read or write API.
 * Only show pickup payment fields carried by a confirmed, shop-scoped Orders read.
 * These are order records, never bank settlement, revenue or reconciled cash.
 */
export type MerchantPaymentReadState="checking"|"confirmed"|"unavailable";
export type MerchantPickupPaymentRecord={
  id?:unknown;shop_id?:unknown;delivery_type?:unknown;payment_method?:unknown;
  payment_status?:unknown;total_price?:unknown;customer_name?:unknown;
  created_at?:unknown;
};
export function verifiedShopPickupPaymentRecords(
  rows:readonly MerchantPickupPaymentRecord[],
  shopId:string|number|null|undefined,
  readState:MerchantPaymentReadState,
):MerchantPickupPaymentRecord[]|null {
  if(readState!=="confirmed" || shopId===null || shopId===undefined || String(shopId)==="")return null;
  const result=new Map<string,MerchantPickupPaymentRecord>();
  for(const order of rows){
    if(!order || typeof order.id!=="string" || !order.id.trim() ||
       order.shop_id===null || order.shop_id===undefined ||
       String(order.shop_id)!==String(shopId) ||
       order.delivery_type!=="collection")continue;
    if(!result.has(order.id))result.set(order.id,order);
  }
  return [...result.values()];
}
export function pickupPaymentAmount(value:unknown):string {
  return typeof value==="number" && Number.isFinite(value) && value>=0 &&
    Number.isSafeInteger(Math.round(value*100)) ? `R ${value.toFixed(2)}` : "Amount unavailable";
}
export function pickupPaymentMethod(value:unknown):string {
  if(value==="cash")return "Cash at shop";
  if(value==="card_machine")return "Physical card machine at shop";
  return "Payment method unavailable";
}
export function pickupPaymentRecordStatus(value:unknown):string {
  if(value==="paid")return "Recorded paid in Orders";
  if(value==="unpaid")return "Payment not confirmed";
  return "Payment status unavailable";
}
export function merchantPaymentWritesUnavailable():boolean {return true;}
