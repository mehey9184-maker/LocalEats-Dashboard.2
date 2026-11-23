import {memo,startTransition,useCallback,useEffect,useRef,useState} from "react";
import {FlaskConical,X} from "lucide-react";
import {toast} from "sonner";
import {PickupOrderActions} from "./PickupOrderActions";
import {OrderCustomerNote} from "./OrderCustomerNote";
import {pickupCommand,type PickupAction} from "../services/merchantPickupPolicy";
import {isMerchantPreviewSimulatorEnabled} from "../services/merchantPreviewSimulator";
import {isIsolatedCloudflareMerchantPitchPreviewEnabled} from "../services/cloudflareMerchantPitchGate";
import {
  askForDemoBrowserNotificationPermission,createDemoAudioContext,
  playOriginalDemoArrivalChime,showLocalExampleOrderNotification,
} from "../services/cloudflareDemoIncomingAlerts";

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
  notes?: string;
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
  notes:number%4===1?"No atchar":undefined,
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

export function usePreviewFakeOrders(soundAlertsEnabled:boolean){
  const [fakeOrders,setFakeOrders]=useState<PreviewTestPickupOrder[]>([]);
  const [incoming,setIncoming]=useState(false);
  const [simulationRunning,setSimulationRunning]=useState(false);
  const [demoNotificationsEnabled,setDemoNotificationsEnabled]=useState(false);
  const waveIndexRef=useRef(0);
  const demoAudioRef=useRef<AudioContext|null>(null);
  const demoNotifyRef=useRef(false);
  const soundEnabledRef=useRef(soundAlertsEnabled);
  soundEnabledRef.current=soundAlertsEnabled;
  const itemsRef=useRef<PreviewTestPickupOrder[]>([]);
  const countRef=useRef(0);
  const timerRef=useRef<number|null>(null);
  const allowed=isMerchantPreviewSimulatorEnabled();
  useEffect(()=>()=> {
    if(timerRef.current!==null)window.clearTimeout(timerRef.current);
    const context=demoAudioRef.current;
    if(context && context.state!=="closed")void context.close().catch(()=>{});
  },[]);

  // Audio must be unlocked from the merchant's actual tap (browser policy).
  // It then plays once per fictional arrival wave, never once per fake ticket.
  const prepareDemoAudio=()=>{
    if(!isIsolatedCloudflareMerchantPitchPreviewEnabled() || !soundEnabledRef.current)return;
    if(!demoAudioRef.current || demoAudioRef.current.state==="closed")
      demoAudioRef.current=createDemoAudioContext();
    else void demoAudioRef.current.resume().catch(()=>{});
  };
  const notifyDemoArrival=useCallback((count:number)=>{
    if(!isIsolatedCloudflareMerchantPitchPreviewEnabled() || count<1 ||
       document.visibilityState!=="visible")return;
    if(soundEnabledRef.current)playOriginalDemoArrivalChime(demoAudioRef.current);
    if(demoNotifyRef.current)showLocalExampleOrderNotification(count);
  },[]);
  const toggleDemoNotifications=async()=>{
    if(!isIsolatedCloudflareMerchantPitchPreviewEnabled())return;
    if(demoNotifyRef.current){
      demoNotifyRef.current=false;
      setDemoNotificationsEnabled(false);
      toast.info("DEMO ONLY: browser example alerts turned off.",{duration:2500,id:"localeats-demo-notice",style:{pointerEvents:"none"}});
      return;
    }
    const permission=await askForDemoBrowserNotificationPermission();
    if(permission!=="granted"){
      toast.info("Example system alerts unavailable here. Fictional in-app alerts and sound still work.",{duration:4500,id:"localeats-demo-notice",style:{pointerEvents:"none"}});
      return;
    }
    demoNotifyRef.current=true;
    setDemoNotificationsEnabled(true);
    toast.info("DEMO ONLY: browser example alerts enabled while this page is open — not real push.",{duration:4500,id:"localeats-demo-notice",style:{pointerEvents:"none"}});
  };

  const simulateIncoming=(soundEnabled:boolean)=>{
    if(!isMerchantPreviewSimulatorEnabled()||timerRef.current!==null)return;
    setIncoming(true);
    soundEnabledRef.current=soundEnabled;
    if(isIsolatedCloudflareMerchantPitchPreviewEnabled())prepareDemoAudio();
    else if(soundEnabled)playBrowserTestChime();
    // Delay intentionally mimics a new incoming order without calling any API.
    timerRef.current=window.setTimeout(()=>{
      timerRef.current=null;
      if(!isMerchantPreviewSimulatorEnabled())return;
      countRef.current+=1;
      const next=[makeFakeOrder(countRef.current),...itemsRef.current].slice(0,60);
      itemsRef.current=next;setFakeOrders(next);setIncoming(false);
      notifyDemoArrival(1);
      toast.info("FAKE pickup order arrived — TEST ONLY. No real order was created.",{duration:3500,id:"localeats-demo-notice",style:{pointerEvents:"none"}});
    },600);
  };
  // The original Orders screen stays unchanged. Only the arrival timing is
  // automated; the vendor must manually accept, prepare, confirm fake payment
  // and hand over each sample using the EXISTING PickupOrderActions buttons.
  const addSimulationWave=useCallback((requested:number)=>{
    if(!isMerchantPreviewSimulatorEnabled())return;
    const active=itemsRef.current.filter(order=>order.status!=="completed"&&order.status!=="cancelled");
    const awaiting=active.filter(order=>order.status==="pending").length;
    // Keep the existing board usable when the founder is explaining a step.
    const count=Math.min(requested,Math.max(0,18-awaiting),Math.max(0,40-active.length));
    if(count===0)return;
    const wave=Array.from({length:count},()=>{
      countRef.current+=1;
      return makeFakeOrder(countRef.current);
    });
    // Never drop an active sample in order to display another new sample.
    const history=itemsRef.current.filter(order=>order.status==="completed"||order.status==="cancelled");
    const next=[...wave,...active,...history].slice(0,60);
    itemsRef.current=next;
    setFakeOrders(next);
    notifyDemoArrival(count);
    toast.info(`DEMO ONLY: ${count} fictional pickup order${count===1?"":"s"} arrived.`,{duration:2200,id:"localeats-demo-notice",style:{pointerEvents:"none"}});
  },[notifyDemoArrival]);

  useEffect(()=>{
    if(!simulationRunning)return;
    // Missing preview flag or a Production hostname must fail closed.
    if(!isMerchantPreviewSimulatorEnabled()){setSimulationRunning(false);return;}
    const arrivals=[3,1,10,1,3,10];
    const id=window.setInterval(()=>{
      if(document.visibilityState==="hidden"||!isMerchantPreviewSimulatorEnabled())return;
      addSimulationWave(arrivals[waveIndexRef.current%arrivals.length]);
      waveIndexRef.current+=1;
    },8000);
    return ()=>window.clearInterval(id);
  },[simulationRunning,addSimulationWave]);

  const startSimulation=(soundEnabled:boolean)=>{
    if(!isMerchantPreviewSimulatorEnabled()||simulationRunning)return;
    if(timerRef.current!==null){
      window.clearTimeout(timerRef.current);
      timerRef.current=null;
      setIncoming(false);
    }
    waveIndexRef.current=0;
    soundEnabledRef.current=soundEnabled;
    if(isIsolatedCloudflareMerchantPitchPreviewEnabled())prepareDemoAudio();
    else if(soundEnabled)playBrowserTestChime();
    addSimulationWave(1);
    setSimulationRunning(true);
  };
  const stopSimulation=()=>setSimulationRunning(false);

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
    toast.info("TEST ONLY: 24 fictional orders added for layout testing.",{duration:3500,id:"localeats-demo-notice",style:{pointerEvents:"none"}});
  };
  const clearFakeOrders=()=>{
    setSimulationRunning(false);
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
  return {allowed,fakeOrders,incoming,simulationRunning,raiseDemoNotifications:toggleDemoNotifications,
    demoNotificationsEnabled,startSimulation,stopSimulation,simulateIncoming,simulateBatch,clearFakeOrders,onDemoAction};
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
    <OrderCustomerNote order={order} compact={!roomy}/>
    <PickupOrderActions order={order} compact onSimulate={(action,extra)=>onDemoAction(order.id,action,extra)}/>
  </article>;
});

export function PreviewFakeOrderTrigger({incoming,count,onSimulate,onClear,simulationRunning,onStartSimulation,onStopSimulation,
  demoNotificationsEnabled,onToggleDemoNotifications}:{
  incoming:boolean;count:number;onSimulate:()=>void;onClear:()=>void;
  simulationRunning:boolean;onStartSimulation:()=>void;onStopSimulation:()=>void;
  demoNotificationsEnabled:boolean;onToggleDemoNotifications:()=>void;
}){
  if(!isMerchantPreviewSimulatorEnabled())return null;
  // On mobile, the two primary pitch actions share a single row.
  // One-off simulation and clearing remain available under existing Orders > Tools.
  return <div data-testid="fake-incoming-controls" className="grid w-full min-w-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
    <button type="button" onClick={onSimulate} disabled={incoming}
      aria-label="Simulate a fake incoming pickup order"
      className="hidden sm:inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-amber-400 bg-amber-100 text-amber-950 px-3 py-2 text-xs font-bold disabled:opacity-60">
      <FlaskConical size={14} aria-hidden="true"/> {incoming?"Incoming…":"Simulate order"}
    </button>
    <button type="button"
      onClick={simulationRunning?onStopSimulation:onStartSimulation}
      aria-pressed={simulationRunning}
      aria-label={simulationRunning?"Stop fictional order arrivals":"Start fictional order arrivals"}
      className="inline-flex min-h-11 min-w-0 items-center justify-center rounded-full border border-amber-400 bg-amber-100 text-amber-950 px-2.5 py-2 text-[11px] sm:px-3 sm:text-xs font-bold whitespace-nowrap">
      {simulationRunning?"Stop simulation":"Start simulation"}
    </button>
    {isIsolatedCloudflareMerchantPitchPreviewEnabled()&&
      <button type="button" onClick={onToggleDemoNotifications}
        aria-pressed={demoNotificationsEnabled}
        aria-label={demoNotificationsEnabled?"Disable simulated browser notifications":"Enable simulated browser notifications"}
        title="Example notification only while the demo is open. Not real push delivery."
        className="inline-flex min-h-11 min-w-0 items-center justify-center rounded-full border border-amber-400 bg-amber-50 text-amber-950 px-2.5 py-2 text-[11px] sm:px-3 sm:text-xs font-bold whitespace-nowrap">
        {demoNotificationsEnabled?"Demo alerts on":"Try demo alert"}
      </button>}
    {count>0&&<button type="button" onClick={onClear}
      className="hidden sm:inline-flex min-h-11 items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-300"
      aria-label="Clear all fake orders">
      <X size={13} aria-hidden="true"/> Clear tests ({count})
    </button>}
  </div>;
}
