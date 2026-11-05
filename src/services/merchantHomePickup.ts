// Home is scoped to the API-verified shop and persisted pickup fulfillment.
// Historical delivery records remain accessible through order history.
export function pickupHomeOrders<T extends {shop_id?:unknown;delivery_type?:string}>(orders:T[],shopId:unknown):T[]{
 if(shopId==null || String(shopId)==='')return [];
 return orders.filter(order=>order.delivery_type==='collection' && String(order.shop_id)===String(shopId));
}
export function pickupReadyCount(orders:{status?:string;pickup_status?:string}[]):number {
 return orders.filter(order=>['ready','ready_for_pickup'].includes(order.pickup_status ?? order.status ?? '')).length;
}
const businessDate=new Intl.DateTimeFormat('en-ZA',{timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'});
export function pickupDayKey(value:string|number|Date):string|null {
 const date=new Date(value instanceof Date ? value.getTime() : value);
 if(!Number.isFinite(date.getTime()))return null;
 const parts=businessDate.formatToParts(date),part=(type:string)=>parts.find(item=>item.type===type)?.value;
 return `${part('year')}-${part('month')}-${part('day')}`;
}
export function pickupCsvCell(value:unknown):string {
 const text=String(value ?? '');
 const safe=/^\s*[=+\-@]/.test(text) ? "'"+text : text;
 return '"'+safe.replaceAll('"','""')+'"';
}
export function pickupReportCsv(orders:{id:unknown;product_name?:unknown;total_price?:unknown;status?:unknown;pickup_status?:unknown;payment_status?:unknown;created_at?:unknown}[]):string {
 const rows:unknown[][]=[['Order ID','Product','Order total','Pickup status','Payment status','Created at'],
  ...orders.map(order=>[order.id,order.product_name,order.total_price,order.pickup_status ?? order.status,order.payment_status,order.created_at])];
 return rows.map(row=>row.map(pickupCsvCell).join(',')).join('\r\n');
}
