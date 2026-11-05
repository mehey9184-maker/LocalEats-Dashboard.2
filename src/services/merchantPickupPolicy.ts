export type PickupAction="accept"|"ready"|"reject"|"confirm_payment"|"collect";
export const isPickupOrder=(order:any):boolean=>order?.delivery_type==="collection";
export function requireOwnedShop(shop:any,uid:string){
 if(!uid || !shop || shop.id==null || shop.owner_id!==uid)throw new Error("The API did not verify this shop against your Firebase identity.");
 return shop;
}
export function pickupState(order:any):string {
 const status=order.pickup_status ?? order.status;
 if(!isPickupOrder(order) || !["pending","preparing","ready_for_pickup","collected","cancelled"].includes(status) ||
  !["unpaid","paid"].includes(order.payment_status) || !Number.isSafeInteger(order.revision) || order.revision<0 ||
  (order.payment_status==="paid" && !["ready_for_pickup","collected"].includes(status)) || (status==="collected" && order.payment_status!=="paid"))
  throw new Error("Pickup state is unavailable or the required schema is not installed. Refresh; no action was saved.");
 return status;
}
export function mapApiOrder(order:any):Record<string,unknown>{
 if(!order || typeof order.id!=="string" || order.shop_id==null)throw new Error("The API returned an invalid order.");
 if(!isPickupOrder(order))return order;
 const status=pickupState(order);
 if(typeof order.total_price!=="number" || !Number.isFinite(order.total_price) || order.total_price<0)throw new Error("The API returned an invalid pickup total.");
 if(!Array.isArray(order.items) || !order.items.length || order.items.length>50)
  throw new Error("Pickup item details are unavailable. Refresh before preparing the order.");
 const items=order.items.map((line:any)=>{
  if(!line || typeof line.name!=="string" || !Number.isSafeInteger(line.quantity) || line.quantity<1 ||
   typeof line.unit_price!=="number" || !Number.isFinite(line.unit_price) || line.unit_price<0 ||
   typeof line.line_total!=="number" || !Number.isFinite(line.line_total) || line.line_total<0 ||
   Math.round(line.unit_price*100)*line.quantity!==Math.round(line.line_total*100) ||
   (line.notes!=null && (typeof line.notes!=="string" || line.notes.length>500)))
   throw new Error("Pickup item details are unavailable. Refresh before preparing the order.");
  return {...line,price:line.unit_price};
 });
 const itemNotes=Array.isArray(items) ? items.filter((line:any)=>line.notes).map((line:any)=>`${line.name} (${line.quantity} ×): ${line.notes}`).join("\n") : "";
 const notes=itemNotes ? itemNotes+(order.notes ? `\nOrder notes: ${order.notes}` : "") : order.notes;
 return {...order,items,notes,pickup_status:status,order_type:"collection",status:status==="ready_for_pickup" ? "ready" : status==="collected" ? "completed" : status};
}
export function pickupCommand(order:any,action:PickupAction,extra:Record<string,unknown>={}){
 const status=pickupState(order);
 const allowed=action==="confirm_payment" ? ["payment_method"] : action==="collect" ? ["handover_confirmed"] : action==="reject" ? ["reason"] : [];
 if(Object.keys(extra).some(key=>!allowed.includes(key)))throw new Error("Unexpected pickup command input.");
 if(action==="reject" && (typeof extra.reason!=="string" || !extra.reason.trim()))throw new Error("Enter a reason before rejecting this order.");
 if(!((status==="pending" && ["accept","reject"].includes(action)) || (status==="preparing" && action==="ready") ||
  (status==="ready_for_pickup" && action==="confirm_payment" && order.payment_status==="unpaid") ||
  (status==="ready_for_pickup" && action==="collect" && order.payment_status==="paid")))throw new Error("That pickup transition is not permitted.");
 if(action==="confirm_payment" && !["cash","card_machine"].includes(String(extra.payment_method)))throw new Error("Confirm actual cash or physical-card payment at the shop.");
 if(action==="collect" && extra.handover_confirmed!==true)throw new Error("Confirm actual food handover before marking Collected.");
 return {path:action==="confirm_payment" ? "payment-confirmation" : action,
  body:{command_id:crypto.randomUUID(),expected_revision:order.revision,...extra}};
}
export function pickupOrderingEnabled():boolean { return import.meta.env?.VITE_PICKUP_ORDERING_ENABLED === "true"; }
export function pickupMutationsDisabled():void {
 if(pickupOrderingEnabled())return;
 throw new Error("Pickup actions are not enabled until database migration and activation are separately approved. No order, payment or collection change was saved.");
}
export function pickupPaymentLabel(order:any):string {
 if(!isPickupOrder(order))return order.payment_status==="paid" ? "Paid" : order.payment_status==="unpaid" ? "Unpaid" : "Payment status unavailable";
 return order.payment_status==="paid" ? "Paid at shop" : order.payment_status==="unpaid" ? "Unpaid · pay at shop" : "Payment status unavailable";
}

export function pickupAmountLabel(order:any):string {
 if(!isPickupOrder(order) || typeof order.total_price!=="number" || !Number.isFinite(order.total_price) || order.total_price<0)
  throw new Error("Pickup payable amount is unavailable.");
 const fee=typeof order.service_fee==="number" && Number.isFinite(order.service_fee) && order.service_fee>=0 ? `R ${order.service_fee.toFixed(2)}` : "unavailable";
 return `Pay at shop: R ${order.total_price.toFixed(2)} · Pickup service fee: ${fee}`;
}
