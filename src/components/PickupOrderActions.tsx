import React from "react";
import {pickupState,pickupPaymentLabel} from "../services/merchantPickupPolicy";
export function PickupOrderActions({order}:{order:any}){
 let status:string;
 try{status=pickupState(order);}catch{return <p role="alert" className="text-xs text-amber-700">Pickup state unavailable. Required schema is not installed; no action was saved.</p>;}
 const actions=status==="pending" ? ["Accept → Preparing","Reject"] : status==="preparing" ? ["Mark Ready"] : status==="ready_for_pickup" ?
  order.payment_status==="paid" ? ["Food handed over → Collected"] : ["Confirm cash received","Confirm card-machine payment"] : [];
 return <div className="space-y-2 py-2">
  <p className="text-xs font-bold">Pickup · {status==="collected" ? "Collected" : status==="ready_for_pickup" ? "Ready" : status} · {pickupPaymentLabel(order)}</p>
  {order.phone && <a className="text-xs underline" href={`tel:${String(order.phone).replace(/[^+0-9]/g,"")}`}>Optional call: {order.phone}</a>}
  <div className="flex flex-wrap gap-2">{actions.map(action=><button key={action} type="button" disabled title="Requires separately approved pickup database activation" className="px-3 py-2 rounded-full bg-surface-container-high text-on-surface-variant text-xs font-bold opacity-50">{action}</button>)}</div>
  {!!actions.length && <p className="text-xs text-on-surface-variant">Pickup changes are disabled pending database activation. Payment and actual handover are separate confirmations.</p>}
 </div>;
}
