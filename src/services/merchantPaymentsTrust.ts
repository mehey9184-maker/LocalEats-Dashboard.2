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

/** These are local presentation-only filters, not payment or cash settlement changes. */
export type MerchantPaymentStatusFilter="all"|"paid"|"unpaid"|"unknown";
export const MERCHANT_PAYMENT_BATCH_SIZE=24;

export function merchantPaymentRecordTimestamp(value:unknown):number|null {
 if(typeof value!=="string")return null;
 const raw=value.trim();
 // Don't guess the timezone of an API timestamp when none was supplied.
 const match=/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/i.exec(raw);
 if(!match)return null;
 const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
 const hour=Number(match[4]),minute=Number(match[5]),second=Number(match[6]??0);
 const zone=match[7];
 if(year<1||year>9999||month<1||month>12||day<1||
   day>new Date(Date.UTC(year,month,0)).getUTCDate()||
   hour>23||minute>59||second>59)return null;
 if(zone.toUpperCase()!=="Z"){
   const offsetHour=Number(zone.slice(1,3)),offsetMin=Number(zone.slice(4,6));
   if(offsetHour>14||offsetMin>59||(offsetHour===14&&offsetMin!==0))return null;
 }
 const result=Date.parse(raw.replace(" ","T"));
 return Number.isFinite(result)?result:null;
}
export function merchantPaymentDateLabel(value:unknown):string {
 const time=merchantPaymentRecordTimestamp(value);
 if(time===null)return "Order date unavailable";
 return new Intl.DateTimeFormat("en-ZA",{
   timeZone:"Africa/Johannesburg",day:"2-digit",month:"short",year:"numeric",
   hour:"2-digit",minute:"2-digit",hour12:false,
 }).format(new Date(time));
}
export function merchantPaymentFilteredRecords(
 rows:readonly MerchantPickupPaymentRecord[],search:string,status:MerchantPaymentStatusFilter,
):MerchantPickupPaymentRecord[] {
 const query=search.trim().toLocaleLowerCase("en-ZA");
 return rows
  .map((row,index)=>({row,index,date:merchantPaymentRecordTimestamp(row.created_at)}))
  .filter(({row})=>{
   const value=row.payment_status;
   const statusMatch=status==="all"||
     (status==="unknown"?value!=="paid"&&value!=="unpaid":value===status);
   if(!statusMatch)return false;
   if(!query)return true;
   const id=typeof row.id==="string"?row.id:"";
   const name=typeof row.customer_name==="string"?row.customer_name:"";
   return id.toLocaleLowerCase("en-ZA").includes(query)||
     name.toLocaleLowerCase("en-ZA").includes(query);
  })
  .sort((a,b)=>{
   if(a.date===null&&b.date===null)return a.index-b.index;
   if(a.date===null)return 1;
   if(b.date===null)return -1;
   return (b.date-a.date)||(a.index-b.index);
  })
  .map(({row})=>row);
}
export function merchantPaymentNextVisibleCount(current:number,total:number):number {
 const shown=Number.isSafeInteger(current)&&current>0?current:0;
 const max=Number.isSafeInteger(total)&&total>0?total:0;
 return Math.min(max,shown+MERCHANT_PAYMENT_BATCH_SIZE);
}
