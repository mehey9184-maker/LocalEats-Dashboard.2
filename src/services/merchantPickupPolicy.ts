// Pickup and payment decisions are based on server-verified order fields.
// Unknown/untrusted API payloads are checked before a transition is permitted.
export type PickupAction="accept"|"ready"|"reject"|"confirm_payment"|"collect";
type Row=Record<string,unknown>;
const asRow=(value:unknown):Row|null=>
 value!==null&&typeof value==="object"&&!Array.isArray(value)?value as Row:null;

export const isPickupOrder=(order:unknown):boolean=>asRow(order)?.delivery_type==="collection";
export function requireOwnedShop<T extends {id?:unknown;owner_id?:unknown}>(shop:T|null|undefined,uid:string):T{
 if(!uid || !shop || shop.id==null || shop.owner_id!==uid)throw new Error("The API did not verify this shop against your Firebase identity.");
 return shop;
}
export function pickupState(order:unknown):string {
 const row=asRow(order);
 const status=row?.pickup_status ?? row?.status;
 if(!row || typeof status!=="string" || !isPickupOrder(row) || !["pending","preparing","ready_for_pickup","collected","cancelled"].includes(status) ||
  !["unpaid","paid"].includes(String(row.payment_status)) || !Number.isSafeInteger(row.revision) || Number(row.revision)<0 ||
  (row.payment_status==="paid" && !["ready_for_pickup","collected"].includes(status)) || (status==="collected" && row.payment_status!=="paid"))
  throw new Error("Pickup state is unavailable or the required schema is not installed. Refresh; no action was saved.");
 return status;
}
export function mapApiOrder(order:unknown):Row{
 const row=asRow(order);
 if(!row || typeof row.id!=="string" || row.shop_id==null)throw new Error("The API returned an invalid order.");
 if(!isPickupOrder(row))return row;
 const status=pickupState(row);
 if(typeof row.total_price!=="number" || !Number.isFinite(row.total_price) || row.total_price<0)throw new Error("The API returned an invalid pickup total.");
 if(!Array.isArray(row.items) || !row.items.length || row.items.length>50)
  throw new Error("Pickup item details are unavailable. Refresh before preparing the order.");
 const items=row.items.map((item:unknown)=>{
  const line=asRow(item);
  if(!line || typeof line.name!=="string" || !Number.isSafeInteger(line.quantity) || Number(line.quantity)<1 ||
   typeof line.unit_price!=="number" || !Number.isFinite(line.unit_price) || line.unit_price<0 ||
   typeof line.line_total!=="number" || !Number.isFinite(line.line_total) || line.line_total<0 ||
   Math.round(line.unit_price*100)*Number(line.quantity)!==Math.round(line.line_total*100) ||
   (line.notes!=null && (typeof line.notes!=="string" || line.notes.length>500)))
   throw new Error("Pickup item details are unavailable. Refresh before preparing the order.");
  return {...line,price:line.unit_price};
 });
 const itemNotes=items.filter(line=>line.notes).map(line=>`${line.name} (${line.quantity} ×): ${line.notes}`).join("\n");
 const notes=itemNotes ? itemNotes+(row.notes ? `\nOrder notes: ${row.notes}` : "") : row.notes;
 return {...row,items,notes,pickup_status:status,order_type:"collection",status:status==="ready_for_pickup" ? "ready" : status==="collected" ? "completed" : status};
}
export function pickupCommand(order:unknown,action:PickupAction,extra:Record<string,unknown>={}){
 const row=asRow(order);
 const status=pickupState(row);
 const allowed=action==="confirm_payment" ? ["payment_method"] : action==="collect" ? ["handover_confirmed"] : action==="reject" ? ["reason"] : [];
 if(Object.keys(extra).some(key=>!allowed.includes(key)))throw new Error("Unexpected pickup command input.");
 if(action==="reject" && (typeof extra.reason!=="string" || !extra.reason.trim()))throw new Error("Enter a reason before rejecting this order.");
 if(!((status==="pending" && ["accept","reject"].includes(action)) || (status==="preparing" && action==="ready") ||
  (status==="ready_for_pickup" && action==="confirm_payment" && row?.payment_status==="unpaid") ||
  (status==="ready_for_pickup" && action==="collect" && row?.payment_status==="paid")))throw new Error("That pickup transition is not permitted.");
 if(action==="confirm_payment" && !["cash","card_machine"].includes(String(extra.payment_method)))throw new Error("Confirm actual cash or physical-card payment at the shop.");
 if(action==="collect" && extra.handover_confirmed!==true)throw new Error("Confirm actual food handover before marking Collected.");
 return {path:action==="confirm_payment" ? "payment-confirmation" : action,
  body:{command_id:crypto.randomUUID(),expected_revision:row?.revision,...extra}};
}
export function pickupOrderingEnabled():boolean { return import.meta.env?.VITE_PICKUP_ORDERING_ENABLED === "true"; }
export function pickupMutationsDisabled():void {
 if(pickupOrderingEnabled())return;
 throw new Error("Pickup actions are not enabled until database migration and activation are separately approved. No order, payment or collection change was saved.");
}
export function pickupPaymentLabel(order:unknown):string {
 const row=asRow(order);
 if(!isPickupOrder(row))return row?.payment_status==="paid" ? "Paid" : row?.payment_status==="unpaid" ? "Unpaid" : "Payment status unavailable";
 return row?.payment_status==="paid" ? "Paid at shop" : row?.payment_status==="unpaid" ? "Unpaid · pay at shop" : "Payment status unavailable";
}
export function pickupAmountLabel(order:unknown):string {
 const row=asRow(order);
 if(!isPickupOrder(row) || typeof row?.total_price!=="number" || !Number.isFinite(row.total_price) || row.total_price<0)
  throw new Error("Pickup payable amount is unavailable.");
 const fee=typeof row.service_fee==="number" && Number.isFinite(row.service_fee) && row.service_fee>=0 ? `R ${row.service_fee.toFixed(2)}` : "unavailable";
 return `Pay at shop: R ${row.total_price.toFixed(2)} · Pickup service fee: ${fee}`;
}
