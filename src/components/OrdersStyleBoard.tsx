import React,{useEffect,useMemo,useState} from "react";
import {ChevronDown, ChevronUp, Clock3, ClipboardList, ShoppingBag} from "lucide-react";
import type {Order} from "../types";
import {isPickupOrder,pickupPaymentLabel} from "../services/merchantPickupPolicy";
import {PickupOrderActions} from "./PickupOrderActions";
import {PreviewFakeOrderCard,type PreviewTestPickupOrder,type PreviewTestPickupAction} from "./PreviewFakeOrders";

export type OrderBoardStyle="expediter"|"compact";
export type BoardEntry={kind:"real";order:Order}|{kind:"fake";order:PreviewTestPickupOrder};
type Stage="pending"|"preparing"|"ready"|"fulfilled";
const LANES:{key:Stage;label:string;short:string;dot:string;bg:string}[]=[
 {key:"pending",label:"New orders",short:"New",dot:"bg-orange-500",bg:"bg-orange-50/50 dark:bg-orange-950/10"},
 {key:"preparing",label:"Preparing",short:"Preparing",dot:"bg-blue-500",bg:"bg-blue-50/40 dark:bg-blue-950/10"},
 {key:"ready",label:"Ready / hand-off",short:"Ready",dot:"bg-emerald-500",bg:"bg-emerald-50/40 dark:bg-emerald-950/10"},
 {key:"fulfilled",label:"Fulfilled today",short:"Fulfilled",dot:"bg-zinc-400",bg:"bg-slate-50 dark:bg-zinc-900/40"},
];
const stageFor=(entry:BoardEntry):Stage=>{
 const status=String(entry.order.status??"pending");
 if(status==="pending")return "pending";
 if(status==="accepted"||status==="preparing")return "preparing";
 if(status==="ready")return "ready";
 return "fulfilled";
};
const money=(v:unknown)=>Number.isFinite(Number(v))?`R ${Number(v).toFixed(2)}`:"Amount unavailable";
const orderTime=(value:string|undefined)=>{
 if(!value)return "Time unavailable";
 const d=new Date(value);
 return Number.isNaN(d.getTime())?"Time unavailable":d.toLocaleTimeString("en-ZA",{hour:"2-digit",minute:"2-digit"});
};

function RealOrderTicket({order,style,index,renderRealOrder}:{
 order:Order;style:OrderBoardStyle;index:number;renderRealOrder:(order:Order,index:number)=>React.ReactNode
}){
 const [expanded,setExpanded]=useState(false);
 const roomy=style==="expediter";
 const pickup=isPickupOrder(order);
 const fullStatus=String(order.status||"pending");
 return <article data-testid="styled-real-order" className={
   `min-w-0 overflow-hidden bg-surface-container-lowest dark:bg-zinc-950 border border-outline-variant/20 shadow-sm ${roomy?"p-4 rounded-2xl space-y-3":"p-3 rounded-xl space-y-2"}`
 }>
   <div className="flex items-start justify-between gap-2 min-w-0">
     <div className="min-w-0">
       <p className="font-mono text-[11px] font-extrabold text-on-surface break-all">#{String(order.id).slice(-9).toUpperCase()}</p>
       {roomy&&<p className="text-[10px] text-on-surface-variant mt-1">{pickup?"Counter pickup":"Existing order"}</p>}
     </div>
     <span className="text-[10px] whitespace-nowrap font-semibold text-on-surface-variant">{orderTime(order.created_at)}</span>
   </div>
   <div className="flex justify-between items-start gap-2 min-w-0">
     <p className={`min-w-0 break-words text-on-surface font-extrabold ${roomy?"text-sm":"text-xs"}`}>{order.customer_name||"Customer"}</p>
     <p className="font-bold text-on-surface text-xs whitespace-nowrap">{money(order.total_price)}</p>
   </div>
   <p className={`text-on-surface-variant break-words ${roomy?"text-xs":"text-[11px]"}`}>
     <ShoppingBag size={12} className="inline-block mr-1" aria-hidden="true"/>{order.product_name||"Open full order for items"}
   </p>
   {pickup?<div className={roomy?"rounded-xl bg-surface-container-low/50 p-2":"rounded-lg bg-surface-container-low/50 p-1.5"}>
     {roomy&&<p className="text-[11px] text-on-surface-variant mb-1">{pickupPaymentLabel(order)}</p>}
     <PickupOrderActions order={order}/>
   </div>:<span className="text-[11px] text-on-surface-variant">Historical / existing order · no new rider action</span>}
   {expanded&&<div className="border-t border-outline-variant/15 pt-3 min-w-0" onClick={e=>e.stopPropagation()}>
     {renderRealOrder(order,index)}
   </div>}
   <button type="button" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded}
     className="inline-flex items-center gap-1 min-h-9 text-xs font-bold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
     {expanded?"Hide details":"View details"}{expanded?<ChevronUp size={13}/>:<ChevronDown size={13}/>}
   </button>
 </article>;
}

export function OrdersStyleBoard({entries,completedEntries=[],style,viewMode,onDemoAction,renderRealOrder,stageFilter}:{
 entries:BoardEntry[];completedEntries?:BoardEntry[];style:OrderBoardStyle;
 viewMode:"active"|"history";onDemoAction:PreviewTestPickupAction;
 renderRealOrder:(order:Order,index:number)=>React.ReactNode;
 stageFilter:"all"|"pending"|"preparing"|"ready";
}){
 const [mobileStage,setMobileStage]=useState<Stage>("pending");
 const [visibleByLane,setVisibleByLane]=useState<Record<Stage,number>>({pending:6,preparing:6,ready:6,fulfilled:6});
 useEffect(()=>setVisibleByLane({pending:6,preparing:6,ready:6,fulfilled:6}),[style,viewMode,stageFilter]);
 const roomy=style==="expediter";
 const allEntries=useMemo(()=>{
   // Only view-layer data: these are discriminated objects, never fed to API calls,
   // real counts, notifications or exports.
   if(viewMode==="history")return entries;
   const seen=new Set(entries.map(e=>`${e.kind}:${e.order.id}`));
   return [...entries,...completedEntries.filter(e=>!seen.has(`${e.kind}:${e.order.id}`))];
 },[entries,completedEntries,viewMode]);
 const counts=useMemo(()=>{
   const table={pending:{real:0,fake:0},preparing:{real:0,fake:0},ready:{real:0,fake:0},fulfilled:{real:0,fake:0}};
   for(const entry of allEntries){
     const stage=stageFor(entry);table[stage][entry.kind==="real"?"real":"fake"]++;
   }
   return table;
 },[allEntries]);

 const renderEntry=(entry:BoardEntry,index:number)=>entry.kind==="fake"
   ? <PreviewFakeOrderCard key={`fake:${entry.order.id}`} order={entry.order} onDemoAction={onDemoAction} variant={style}/>
   : <RealOrderTicket key={`real:${entry.order.id}`} order={entry.order} style={style} index={index} renderRealOrder={renderRealOrder}/>;

 if(viewMode==="history"){
   const shown=allEntries.slice(0,24);
   return <section data-testid="style-history-list" className="space-y-3">
     <p className="text-xs text-on-surface-variant">History uses the selected ticket style. Fake results remain browser-only.</p>
     <div className={`grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 min-w-0 ${roomy?"gap-4":"gap-2"}`}>
       {shown.map(renderEntry)}
     </div>
     {allEntries.length>24&&<p className="text-xs text-on-surface-variant">Showing first 24 history records. Use search or date filters to narrow results.</p>}
   </section>;
 }

 const shownLanes=stageFilter==="all"?LANES:LANES.filter(l=>l.key===stageFilter);
 return <section data-testid="dual-style-kanban" data-style={style} className="min-w-0 space-y-2">
   <div className="flex items-center justify-between gap-2 md:hidden">
     <p className="text-[11px] font-bold text-on-surface-variant">Kitchen stages</p>
     <span className="text-[11px] text-on-surface-variant">Swipe stages to select</span>
   </div>
   {stageFilter==="all"&&<div role="tablist" aria-label="Mobile kitchen lane" className="flex md:hidden gap-1.5 overflow-x-auto pb-2 max-w-full">
     {LANES.map(lane=><button key={lane.key} type="button" role="tab"
       aria-selected={mobileStage===lane.key} onClick={()=>setMobileStage(lane.key)}
       className={`shrink-0 min-h-10 rounded-full border px-3 text-xs font-bold ${mobileStage===lane.key?"bg-primary text-on-primary border-primary":"bg-surface-container-low border-outline-variant/10 text-on-surface"}`}>
       {lane.short} {counts[lane.key].real+counts[lane.key].fake}
     </button>)}
   </div>}
   <div className={`grid min-w-0 items-start grid-cols-1 ${shownLanes.length===1?"":"md:grid-cols-2 2xl:grid-cols-4"} ${roomy?"gap-3 lg:gap-4":"gap-2 lg:gap-3"}`}>
     {shownLanes.map(lane=>{
       const stageEntries=allEntries.filter(e=>stageFor(e)===lane.key);
       const limited=stageEntries.slice(0,visibleByLane[lane.key]);
       const isMobileHidden=stageFilter==="all"&&mobileStage!==lane.key;
       return <section key={lane.key} data-testid={`lane-${lane.key}`}
         className={`min-w-0 flex flex-col overflow-hidden border border-outline-variant/15 ${roomy?`rounded-2xl p-3 bg-surface-container-low/80 dark:bg-zinc-900/60`:`rounded-xl p-2 bg-surface-container-low/70 dark:bg-zinc-900/50`} ${isMobileHidden?"hidden md:flex":"flex"}`}>
         <header className={`sticky top-0 z-10 flex items-center justify-between gap-2 min-w-0 ${roomy?"pb-3 px-1":"pb-2 px-0.5"}`}>
           <div className="flex min-w-0 gap-2 items-center">
             <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${lane.dot}`}/>
             <h3 className={`truncate font-extrabold uppercase tracking-wide text-on-surface ${roomy?"text-xs":"text-[11px]"}`}>{lane.label}</h3>
           </div>
           <span className="shrink-0 rounded-full bg-surface-container-lowest dark:bg-zinc-800 border border-outline-variant/10 px-2 py-1 text-[10px] font-bold text-on-surface" aria-label={`${counts[lane.key].real} real and ${counts[lane.key].fake} fake orders`}>
             {counts[lane.key].real} real{counts[lane.key].fake>0?` · ${counts[lane.key].fake} test`:""}
           </span>
         </header>
         <div className={`min-w-0 flex flex-col ${roomy?"gap-3":"gap-2"}`}>
           {limited.length===0?<p className={`rounded-xl border border-dashed border-outline-variant/20 text-center text-xs text-on-surface-variant ${roomy?"p-8":"p-5"}`}>
             {lane.key==="pending"?"No new orders":lane.key==="preparing"?"Nothing preparing":lane.key==="ready"?"Nothing ready":"No fulfilled orders here"}
           </p>:limited.map(renderEntry)}
         </div>
         {stageEntries.length>limited.length&&<button type="button" onClick={()=>setVisibleByLane(old=>({...old,[lane.key]:old[lane.key]+6}))}
           className="min-h-10 mt-3 rounded-lg bg-surface-container-lowest dark:bg-zinc-800 text-xs font-bold text-primary border border-outline-variant/15">
           Show 6 more · {stageEntries.length-limited.length} remaining
         </button>}
       </section>;
     })}
   </div>
   <p className="text-[11px] text-on-surface-variant px-1">TEST ONLY tickets have dashed amber borders. Style changes do not change an order, payment or notification.</p>
 </section>;
}
