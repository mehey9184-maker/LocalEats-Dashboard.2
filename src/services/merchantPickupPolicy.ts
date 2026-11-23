export type PickupAction="accept"|"ready"|"reject"|"confirm_payment"|"collect";
type PickupSnapshot=Record<string,unknown>;
const asSnapshot=(value:unknown):PickupSnapshot=>{
 if(!value || typeof value!=="object" || Array.isArray(value))throw Error("Invalid pickup order shape.");
 return value as PickupSnapshot;
};
export const isPickupOrder=(order:unknown):boolean=>
 !!order && typeof order==="object" && !Array.isArray(order) &&
 (order as PickupSnapshot).delivery_type==="collection";
export function requireOwnedShop(shop:unknown,uid:string):PickupSnapshot {
 const candidate=asSnapshot(shop);
 if(!uid || candidate.id==null || candidate.owner_id!==uid)
  throw new Error("The API did not verify this shop against your Firebase identity.");
 return candidate;
}
export function pickupState(order:unknown):string {
 const value=asSnapshot(order);
 const status=value.pickup_status ?? value.status;
 if(!isPickupOrder(value) || typeof status!=="string" ||
  !["pending","preparing","ready_for_pickup","collected","cancelled"].includes(status) ||
  !["unpaid","paid"].includes(String(value.payment_status)) ||
  typeof value.revision!=="number" || !Number.isSafeInteger(value.revision) || value.revision<0 ||
  (value.payment_status==="paid" && !["ready_for_pickup","collected"].includes(status)) ||
  (status==="collected" && value.payment_status!=="paid"))
  throw new Error("Pickup state is unavailable or the required schema is not installed. Refresh; no action was saved.");
 return status;
}
export function mapApiOrder(order:unknown):Record<string,unknown> {
 const value=asSnapshot(order);
 if(typeof value.id!=="string" || value.shop_id==null)throw new Error("The API returned an invalid order.");
 if(!isPickupOrder(value))return value;
 const status=pickupState(value);
 if(typeof value.total_price!=="number" || !Number.isFinite(value.total_price) || value.total_price<0)
  throw new Error("The API returned an invalid pickup total.");
 if(!Array.isArray(value.items) || !value.items.length || value.items.length>50)
  throw new Error("Pickup item details are unavailable. Refresh before preparing the order.");
 const items=value.items.map((item:unknown)=>{
  const line=asSnapshot(item);
  if(typeof line.name!=="string" || typeof line.quantity!=="number" || !Number.isSafeInteger(line.quantity) || line.quantity<1 ||
   typeof line.unit_price!=="number" || !Number.isFinite(line.unit_price) || line.unit_price<0 ||
   typeof line.line_total!=="number" || !Number.isFinite(line.line_total) || line.line_total<0 ||
   Math.round(line.unit_price*100)*line.quantity!==Math.round(line.line_total*100) ||
   (line.notes!=null && (typeof line.notes!=="string" || line.notes.length>500)))
   throw new Error("Pickup item details are unavailable. Refresh before preparing the order.");
  return {...line,price:line.unit_price};
 });
 const itemNotes=items.filter(line=>!!line.notes).map(line=>`${line.name} (${line.quantity} ×): ${line.notes}`).join("\n");
 const notes=itemNotes ? itemNotes+(value.notes ? `\nOrder notes: ${value.notes}` : "") : value.notes;
 return {...value,items,notes,pickup_status:status,order_type:"collection",status:status==="ready_for_pickup" ? "ready" : status==="collected" ? "completed" : status};
}
export function pickupCommand(order:unknown,action:PickupAction,extra:Record<string,unknown>={}){
 const value=asSnapshot(order);
 const status=pickupState(value);
 const allowed=action==="confirm_payment" ? ["payment_method"] : action==="collect" ? ["handover_confirmed"] : action==="reject" ? ["reason"] : [];
 if(Object.keys(extra).some(key=>!allowed.includes(key)))throw new Error("Unexpected pickup command input.");
 if(action==="reject" && (typeof extra.reason!=="string" || !extra.reason.trim()))throw new Error("Enter a reason before rejecting this order.");
 if(!((status==="pending" && ["accept","reject"].includes(action)) || (status==="preparing" && action==="ready") ||
  (status==="ready_for_pickup" && action==="confirm_payment" && value.payment_status==="unpaid") ||
  (status==="ready_for_pickup" && action==="collect" && value.payment_status==="paid")))
  throw new Error("That pickup transition is not permitted.");
 if(action==="confirm_payment" && !["cash","card_machine"].includes(String(extra.payment_method)))throw new Error("Confirm actual cash or physical-card payment at the shop.");
 if(action==="collect" && extra.handover_confirmed!==true)throw new Error("Confirm actual food handover before marking Collected.");
 const revision=value.revision;
 if(typeof revision!=="number" || !Number.isSafeInteger(revision))throw Error("Invalid order revision.");
 return {path:action==="confirm_payment" ? "payment-confirmation" : action,
  body:{command_id:crypto.randomUUID(),expected_revision:revision,...extra}};
}
export function pickupOrderingEnabled():boolean { return import.meta.env?.VITE_PICKUP_ORDERING_ENABLED === "true"; }
export function pickupMutationsDisabled():void {
 if(pickupOrderingEnabled())return;
 throw new Error("Pickup actions are not enabled until database migration and activation are separately approved. No order, payment or collection change was saved.");
}
export function pickupPaymentLabel(order:unknown):string {
 const value=asSnapshot(order);
 if(!isPickupOrder(value))return value.payment_status==="paid" ? "Paid" : value.payment_status==="unpaid" ? "Unpaid" : "Payment status unavailable";
 return value.payment_status==="paid" ? "Paid at shop" : value.payment_status==="unpaid" ? "Unpaid · pay at shop" : "Payment status unavailable";
}
export function pickupAmountLabel(order:unknown):string {
 const value=asSnapshot(order);
 if(!isPickupOrder(value) || typeof value.total_price!=="number" || !Number.isFinite(value.total_price) || value.total_price<0)
  throw new Error("Pickup payable amount is unavailable.");
 const fee=typeof value.service_fee==="number" && Number.isFinite(value.service_fee) && value.service_fee>=0 ? `R ${value.service_fee.toFixed(2)}` : "unavailable";
 return `Pay at shop: R ${value.total_price.toFixed(2)} · Pickup service fee: ${fee}`;
}
