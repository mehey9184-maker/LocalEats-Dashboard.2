import React,{useState} from "react";
import {MerchantApi} from "../services/MerchantApi";
import {pickupOrderingEnabled,type PickupAction} from "../services/merchantPickupPolicy";
import {pickupState,pickupPaymentLabel,pickupAmountLabel} from "../services/merchantPickupPolicy";
import {isMerchantPreviewSimulatorEnabled} from "../services/merchantPreviewSimulator";

type SimulatedTransition = (action: PickupAction, extra: Record<string,unknown>) => Promise<void> | void;

export function PickupOrderActions({order,onSimulate,compact=false}:{order:any;onSimulate?:SimulatedTransition;compact?:boolean}){
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 // ONLY fake order IDs on the guarded no-write Preview may bypass the real pickup write gate.
 const simulated=!!onSimulate && isMerchantPreviewSimulatorEnabled() &&
   typeof order?.id==="string" && /^FAKE-L1C3-[0-9]+$/.test(order.id);
 let status:string;
 try{status=pickupState(order);}catch{return <p role="alert" className="text-xs text-amber-700">Pickup state unavailable. Required schema is not installed; no action was saved.</p>;}
 const actions=status==="pending" ? ["Accept → Preparing","Reject"] : status==="preparing" ? ["Mark Ready"] : status==="ready_for_pickup" ?
  order.payment_status==="paid" ? ["Food handed over → Collected"] : ["Confirm cash received","Confirm card-machine payment"] : [];
 const pending=simulated ? false : MerchantApi.hasPendingPickupCommand(order);
 const canAct=simulated || pickupOrderingEnabled();
 const act=async(label:string)=>{
  if(busy || !canAct)return;
  let action:PickupAction=label.startsWith("Accept") ? "accept" : label==="Reject" ? "reject" : label==="Mark Ready" ? "ready" : label.startsWith("Food") ? "collect" : "confirm_payment";
  const extra:Record<string,unknown>={};
  if(action==="reject"){
   const reason=window.prompt(simulated ? "TEST ONLY: Why would this sample order be rejected?" : "Why is this order rejected?");
   if(!reason?.trim())return;extra.reason=reason;
  }
  if(action==="confirm_payment"){
   if(!window.confirm(simulated ? "TEST ONLY: Simulate a cash/card payment? No real money will be recorded." : "Confirm you have actually received payment at the shop?"))return;
   extra.payment_method=label.includes("cash") ? "cash" : "card_machine";
  }
  if(action==="collect"){
   if(!window.confirm(simulated ? "TEST ONLY: Simulate food handover? Nothing will be marked collected in the real system." : "Confirm the food has actually been handed to the customer?"))return;
   extra.handover_confirmed=true;
  }
  setBusy(true);setError("");
  try{
   if(simulated) {
    // No MerchantApi call, no server confirmation event, no payment or real-order mutation.
    await onSimulate!(action,extra);
   } else {
    await MerchantApi.transitionPickupOrder(order,action,extra);
    window.dispatchEvent(new Event("merchant-pickup-order-confirmed"));
   }
  }
  catch(e){setError(e instanceof Error?e.message:"No change was confirmed. Retry the same action.");}
  finally{setBusy(false);}
 };
 return <div className={compact?"space-y-2 py-1":"space-y-2 py-2"} aria-busy={busy}>
  {simulated && !compact && <p className="text-[10px] font-black text-amber-800 dark:text-amber-200">FAKE ORDER · BROWSER SIMULATION ONLY</p>}
  <p className="text-xs font-bold">Pickup · {status==="collected" ? "Collected" : status==="ready_for_pickup" ? "Ready" : status} · {pickupPaymentLabel(order)}</p>
  {!compact && <p className="text-xs">{pickupAmountLabel(order)}</p>}
  {!simulated && order.phone && <a className="text-xs underline" href={`tel:${String(order.phone).replace(/[^+0-9]/g,"")}`}>Optional call: {order.phone}</a>}
  <div className="flex flex-wrap gap-2">{actions.map(action=><button key={action} type="button" disabled={busy || pending || !canAct} onClick={()=>void act(action)} title={simulated ? "TEST ONLY: changes local sample status, not real orders" : pickupOrderingEnabled() ? "Confirm actual order facts" : "Requires separately approved pickup database activation"} className="min-h-11 px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed motion-safe:active:scale-95 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{action}</button>)}</div>
  {busy && <p role="status" className="text-xs">{simulated ? "Simulating this step…" : "Waiting for the shop service to confirm…"}</p>}
  {!simulated && pickupOrderingEnabled() && pending && <button type="button" className="min-h-11 px-3 underline text-sm disabled:opacity-50" disabled={busy} onClick={async()=>{setBusy(true);setError("");try{await MerchantApi.retryPendingPickupOrder(order);window.dispatchEvent(new Event("merchant-pickup-order-confirmed"));setError("");}catch(e){setError(e instanceof Error?e.message:"Outcome unconfirmed.");}finally{setBusy(false);}}}>Retry previous action</button>}
  {error && <p role="alert">{error}</p>}
  {!!actions.length && !canAct && <p className="text-xs text-on-surface-variant">Pickup changes are disabled pending database activation. Payment and actual handover are separate confirmations.</p>}
  {simulated && !compact && <p className="text-[11px] text-on-surface-variant">Test actions stay on this page. No payment, notification, or order is saved.</p>}
 </div>;
}
