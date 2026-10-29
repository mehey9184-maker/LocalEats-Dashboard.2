import React,{useState} from "react";
import {MerchantApi} from "../services/MerchantApi";
import {pickupOrderingEnabled,type PickupAction} from "../services/merchantPickupPolicy";
import {pickupState,pickupPaymentLabel} from "../services/merchantPickupPolicy";
export function PickupOrderActions({order}:{order:any}){
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 let status:string;
 try{status=pickupState(order);}catch{return <p role="alert" className="text-xs text-amber-700">Pickup state unavailable. Required schema is not installed; no action was saved.</p>;}
 const actions=status==="pending" ? ["Accept → Preparing","Reject"] : status==="preparing" ? ["Mark Ready"] : status==="ready_for_pickup" ?
  order.payment_status==="paid" ? ["Food handed over → Collected"] : ["Confirm cash received","Confirm card-machine payment"] : [];
 const act=async(label:string)=>{
  if(busy || !pickupOrderingEnabled())return;
  let action:PickupAction=label.startsWith("Accept") ? "accept" : label==="Reject" ? "reject" : label==="Mark Ready" ? "ready" : label.startsWith("Food") ? "collect" : "confirm_payment";
  const extra:Record<string,unknown>={};
  if(action==="reject"){const reason=window.prompt("Why is this order rejected?");if(!reason?.trim())return;extra.reason=reason;}
  if(action==="confirm_payment"){if(!window.confirm("Confirm you have actually received payment at the shop?"))return;extra.payment_method=label.includes("cash") ? "cash" : "card_machine";}
  if(action==="collect"){if(!window.confirm("Confirm the food has actually been handed to the customer?"))return;extra.handover_confirmed=true;}
  setBusy(true);setError("");
  try{await MerchantApi.transitionPickupOrder(order,action,extra);window.dispatchEvent(new Event("merchant-pickup-order-confirmed"));}
  catch(e){setError(e instanceof Error?e.message:"No change was confirmed. Retry the same action.");}
  finally{setBusy(false);}
 };
 return <div className="space-y-2 py-2">
  <p className="text-xs font-bold">Pickup · {status==="collected" ? "Collected" : status==="ready_for_pickup" ? "Ready" : status} · {pickupPaymentLabel(order)}</p>
  {order.phone && <a className="text-xs underline" href={`tel:${String(order.phone).replace(/[^+0-9]/g,"")}`}>Optional call: {order.phone}</a>}
  <div className="flex flex-wrap gap-2">{actions.map(action=><button key={action} type="button" disabled={busy || !pickupOrderingEnabled()} onClick={()=>void act(action)} title={pickupOrderingEnabled()?"Confirm actual order facts":"Requires separately approved pickup database activation"} className="px-3 py-2 rounded-full bg-surface-container-high text-on-surface-variant text-xs font-bold opacity-50">{action}</button>)}</div>
  {pickupOrderingEnabled() && MerchantApi.hasPendingPickupCommand(order) && <button type="button" disabled={busy} onClick={async()=>{setBusy(true);try{await MerchantApi.retryPendingPickupOrder(order);window.dispatchEvent(new Event("merchant-pickup-order-confirmed"));setError("");}catch(e){setError(e instanceof Error?e.message:"Outcome unconfirmed.");}finally{setBusy(false);}}}>Retry previous action</button>}
  {error && <p role="alert">{error}</p>}
  {!!actions.length && !pickupOrderingEnabled() && <p className="text-xs text-on-surface-variant">Pickup changes are disabled pending database activation. Payment and actual handover are separate confirmations.</p>}
 </div>;
}
