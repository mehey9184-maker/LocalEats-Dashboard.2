import {useEffect,useRef,useState} from "react";
import {FlaskConical,ShoppingBag,Clock3,X} from "lucide-react";
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
  const onDemoAction:PreviewTestPickupAction=(id,action,extra)=>{
    if(!isMerchantPreviewSimulatorEnabled())throw new Error("Fake order simulation is unavailable.");
    const current=itemsRef.current.find(order=>order.id===id);
    if(!current)throw new Error("The sample order is unavailable.");
    const updated=advanceLocal(current,action,extra);
    const next=itemsRef.current.map(order=>order.id===id?updated:order);
    itemsRef.current=next;setFakeOrders(next);
    toast.info(`TEST ONLY: ${action.replace("_"," ")} simulated; nothing was saved.`,{duration:2400});
  };
  return {allowed,fakeOrders,incoming,simulateIncoming,simulateBatch,clearFakeOrders,onDemoAction};
}

export function PreviewFakeOrderCard({order,onDemoAction,variant="expediter"}:{order:PreviewTestPickupOrder;onDemoAction:PreviewTestPickupAction;variant?:"expediter"|"compact"}){
  if(!isMerchantPreviewSimulatorEnabled())return null;
  const roomy=variant==="expediter";
  return (
    <article data-testid="fake-incoming-order" data-style={variant} className={`min-w-0 bg-amber-50/40 dark:bg-amber-950/20 border-2 border-dashed border-amber-300 shadow-sm relative overflow-hidden animate-in fade-in duration-200 ${roomy?"rounded-2xl p-4 space-y-3":"rounded-xl p-2.5 space-y-2"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-amber-100 text-amber-950 px-2 py-1 text-[10px] font-black inline-flex items-center gap-1">
          <FlaskConical size={12} aria-hidden="true"/> FAKE · TEST ONLY
        </span>
        <span className="text-[10px] text-on-surface-variant font-mono break-all">{order.id}</span>
      </div>
      <div>
        <h4 className={`font-extrabold text-on-surface ${roomy?"text-sm":"text-xs"}`}>{order.customer_name}</h4>
        <p className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-1">
          <ShoppingBag size={13} aria-hidden="true"/> {order.product_name} × 1 · R {order.total_price.toFixed(2)}
        </p>
        {roomy&&<p className="flex items-center gap-1 text-xs text-on-surface-variant mt-1">
          <Clock3 size={12} aria-hidden="true"/> Sample pickup · Pay at shop
        </p>}
      </div>
      <PickupOrderActions order={order} compact={!roomy} onSimulate={(action,extra)=>onDemoAction(order.id,action,extra)}/>
      {roomy&&<p className="text-[10px] text-amber-800 dark:text-amber-200 font-semibold">Never printed, sent, charged or stored.</p>}
    </article>
  );
}

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
