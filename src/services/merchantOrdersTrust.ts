import type {Order} from "../types";
import {safeOrderCsvCell} from "./merchantDashboardTrust.ts";

/** A missing total is never a free order; only finite nonnegative amounts can be displayed. */
export function merchantOrderTotal(raw:unknown):number|null{
 if(raw===null || raw===undefined || (typeof raw==="string" && raw.trim()===""))return null;
 if(typeof raw!=="string" && typeof raw!=="number")return null;
 const n=Number(raw);
 return Number.isFinite(n) && n>=0 ? n : null;
}
export function merchantOrderMoney(raw:unknown):string{
 const n=merchantOrderTotal(raw);
 return n===null?"Total unavailable":"R "+n.toFixed(2);
}
/** Line items are unavailable unless the unit price and quantity are valid. */
export function merchantReceiptLineAmount(price: unknown, quantity: unknown): string {
  const amount = merchantOrderTotal(price);
  if (amount === null || typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity <= 0) {
    return "Amount unavailable";
  }
  const total = amount * quantity;
  return Number.isFinite(total) && total >= 0 ? "R " + total.toFixed(2) : "Amount unavailable";
}
export function safeReceiptHtml(value:unknown):string{
 return String(value??"").replace(/[&<>"']/g,char=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;",
 }[char]||char));
}
export function safeOrderExportCsv(orders:readonly Pick<Order,
 "id"|"product_name"|"total_price"|"status"|"created_at"|"customer_name"|"address"|"city">[]):string{
 const columns=["Order ID","Product Name","Order Total (R)","Status","Date","Customer","Address"];
 const rows=orders.map(o=>{
  const date=new Date(o.created_at).getTime();
  return [o.id,o.product_name,merchantOrderTotal(o.total_price)??"Unavailable",
   o.status,Number.isFinite(date)?new Date(date).toISOString():"Unavailable",
   o.customer_name,[o.address,o.city].filter(Boolean).join(", ")].map(safeOrderCsvCell).join(",");
 });
 return [columns.map(safeOrderCsvCell).join(","),...rows].join("\r\n");
}
export function recordedDeliveryETA(value:unknown):string|null{
 if(typeof value!=="string")return null;
 const trimmed=value.trim();
 return trimmed.length>0&&trimmed.length<=60?trimmed:null;
}
