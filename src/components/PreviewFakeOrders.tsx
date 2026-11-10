import {memo,startTransition,useCallback,useEffect,useRef,useState} from "react";
import {FlaskConical,X} from "lucide-react";
import {toast} from "sonner";
import {PickupOrderActions} from "./PickupOrderActions";
import {pickupCommand,type PickupAction} from "../services/merchantPickupPolicy";
import {isMerchantPreviewSimulatorEnabled} from "../services/merchantPreviewSimulator";

// The fake queue NEVER merges into actual orders, status counts, exports or storage.
// Only small view-only cards are inserted into the four existing Kanban columns.
export type PreviewTestPickupOrder = {
  id: string; customer_name: string; created_at: string;
  shop_id: string; delivery_type: "collection"; order_type: "collection";
  product_name: string; items: {name:string;quantity:number;unit_price:number;line_total:number}[];
  total_price: number; service_fee: number; payment_status: "paid" | "unpaid";
  pickup_status: "pending" | "preparing" | "ready_for_pickup" | "collected" | "cancelled";
  status: "pending" | "preparing" | "ready" | "completed" | "cancelled";
  revision: number; payment_method?: "cash" | "card_machine";
};

export type PreviewTestPickupAction=(id:string,action:PickupAction,extra:Record<string,unknown>)=>void;

const makeFakeOrder=(number:number):PreviewTestPickupOrder=>({
  id:`FAKE-L1C3-${number}`,
  customer_name:`Test Customer ${number}`,
  created_at:new Date().toISOString(),
  shop_id:"FAKE-NO-SHOP",
  delivery_type:"collection",order_type:"collection",
  product_name:"Kota",items:[{name:"Kota",quantity:1,unit_price:25,line_total:25}],
  total_price:25,service_fee:0,
  payment_status:"unpaid",pickup_status:"pending",status:"pending",revision:0,
});

const advanceLocal=(order:PreviewTestPickupOrder,action:PickupAction,extra:Record<string,unknown>):PreviewTestPickupOrder=>{
  // Validate the SAME pickup state machine as the real action component.
  // Discard its returned command UUID; never call the transport.
  pickupCommand(order,action,extra);
  const next={...order,revision:order.revision+1};
  if(action==="accept")return {...next,pickup_status:"preparing",status:"preparing"};
  if(action==="ready")return {...next,pickup_status:"ready_for_pickup",status:"ready"};
  if(action==="confirm_payment")return {...next,payment_status:"paid",payment_method:extra.payment_method as "cash" | "card_machine"};
  if(action==="collect")return {...next,pickup_status:"collected",status:"completed"};
  return {...next,pickup_status:"cancelled",status:"cancelled"};
};

function playBrowserTestChime(){
  try {
    const AudioContextClass=window.AudioContext;
    if(!AudioContextClass)return;
    const ctx=new AudioContextClass();
    const oscillator=ctx.createOscillator(),gain=ctx.createGain();
    oscillator.type="sine";oscillator.frequency.value=740;
    gain.gain.setValueAtTime(0.04,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.2);
    oscillator.connect(gain);gain.connect(ctx.destination);
    oscillator.start();oscillator.stop(ctx.currentTime+0.2);
    oscillator.onended=()=>{void ctx.close();};
  } catch { /* Audio is optional; no permission is requested. */ }
}

export function usePreviewFakeOrders(){
  const [fakeOrders,setFakeOrders]=useState<PreviewTestPickupOrder[]>([]);
  const [incoming,setIncoming]=useState(false);
  const itemsRef=useRef<PreviewTestPickupOrder[]>([]);
  const countRef=useRef(0);
  const timerRef=useRef<number|null>(null);
  const allowed=isMerchantPreviewSimulatorEnabled();
  useEffect(()=>()=>{if(timerRef.current!==null)window.clearTimeout(timerRef.current);},[]);

  const simulateIncoming=(soundEnabled:boolean)=>{
    if(!isMerchantPreviewSimulatorEnabled()||timerRef.current!==null)return;
    setIncoming(true);
    if(soundEnabled)playBrowserTestChime();
    // Delay intentionally mimics a new incoming order without calling any API.
    timerRef.current=window.setTimeout(()=>{
      timerRef.current=null;
      if(!isMerchantPreviewSimulatorEnabled())return;
      countRef.current+=1;
      const next=[makeFakeOrder(countRef.current),...itemsRef.current].slice(0,60);
      itemsRef.current=next;setFakeOrders(next);setIncoming(false);
      toast.info("FAKE pickup order arrived — TEST ONLY. No real order was created.",{duration:3500});
    },600);
  };
  const simulateBatch=()=>{
    if(!isMerchantPreviewSimulatorEnabled())return;
    // Deliberately create a bounded, local-only volume of sample orders.
    // No API endpoint, notifications or database is used.
    const batch=Array.from({length:24},()=>{
      countRef.current+=1;
      return makeFakeOrder(countRef.current);
    });
    const next=[...batch,...itemsRef.current].slice(0,60);
    itemsRef.current=next;
    setFakeOrders(next);
    toast.info("TEST ONLY: 24 fictional orders added for layout testing.",{duration:3500});
  };
  const clearFakeOrders=()=>{
    if(timerRef.current!==null){window.clearTimeout(timerRef.current);timerRef.current=null;}
    itemsRef.current=[];setFakeOrders([]);setIncoming(false);
  };
  const onDemoAction:PreviewTestPickupAction=useCallback((id,action,extra)=>{
    if(!isMerchantPreviewSimulatorEnabled())throw new Error("Fake order simulation is unavailable.");
    const current=itemsRef.current.find(order=>order.id===id);
    if(!current)throw new Error("The sample order is unavailable.");
    const updated=advanceLocal(current,action,extra);
    const next=itemsRef.current.map(order=>order.id===id?updated:order);
    itemsRef.current=next;
    // Keep the button response immediate; the heavy ticket-list update is lower priority.
    // This alone does not prove a specific INP value: validate in an actual browser.
    startTransition(()=>setFakeOrders(next));
  },[]);
  return {allowed,fakeOrders,incoming,simulateIncoming,simulateBatch,clearFakeOrders,onDemoAction};
}

export const PreviewFakeOrderCard=memo(function PreviewFakeOrderCard({order,onDemoAction,variant="expediter"}:{
  order:PreviewTestPickupOrder;
  onDemoAction:PreviewTestPickupAction;
  variant?:"expediter"|"compact";
}){
  // One memoized, lightweight ticket. Local demo state never reaches an API.
  if(!isMerchantPreviewSimulatorEnabled())return null;
  const roomy=variant==="expediter";
  const shortId=order.id.replace("FAKE-L1C3-","T-");
  const payment=order.payment_status==="paid" ? "Payment simulated" : "Pay at shop";
  return <article
    data-testid="fake-incoming-order"
    data-style={variant}
    className={`min-w-0 overflow-hidden bg-white dark:bg-zinc-950 border-2 border-dashed border-amber-300 dark:border-amber-600/70 shadow-sm ${roomy?"rounded-2xl px-3.5 py-3 space-y-2":"rounded-xl px-3 py-2.5 space-y-1.5"}`}
  >
    <div className="min-w-0 flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-100 px-1.5 py-0.5 text-[9px] leading-3 font-extrabold tracking-wide uppercase">
        <FlaskConical size={11} aria-hidden="true"/> Fake · Test only
      </span>
      <span className="shrink-0 font-mono text-[10px] font-bold text-slate-500 dark:text-zinc-400" title={order.id}>#{shortId}</span>
    </div>
    <div className="flex min-w-0 items-start justify-between gap-2">
      <h4 className={`min-w-0 font-headline font-extrabold text-slate-900 dark:text-zinc-100 break-words leading-5 ${roomy?"text-[15px]":"text-sm"}`}>{order.customer_name}</h4>
      <span className="shrink-0 font-extrabold text-[13px] text-slate-900 dark:text-zinc-100">R {order.total_price.toFixed(2)}</span>
    </div>
    <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300 leading-4 truncate" title={order.product_name}>
      1× {order.product_name} <span className="font-normal text-slate-500 dark:text-zinc-400">· {payment}</span>
    </p>
    <PickupOrderActions order={order} compact onSimulate={(action,extra)=>onDemoAction(order.id,action,extra)}/>
  </article>;
});

export function PreviewFakeOrderTrigger({incoming,count,onSimulate,onClear}:{
  incoming:boolean;count:number;onSimulate:()=>void;onClear:()=>void;
}){
  if(!isMerchantPreviewSimulatorEnabled())return null;
  return <div data-testid="fake-incoming-controls" className="flex items-center gap-2">
    <button type="button" onClick={onSimulate} disabled={incoming}
      aria-label="Simulate a fake incoming pickup order"
      className="inline-flex items-center gap-1.5 rounded-full border border-amber-400 bg-amber-100 text-amber-950 px-3 py-2 text-xs font-bold disabled:opacity-60">
      <FlaskConical size={14} aria-hidden="true"/> {incoming?"Incoming…":"Simulate order"}
    </button>
    {count>0&&<button type="button" onClick={onClear} className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-300" aria-label="Clear all fake orders">
      <X size={13} aria-hidden="true"/> Clear tests ({count})
    </button>}
  </div>;
}
