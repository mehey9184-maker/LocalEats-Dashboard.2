import React,{useState} from "react";
import {Check, X} from "lucide-react";
import {MerchantApi} from "../services/MerchantApi";
import {pickupOrderingEnabled,type PickupAction} from "../services/merchantPickupPolicy";
import {pickupState,pickupPaymentLabel,pickupAmountLabel} from "../services/merchantPickupPolicy";
import {isMerchantPreviewSimulatorEnabled} from "../services/merchantPreviewSimulator";
import {pickupNeedsUncollectedAttention,pickupUnpaidWaitingMinutes} from "../services/pickupNoShow";

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
  {simulated && !compact && <p className="text-[10px] font-bold text-amber-900 dark:text-amber-200">Sample pickup · No real order</p>}
  {!compact && <p className="text-[11px] leading-4 font-semibold text-slate-700 dark:text-zinc-200">Pickup · {status==="collected" ? "Collected" : status==="ready_for_pickup" ? "Ready" : status} · {pickupPaymentLabel(order)}</p>}
  {!compact && <p className="text-xs">{pickupAmountLabel(order)}</p>}
  {!compact && status==="ready_for_pickup" && order.payment_status==="unpaid" && (
    <p role="status" className="text-xs font-semibold text-amber-700 dark:text-amber-200">
      {pickupNeedsUncollectedAttention(order)
        ? "Ready 30+ minutes · still unpaid. Check the order and contact the customer if appropriate. Never mark Paid or Collected before payment and handover."
        : "Ready · awaiting actual payment at the counter. Do not mark Collected or count this as revenue until payment and food handover are confirmed."}
      {pickupUnpaidWaitingMinutes(order)!==null && " · "+pickupUnpaidWaitingMinutes(order)+" min since last status update"}
    </p>
  )}
  {!compact && status==="ready_for_pickup" && order.payment_status==="paid" && (
    <p role="status" className="text-xs font-semibold text-slate-700 dark:text-slate-200">
      Paid · still awaiting physical handover. Mark Collected only after the customer receives the food.
    </p>
  )}
  {!simulated && order.phone && <a className="text-xs underline" href={`tel:${String(order.phone).replace(/[^+0-9]/g,"")}`}>Optional call: {order.phone}</a>}
  <div role="group" aria-label="Pickup order actions" className="flex w-full items-center gap-2 min-w-0">
    {actions.map(label=>{
      const reject=label==="Reject";
      const accept=label.startsWith("Accept");
      const ready=label==="Mark Ready";
      return <button key={label} type="button"
        disabled={busy || pending || !canAct}
        onClick={()=>void act(label)}
        aria-label={reject ? (simulated ? "Reject fake order (reason required)" : "Reject order (reason required)") : label}
        title={reject ? "Reject — requires a reason" : simulated ? "TEST ONLY: local sample, no real order" : pickupOrderingEnabled() ? "Confirm actual order facts" : "Requires separately approved pickup database activation"}
        className={`min-h-11 rounded-xl inline-flex items-center justify-center gap-1.5 font-bold text-xs sm:text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed motion-safe:active:scale-[0.98] transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
          ${reject
            ? "w-11 shrink-0 border border-slate-200 bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            : ready
              ? "min-w-0 flex-1 px-2 sm:px-3 bg-emerald-600 hover:bg-emerald-700 text-white"
              : accept
                ? "min-w-0 flex-1 px-2 sm:px-3 bg-orange-500 hover:bg-orange-600 text-white"
                : "min-w-0 flex-1 px-2 sm:px-3 bg-orange-500 hover:bg-orange-600 text-white"}` }
      >
        {reject?<X size={17} strokeWidth={2.5} aria-hidden="true"/>:<>
          {(accept||ready)&&<Check size={16} strokeWidth={2.5} aria-hidden="true"/>}
          <span className="min-w-0 text-center leading-snug">{accept?"Accept & Prep":ready?"Mark Ready":label}</span>
        </>}
      </button>;
    })}
  </div>
  {busy && <p role="status" className="text-xs">{simulated ? "Simulating this step…" : "Waiting for the shop service to confirm…"}</p>}
  {!simulated && pickupOrderingEnabled() && pending && <button type="button" className="min-h-11 px-3 underline text-sm disabled:opacity-50" disabled={busy} onClick={async()=>{setBusy(true);setError("");try{await MerchantApi.retryPendingPickupOrder(order);window.dispatchEvent(new Event("merchant-pickup-order-confirmed"));setError("");}catch(e){setError(e instanceof Error?e.message:"Outcome unconfirmed.");}finally{setBusy(false);}}}>Retry previous action</button>}
  {error && <p role="alert">{error}</p>}
  {!!actions.length && !canAct && <p className="text-xs text-on-surface-variant">Pickup changes are disabled pending database activation. Payment and actual handover are separate confirmations.</p>}
  {simulated && !compact && <p className="text-[10px] text-amber-800 dark:text-amber-200">Test actions stay in this browser; no payment or order is saved.</p>}
 </div>;
}
