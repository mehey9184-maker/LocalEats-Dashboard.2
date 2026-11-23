import React,{useEffect,useMemo,useState} from "react";
import {ChevronDown, ChevronUp, Clock3, ClipboardList, ShoppingBag} from "lucide-react";
import type {Order} from "../types";
import {isPickupOrder,pickupPaymentLabel} from "../services/merchantPickupPolicy";
import {PickupOrderActions} from "./PickupOrderActions";
import {getCustomerPreparationNotes,OrderCustomerNote} from "./OrderCustomerNote";
import {PreviewFakeOrderCard,type PreviewTestPickupOrder,type PreviewTestPickupAction} from "./PreviewFakeOrders";
import {isIsolatedCloudflareMerchantPitchPreviewEnabled} from "../services/cloudflareMerchantPitchGate";

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
 const [showFull,setShowFull]=useState(false);
 const roomy=style==="expediter";
 const pickup=isPickupOrder(order);
 const fullStatus=String(order.status||"pending");
 const pitchPolish=isIsolatedCloudflareMerchantPitchPreviewEnabled();
 if(!roomy && pitchPolish){
   const status=fullStatus==="pending"?"NEW":fullStatus==="preparing"||fullStatus==="accepted"?"PREPARING":
     fullStatus==="ready"?"READY":fullStatus==="completed"?"COLLECTED":"CANCELLED";
   const special=getCustomerPreparationNotes(order).length>0;
   return <article data-testid="styled-real-order" data-style="compact"
     className="min-w-0 overflow-hidden rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 shadow-[0_5px_14px_-10px_rgba(15,23,42,0.27)]">
     <button type="button" onClick={()=>setExpanded(old=>!old)} aria-expanded={expanded}
       aria-label={`Order ${String(order.id).slice(-8)} for ${order.customer_name||"Customer"}, ${status}. ${expanded?"Hide":"Show"} actions`}
       className="flex w-full min-w-0 min-h-[64px] items-center gap-2 px-2.5 py-2 text-left hover:bg-slate-50 dark:hover:bg-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary motion-safe:transition-colors motion-safe:duration-150">
       <div className="min-w-0 flex-1 space-y-0.5">
         <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
           <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-zinc-400">#{String(order.id).slice(-8).toUpperCase()}</span>
           <span className="text-[9px] font-bold tracking-wide text-primary">{status}</span>
         </div>
         <p className="truncate text-[13px] font-extrabold leading-4 tracking-tight text-slate-900 dark:text-zinc-100">{order.customer_name||"Customer"}</p>
         <p className="text-[11px] leading-4 text-slate-600 dark:text-zinc-300 truncate">
           {order.product_name||"View order items"}{special&&<span className="ml-2 font-bold text-amber-700 dark:text-amber-300">● Special request</span>}
         </p>
       </div>
       <div className="shrink-0 text-right">
         <p className="text-xs font-extrabold tabular-nums text-slate-900 dark:text-zinc-100">{money(order.total_price)}</p>
         <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary">
           {expanded?"Close":"Actions"} <ChevronDown size={13} aria-hidden="true" className={`motion-safe:transition-transform motion-safe:duration-150 ${expanded?"rotate-180":""}`}/>
         </span>
       </div>
     </button>
     {expanded&&<div data-testid="compact-real-actions"
       className="space-y-2 border-t border-outline-variant/15 px-2.5 pb-2.5 pt-2 bg-surface-container-low/30">
       <p className="text-[11px] text-on-surface-variant font-semibold">{pickup?pickupPaymentLabel(order):"Existing order"}</p>
       <OrderCustomerNote order={order} compact/>
       {showFull?<div className="border-t border-outline-variant/15 pt-2">{renderRealOrder(order,index)}</div>
         :pickup?renderPickupControls(order,roomy):<p className="text-xs text-on-surface-variant">Existing order · no rider action</p>}
       <button type="button" onClick={()=>setShowFull(current=>!current)}
         aria-expanded={showFull}
         className="min-h-11 inline-flex items-center text-xs font-bold text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
         {showFull?"Back to quick actions":"Full order details"}
       </button>
     </div>}
   </article>;
 }
 return <article data-testid="styled-real-order" className={
   `min-w-0 overflow-hidden bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-sm ${roomy?"p-3.5 rounded-2xl space-y-2.5":"p-2.5 rounded-xl space-y-1.5"} ${pitchPolish?"border-slate-200/70 shadow-[0_7px_22px_-12px_rgba(15,23,42,0.38)] motion-safe:transition-[transform,box-shadow,border-color] motion-safe:duration-200 motion-safe:ease-out motion-safe:active:scale-[0.995] motion-safe:md:hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-13px_rgba(15,23,42,0.33)]":""}`
 }>
   <div className="flex items-start justify-between gap-2 min-w-0">
     <div className="min-w-0">
       <p className="font-mono text-[11px] font-extrabold text-slate-900 dark:text-zinc-100 break-all">#{String(order.id).slice(-9).toUpperCase()}</p>
       {roomy&&<p className="text-[10px] text-on-surface-variant mt-1">{pickup?"Counter pickup":"Existing order"}</p>}
     </div>
     <span className="text-[10px] whitespace-nowrap font-semibold text-on-surface-variant">{orderTime(order.created_at)}</span>
   </div>
   <div className="flex justify-between items-start gap-2 min-w-0">
     <p className={`min-w-0 break-words text-slate-900 dark:text-zinc-100 font-headline font-extrabold ${roomy?"text-[15px]":"text-sm"}`}>{order.customer_name||"Customer"}</p>
     <p className="font-extrabold text-slate-900 dark:text-zinc-100 text-[13px] whitespace-nowrap">{money(order.total_price)}</p>
   </div>
   <p className={`text-on-surface-variant break-words ${roomy?"text-xs":"text-[11px]"}`}>
     <ShoppingBag size={12} className="inline-block mr-1" aria-hidden="true"/>{order.product_name||"Open full order for items"}
   </p>
   <OrderCustomerNote order={order} compact={!roomy}/>
   {pickup && !expanded ? <div className={roomy?"rounded-xl bg-surface-container-low/50 p-2":"rounded-lg bg-surface-container-low/50 p-1.5"}>
     {roomy&&<p className="text-[11px] text-on-surface-variant mb-1">{pickupPaymentLabel(order)}</p>}
     {renderPickupControls(order,roomy)}
   </div>:!pickup && !expanded ? <span className="text-[11px] text-on-surface-variant">Historical / existing order · no new rider action</span> : null}
   {expanded&&<div className="border-t border-outline-variant/15 pt-3 min-w-0" onClick={e=>e.stopPropagation()}>
     {renderRealOrder(order,index)}
   </div>}
   <button type="button" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded}
     className="inline-flex items-center gap-1 min-h-9 text-xs font-bold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
     {expanded?"Hide details":"View details"}{expanded?<ChevronUp size={13}/>:<ChevronDown size={13}/>}
   </button>
 </article>;
}

// One shared actions renderer: neither compact disclosure nor full details duplicates controls.
function renderPickupControls(order:Order,roomy:boolean){
 return <PickupOrderActions order={order} compact={!roomy}/>;
}

export function OrdersStyleBoard({entries,completedEntries=[],style,viewMode,onDemoAction,renderRealOrder,stageFilter}:{
 entries:BoardEntry[];completedEntries?:BoardEntry[];style:OrderBoardStyle;
 viewMode:"active"|"history";onDemoAction:PreviewTestPickupAction;
 renderRealOrder:(order:Order,index:number)=>React.ReactNode;
 stageFilter:"all"|"pending"|"preparing"|"ready";
}){
 const [mobileStage,setMobileStage]=useState<Stage>("pending");
 const [visibleByLane,setVisibleByLane]=useState<Record<Stage,number>>({pending:6,preparing:6,ready:6,fulfilled:6});
 const [visibleHistory,setVisibleHistory]=useState(24);
 // Compact is a scan-first queue: display more concise rows before paging.
 const laneWindow=style==="compact"&&isIsolatedCloudflareMerchantPitchPreviewEnabled()?16:6;
 useEffect(()=>setVisibleByLane({pending:laneWindow,preparing:laneWindow,ready:laneWindow,fulfilled:laneWindow}),[laneWindow,style,viewMode,stageFilter]);
 useEffect(()=>setVisibleHistory(24),[style,viewMode,stageFilter]);
 const roomy=style==="expediter";
 const compact=style==="compact";
 const pitchPolish=isIsolatedCloudflareMerchantPitchPreviewEnabled();
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
   const shown=allEntries.slice(0,visibleHistory);
   return <section data-testid="style-history-list" className="space-y-3">
     <p className="text-xs text-on-surface-variant">History uses your selected ticket style.{allEntries.some(e=>e.kind==="fake")?" Fake results are browser-only.":""}</p>
     <div className={`grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 min-w-0 ${roomy?"gap-4":"gap-2"}`}>
       {shown.map(renderEntry)}
     </div>
     {allEntries.length>shown.length&&<button
       type="button"
       onClick={()=>setVisibleHistory(count=>count+24)}
       className="min-h-11 w-full rounded-xl border border-outline-variant/20 bg-surface-container-lowest text-xs font-bold text-primary"
     >
       Show 24 more history orders · {allEntries.length-shown.length} remaining
     </button>}
   </section>;
 }

 const shownLanes=stageFilter==="all"?LANES:LANES.filter(l=>l.key===stageFilter);
 return <section data-testid="dual-style-kanban" data-style={style} className="min-w-0 space-y-2">
   {/* One equal-width mobile stage switcher replaces the clipped horizontal tabs.
       Stage names remain complete for screen readers and manual pickup tests. */}
   {stageFilter==="all"&&<div role="tablist" aria-label="Mobile kitchen lane"
     data-testid="mobile-kitchen-stages" className="grid grid-cols-4 md:hidden min-w-0 gap-1 pb-1">
     {LANES.map(lane=><button key={lane.key} type="button" role="tab"
       aria-label={`${lane.label} stage`}
       aria-selected={mobileStage===lane.key} onClick={()=>setMobileStage(lane.key)}
       className={`min-w-0 min-h-11 rounded-full border px-1 text-[11px] font-bold whitespace-nowrap ${mobileStage===lane.key?"bg-primary text-on-primary border-primary":"bg-surface-container-low border-outline-variant/10 text-on-surface"} ${pitchPolish?"tracking-tight motion-safe:transition-[background-color,box-shadow,transform] motion-safe:duration-200 motion-safe:active:scale-[0.97]":""} ${pitchPolish&&mobileStage===lane.key?"shadow-[0_5px_13px_-8px_rgba(249,115,22,0.75)]":""}`}>
       {lane.key==="preparing"?"Prep":lane.key==="fulfilled"?"Done":lane.short}
       <span className="ml-1 tabular-nums">{counts[lane.key].real+counts[lane.key].fake}</span>
     </button>)}
   </div>}
   <div className={`grid min-w-0 items-start grid-cols-1 ${shownLanes.length===1?"":"md:grid-cols-2 2xl:grid-cols-4"} ${compact?"gap-2 lg:gap-3":"gap-3 lg:gap-4"}`}>
     {shownLanes.map(lane=>{
       const stageEntries=allEntries.filter(e=>stageFor(e)===lane.key);
       const limited=stageEntries.slice(0,visibleByLane[lane.key]);
       const isMobileHidden=stageFilter==="all"&&mobileStage!==lane.key;
       return <section key={lane.key} data-testid={`lane-${lane.key}`}
         className={`min-w-0 flex flex-col overflow-hidden border border-outline-variant/15 ${roomy?`rounded-2xl p-3 bg-surface-container-low/80 dark:bg-zinc-900/60`:`rounded-xl p-2 bg-surface-container-low/70 dark:bg-zinc-900/50`} ${isMobileHidden?"hidden md:flex":"flex"} ${pitchPolish?"border-slate-200/65 dark:border-zinc-800/80 shadow-[0_8px_20px_-17px_rgba(15,23,42,0.3)]":""}`}>
         <header className={`sticky top-0 z-10 flex items-center justify-between gap-2 min-w-0 ${roomy?"pb-3 px-1":"pb-2 px-0.5"}`}>
           <div className="flex min-w-0 gap-2 items-center">
             <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${lane.dot}`}/>
             <h3 className={`truncate font-extrabold uppercase tracking-wide text-on-surface ${roomy?"text-xs":"text-[11px]"}`}>{lane.label}</h3>
           </div>
           <span className="shrink-0 rounded-full bg-surface-container-lowest dark:bg-zinc-800 border border-outline-variant/10 px-2 py-1 text-[10px] font-bold text-on-surface" aria-label={`${counts[lane.key].real} real and ${counts[lane.key].fake} fake orders`}>
             {counts[lane.key].real} real{counts[lane.key].fake>0?` · ${counts[lane.key].fake} test`:""}
           </span>
         </header>
         <div className={`min-w-0 flex flex-col ${roomy?"gap-3":pitchPolish?"gap-1.5":"gap-2"}`}>
           {limited.length===0?<p className={`rounded-xl border border-dashed border-outline-variant/20 text-center text-xs text-on-surface-variant ${roomy?"p-8":"p-5"}`}>
             {lane.key==="pending"?"No new orders":lane.key==="preparing"?"Nothing preparing":lane.key==="ready"?"Nothing ready":"No fulfilled orders here"}
           </p>:limited.map(renderEntry)}
         </div>
         {stageEntries.length>limited.length&&<button type="button" onClick={()=>setVisibleByLane(old=>({...old,[lane.key]:old[lane.key]+laneWindow}))}
           className="min-h-10 mt-3 rounded-lg bg-surface-container-lowest dark:bg-zinc-800 text-xs font-bold text-primary border border-outline-variant/15">
           {laneWindow===6?"Show 6 more":`Show ${laneWindow} more`} · {stageEntries.length-limited.length} remaining
         </button>}
       </section>;
     })}
   </div>
   {allEntries.some(e=>e.kind==="fake")&&<p className="text-[11px] text-on-surface-variant px-1">TEST ONLY tickets have dashed amber borders. Style changes do not change an order, payment or notification.</p>}
 </section>;
}
