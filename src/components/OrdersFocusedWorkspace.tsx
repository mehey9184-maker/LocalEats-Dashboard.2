import React, {useEffect, useMemo, useState} from "react";
import {Bell, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Clock3, MoreHorizontal, RefreshCw, Search, ShieldCheck, SlidersHorizontal, X} from "lucide-react";
import type {Order} from "../types";
import {PickupOrderActions} from "./PickupOrderActions";
import {isPickupOrder, pickupPaymentLabel} from "../services/merchantPickupPolicy";
import {PreviewFakeOrderCard, PreviewFakeOrderTrigger, type PreviewTestPickupOrder, type PreviewTestPickupAction} from "./PreviewFakeOrders";

type ViewMode = "active" | "history";
type Stage = "all" | "pending" | "preparing" | "ready";
type SortMode = "priority" | "newest" | "oldest" | "highest";
type Entry = {kind:"real";order:Order} | {kind:"fake";order:PreviewTestPickupOrder};

interface OrdersFocusedWorkspaceProps {
  realOrders: Order[];
  fakeOrders: PreviewTestPickupOrder[];
  onDemoAction: PreviewTestPickupAction;
  incoming: boolean;
  onSimulate: () => void;
  onClear: () => void;
  viewMode: ViewMode;
  onViewModeChange: (next: ViewMode) => void;
  renderRealOrder: (order: Order, index: number) => React.ReactNode;
  onRefresh: () => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
  onDeleteAllOrders: () => void;
  readOnly: boolean;
  soundAlerts: boolean;
  setSoundAlerts: (enabled: boolean) => void;
  kitchenMode: boolean;
  setKitchenMode: (enabled: boolean) => void;
  maxConcurrentOrders: number;
  setMaxConcurrentOrders: (count: number) => void;
  startDate: string;
  endDate: string;
  setStartDate: (value: string) => void;
  setEndDate: (value: string) => void;
}

const PAGE_SIZE=12;
const priority: Record<string,number>={pending:0,accepted:1,preparing:1,ready:2,completed:3,cancelled:4};
const statusText: Record<string,string>={
  pending:"New",accepted:"Preparing",preparing:"Preparing",ready:"Ready",
  completed:"Completed",cancelled:"Cancelled"
};
const statusClass:Record<string,string>={
  pending:"bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-200",
  accepted:"bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-200",
  preparing:"bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-200",
  ready:"bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-200",
  completed:"bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-200",
  cancelled:"bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-200"
};
const entryStatus=(entry:Entry)=>entry.order.status;
const dateValue=(entry:Entry)=>Date.parse(entry.order.created_at||"")||0;
const priceValue=(entry:Entry)=>Number(entry.order.total_price)||0;
const currency=(value:unknown)=> {
  const number=Number(value);
  return Number.isFinite(number) && number>=0 ? `R ${number.toFixed(2)}` : "Amount unavailable";
};
const stageMatches=(stage:Stage,status:string)=>
  stage==="all" || (stage==="preparing"?status==="accepted"||status==="preparing":status===stage);

export function OrdersFocusedWorkspace(props:OrdersFocusedWorkspaceProps){
  const {
    realOrders,fakeOrders,onDemoAction,incoming,onSimulate,onClear,viewMode,onViewModeChange,
    renderRealOrder,onRefresh,onExportCSV,onExportJSON,onDeleteAllOrders,readOnly,
    soundAlerts,setSoundAlerts,kitchenMode,setKitchenMode,maxConcurrentOrders,setMaxConcurrentOrders,
    startDate,endDate,setStartDate,setEndDate
  }=props;
  const [stage,setStage]=useState<Stage>("all");
  const [sort,setSort]=useState<SortMode>("priority");
  const [search,setSearch]=useState("");
  const [page,setPage]=useState(1);
  const [expanded,setExpanded]=useState<string|null>(null);
  const [showSearch,setShowSearch]=useState(false);

  const activeFake=useMemo(()=>fakeOrders.filter(order=>viewMode==="active"
    ? order.status!=="completed"&&order.status!=="cancelled"
    : order.status==="completed"||order.status==="cancelled"),[fakeOrders,viewMode]);
  const stageCounts=useMemo(()=>{
    const statuses=[...realOrders.map(order=>order.status),...activeFake.map(order=>order.status)];
    return {
      all:statuses.length,
      pending:statuses.filter(status=>status==="pending").length,
      preparing:statuses.filter(status=>status==="preparing"||status==="accepted").length,
      ready:statuses.filter(status=>status==="ready").length,
    };
  },[realOrders,activeFake]);

  const filtered=useMemo(()=>{
    const entries:Entry[]=[
      ...realOrders.map(order=>({kind:"real" as const,order})),
      ...activeFake.map(order=>({kind:"fake" as const,order})),
    ];
    const q=search.trim().toLowerCase();
    return entries.filter(entry=>{
      const order=entry.order;
      const matchesStage=viewMode==="history" || stageMatches(stage,entryStatus(entry));
      const matchesSearch=!q || [order.id,order.customer_name,order.product_name]
        .some(value=>String(value??"").toLowerCase().includes(q));
      return matchesStage && matchesSearch;
    }).sort((a,b)=>{
      if(sort==="highest")return priceValue(b)-priceValue(a)||dateValue(b)-dateValue(a);
      if(sort==="oldest")return dateValue(a)-dateValue(b);
      if(sort==="newest")return dateValue(b)-dateValue(a);
      const pa=priority[entryStatus(a)]??9,pb=priority[entryStatus(b)]??9;
      return pa-pb||dateValue(b)-dateValue(a);
    });
  },[realOrders,activeFake,viewMode,stage,search,sort]);
  const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const safePage=Math.min(page,pages);
  const visible=filtered.slice((safePage-1)*PAGE_SIZE,safePage*PAGE_SIZE);
  useEffect(()=>setPage(1),[viewMode,stage,sort,search]);

  const enterView=(mode:ViewMode)=>{setStage("all");setExpanded(null);onViewModeChange(mode);};
  const testArrival=()=>{setStage("all");onViewModeChange("active");setPage(1);onSimulate();};
  const realActive=realOrders.length;
  const fakeActive=activeFake.length;
  const commonFocus="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
  return (
    <main data-testid="orders-focused-workspace" className="space-y-3 md:space-y-4 pb-28 md:pb-10 min-w-0 max-w-full">
      <div className="rounded-[1.4rem] border border-outline-variant/10 bg-surface-container-lowest dark:bg-zinc-950 px-3 py-3 sm:px-5 sm:py-4 shadow-sm space-y-3">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <ClipboardList size={20} aria-hidden="true"/>
            </div>
            <div className="min-w-0">
              <h1 className="font-headline font-extrabold text-xl sm:text-2xl tracking-tight text-on-surface">Orders</h1>
              <p className="text-[11px] sm:text-xs text-on-surface-variant">Pickup-first kitchen queue</p>
            </div>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <button type="button" onClick={onRefresh} aria-label="Refresh real orders"
              className={`inline-flex min-h-10 items-center gap-1.5 px-3 rounded-xl border border-outline-variant/20 bg-surface-container-low text-xs font-semibold text-on-surface ${commonFocus}`}>
              <RefreshCw size={15} aria-hidden="true"/><span className="hidden sm:inline">Refresh</span>
            </button>
            <PreviewFakeOrderTrigger incoming={incoming} count={fakeOrders.length} onSimulate={testArrival} onClear={onClear}/>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center rounded-xl bg-surface-container-low p-1 gap-1">
            <button type="button" onClick={()=>enterView("active")} aria-pressed={viewMode==="active"}
              className={`min-h-9 rounded-lg px-3 text-xs font-bold transition-colors ${viewMode==="active"?"bg-surface-container-lowest text-primary shadow-sm":"text-on-surface-variant"} ${commonFocus}`}>
              Current <span className="opacity-75">{viewMode==="active"?realActive:""}</span>
            </button>
            <button type="button" onClick={()=>enterView("history")} aria-pressed={viewMode==="history"}
              className={`min-h-9 rounded-lg px-3 text-xs font-bold transition-colors ${viewMode==="history"?"bg-surface-container-lowest text-primary shadow-sm":"text-on-surface-variant"} ${commonFocus}`}>
              History
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 items-center text-[11px]">
            <span className="px-2.5 py-1 rounded-full bg-surface-container-low text-on-surface-variant font-bold">{realActive} real</span>
            {fakeActive>0&&<span className="px-2.5 py-1 rounded-full border border-amber-300 bg-amber-100 text-amber-900 font-bold">{fakeActive} test</span>}
            <details className="relative group">
              <summary className={`list-none cursor-pointer min-h-9 inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/20 px-2.5 text-xs font-bold text-on-surface select-none ${commonFocus}`}>
                <MoreHorizontal size={16} aria-hidden="true"/> Tools <ChevronDown size={12} aria-hidden="true"/>
              </summary>
              <div className="absolute z-30 right-0 top-full mt-2 w-64 max-w-[80vw] bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-xl p-3 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">Secondary tools</p>
                <button type="button" onClick={onExportCSV} className="w-full rounded-lg text-left px-3 py-2 text-xs font-semibold hover:bg-surface-container-low">Export spreadsheet</button>
                <button type="button" onClick={onExportJSON} className="w-full rounded-lg text-left px-3 py-2 text-xs font-semibold hover:bg-surface-container-low">Backup order data</button>
                <label className="flex items-center justify-between gap-3 text-xs font-semibold p-2"><span>Sound alerts</span>
                  <input type="checkbox" checked={soundAlerts} onChange={e=>setSoundAlerts(e.target.checked)} className="accent-primary w-4 h-4"/>
                </label>
                <label className="flex items-center justify-between gap-3 text-xs font-semibold p-2"><span>Kitchen mode</span>
                  <input type="checkbox" checked={kitchenMode} onChange={e=>setKitchenMode(e.target.checked)} className="accent-primary w-4 h-4"/>
                </label>
                <label className="block text-xs font-semibold px-2">Active order limit: {maxConcurrentOrders}
                  <input type="range" min="1" max="50" value={maxConcurrentOrders} onChange={e=>setMaxConcurrentOrders(Number(e.target.value))} className="w-full accent-primary mt-2"/>
                </label>
                <button type="button" onClick={onDeleteAllOrders} disabled={readOnly}
                  className="w-full text-left text-xs rounded-lg px-3 py-2 text-error font-bold hover:bg-error/5 disabled:opacity-35 disabled:cursor-not-allowed"
                  title={readOnly?"Disabled in read-only Preview":"Remove all real orders"}>Clear all real orders</button>
              </div>
            </details>
          </div>
        </div>
      </div>

      <details className="rounded-xl bg-amber-50/75 dark:bg-amber-950/15 border border-amber-200/60 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
        <summary className="cursor-pointer flex items-center gap-2 font-semibold">
          <ShieldCheck size={15} aria-hidden="true"/> Pickup actions disabled for real orders in this Preview
          <ChevronDown size={13} aria-hidden="true" className="ml-auto"/>
        </summary>
        <p className="pt-2 text-[11px] leading-relaxed">Only fake test cards can simulate Accept, Ready, payment and collection. Actual changes require separately approved database activation. The real queue, exports and reporting never include fake orders.</p>
      </details>

      <div className="bg-surface-container-lowest dark:bg-zinc-950 border border-outline-variant/10 rounded-[1.4rem] p-3 sm:p-4 shadow-sm space-y-3 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-headline text-base sm:text-lg font-bold text-on-surface">{viewMode==="active"?"Kitchen queue":"Order history"}</h2>
            <p className="text-[11px] text-on-surface-variant">{viewMode==="active"?"New orders first, ready orders next":"Only completed and cancelled real orders, plus labelled simulations"}</p>
          </div>
          <button type="button" onClick={()=>setShowSearch(!showSearch)}
            aria-pressed={showSearch} aria-label={showSearch?"Close order search":"Search orders"}
            className={`h-10 w-10 flex items-center justify-center rounded-xl bg-surface-container-low ${commonFocus}`}>
            {showSearch?<X size={17}/>:<Search size={17}/>}
          </button>
        </div>
        {showSearch&&<div className="flex gap-2 items-center rounded-xl border border-outline-variant/25 bg-surface-container-lowest px-3 py-2">
          <Search size={16} aria-hidden="true" className="text-on-surface-variant shrink-0"/>
          <input autoFocus type="search" aria-label="Search order ID, customer or product"
            value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search orders…" className="min-w-0 flex-1 bg-transparent text-sm text-on-surface outline-none"/>
        </div>}
        <div className="flex items-center justify-between gap-2 min-w-0">
          {viewMode==="active"?<div role="group" aria-label="Queue status" className="flex min-w-0 overflow-x-auto gap-1.5 pb-1">
            {([{key:"all",label:"All"},{key:"pending",label:"New"},{key:"preparing",label:"Preparing"},{key:"ready",label:"Ready"}] as const).map(item=>(
              <button key={item.key} type="button" aria-pressed={stage===item.key}
                onClick={()=>{setStage(item.key);setPage(1);}}
                className={`shrink-0 min-h-9 rounded-full px-3 text-xs font-bold border transition-colors ${stage===item.key?"bg-primary text-on-primary border-primary":"bg-surface-container-low text-on-surface-variant border-transparent"} ${commonFocus}`}>
                {item.label} <span className={`ml-1 ${stage===item.key?"opacity-80":"opacity-60"}`}>{stageCounts[item.key]}</span>
              </button>
            ))}
          </div>:<div className="flex flex-wrap items-center gap-2 text-[11px] text-on-surface-variant">
            <Clock3 size={14} aria-hidden="true"/> Archived orders
          </div>}
          <select value={sort} onChange={e=>setSort(e.target.value as SortMode)}
            aria-label="Sort orders" className="shrink-0 max-w-[110px] sm:max-w-none rounded-lg bg-surface-container-low text-on-surface text-xs font-semibold px-2 py-2 border border-outline-variant/10">
            <option value="priority">Priority</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="highest">Highest R</option>
          </select>
        </div>
        {viewMode==="history"&&<div className="flex flex-wrap gap-2 text-xs text-on-surface-variant">
          <label>From <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="rounded-lg border border-outline-variant/20 px-2 py-1.5 bg-surface-container-lowest text-on-surface"/></label>
          <label>To <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="rounded-lg border border-outline-variant/20 px-2 py-1.5 bg-surface-container-lowest text-on-surface"/></label>
        </div>}

        <div aria-live="polite" className="sr-only">Showing {visible.length} of {filtered.length} orders on page {safePage}</div>
        {filtered.length===0?(
          <div className="min-h-44 rounded-2xl border border-dashed border-outline-variant/25 bg-surface-container-low/40 text-center flex flex-col items-center justify-center gap-2 p-5">
            <CheckCircle2 size={23} className="text-primary/60" aria-hidden="true"/>
            <p className="text-sm font-bold text-on-surface">{search?"Nothing matches that search":viewMode==="history"?"No history for this view":"No orders in this view"}</p>
            <p className="text-xs text-on-surface-variant max-w-sm">{viewMode==="active"?"Use Simulate order to test the real pickup UI without creating any actual orders.":"Completed and cancelled orders will appear here when verified."}</p>
          </div>
        ):(
          <div data-testid="focused-order-grid" className="grid grid-cols-1 xl:grid-cols-2 gap-3 min-w-0 items-start">
            {visible.map((entry,index)=>{
              if(entry.kind==="fake")return <PreviewFakeOrderCard key={`fake:${entry.order.id}`} order={entry.order} onDemoAction={onDemoAction}/>;
              const order=entry.order;
              const status=String(order.status||"pending");
              const isExpanded=expanded===order.id;
              return <article key={`real:${order.id}`} data-testid="focused-real-order"
                className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest shadow-xs p-3 sm:p-4 min-w-0 space-y-3">
                <div className="flex items-start gap-3 justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-extrabold text-on-surface">#{String(order.id).slice(-8).toUpperCase()}</span>
                      <span className={`text-[10px] font-bold border rounded-full px-2 py-0.5 ${statusClass[status]||statusClass.pending}`}>
                        {statusText[status]||"In progress"}
                      </span>
                    </div>
                    <p className="font-semibold text-sm text-on-surface mt-1 truncate">{order.customer_name||"Customer"}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5 break-words">{order.product_name||"Order items"} · {currency(order.total_price)}</p>
                  </div>
                  <span className="text-[11px] font-semibold text-on-surface-variant whitespace-nowrap">
                    {order.created_at&&!Number.isNaN(new Date(order.created_at).getTime()) ? new Date(order.created_at).toLocaleTimeString("en-ZA",{hour:"2-digit",minute:"2-digit"}) : "Time unavailable"}
                  </span>
                </div>
                {!isExpanded&&isPickupOrder(order)&&<div className="rounded-xl bg-surface-container-low/50 px-3">
                  <p className="text-[11px] text-on-surface-variant pt-2">{pickupPaymentLabel(order)}</p>
                  <PickupOrderActions order={order}/>
                </div>}
                {isExpanded&&<div className="min-w-0">{renderRealOrder(order,index)}</div>}
                <button type="button" onClick={()=>setExpanded(isExpanded?null:order.id)}
                  aria-expanded={isExpanded}
                  className={`text-xs font-bold text-primary min-h-9 flex items-center gap-1 ${commonFocus}`}>
                  {isExpanded?"Hide full order":"View full order"}<ChevronDown size={13} aria-hidden="true" className={isExpanded?"rotate-180":""}/>
                </button>
              </article>;
            })}
          </div>
        )}
        {pages>1&&<div className="flex items-center justify-between gap-3 pt-2 border-t border-outline-variant/10">
          <span className="text-xs text-on-surface-variant">Page {safePage} of {pages} · {filtered.length} orders</span>
          <div className="flex gap-2">
            <button type="button" disabled={safePage<=1} onClick={()=>setPage(n=>Math.max(1,n-1))}
              className="min-h-10 rounded-xl border border-outline-variant/20 px-3 text-xs font-bold disabled:opacity-30"><ChevronLeft size={15}/><span className="sr-only">Previous page</span></button>
            <button type="button" disabled={safePage>=pages} onClick={()=>setPage(n=>Math.min(pages,n+1))}
              className="min-h-10 rounded-xl border border-outline-variant/20 px-3 text-xs font-bold disabled:opacity-30"><ChevronRight size={15}/><span className="sr-only">Next page</span></button>
          </div>
        </div>}
      </div>
      <p className="text-center text-[11px] text-on-surface-variant px-3">
        <Bell size={12} aria-hidden="true" className="inline mr-1"/> Fake orders are browser-only training cards. Real payments, notifications and fulfillment remain disabled until separately approved.
      </p>
    </main>
  );
}
