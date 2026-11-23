import React, {useEffect, useMemo, useState} from "react";
import {Bell, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Clock3, MoreHorizontal, RefreshCw, Search, ShieldCheck, X} from "lucide-react";
import type {Order} from "../types";
import {PickupOrderActions} from "./PickupOrderActions";
import {isPickupOrder, pickupPaymentLabel} from "../services/merchantPickupPolicy";
import {PreviewFakeOrderTrigger, type PreviewTestPickupOrder, type PreviewTestPickupAction} from "./PreviewFakeOrders";
import {OrdersStyleBoard, type OrderBoardStyle, type BoardEntry} from "./OrdersStyleBoard";
import {isMerchantPreviewSimulatorEnabled} from "../services/merchantPreviewSimulator";
import {isIsolatedCloudflareMerchantPitchPreviewEnabled} from "../services/cloudflareMerchantPitchGate";
import {pickupOrderingEnabled} from "../services/merchantPickupPolicy";

type ViewMode = "active" | "history";
type Stage = "all" | "pending" | "preparing" | "ready";
type SortMode = "priority" | "newest" | "oldest" | "highest";
type Entry = BoardEntry;

interface OrdersFocusedWorkspaceProps {
  realOrders: Order[];
  fakeOrders: PreviewTestPickupOrder[];
  onDemoAction: PreviewTestPickupAction;
  incoming: boolean;
  onSimulate: () => void;
  onSimulateBatch: () => void;
  onClear: () => void;
  simulationRunning: boolean;
  onStartSimulation: () => void;
  onStopSimulation: () => void;
  onOpenHelp?: () => void;
  onOpenLegal?: () => void;
  onOpenDiagnostics?: () => void;
  demoNotificationsEnabled: boolean;
  onToggleDemoNotifications: () => void;
  styleStorageKey: string;
  completedRealOrders: Order[];
  viewMode: ViewMode;
  onViewModeChange: (next: ViewMode) => void;
  renderRealOrder: (order: Order, index: number) => React.ReactNode;
  onRefresh: () => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
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
function readBoardStyle(key:string):OrderBoardStyle{
  if(typeof window==="undefined")return "compact";
  const fallback=isIsolatedCloudflareMerchantPitchPreviewEnabled()?"expediter":"compact";
  try{
    const stored=window.localStorage.getItem(key);
    return stored==="expediter"||stored==="compact"?stored:fallback;
  }catch{return fallback;}
}
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
    realOrders,fakeOrders,onDemoAction,incoming,onSimulate,onSimulateBatch,onClear,simulationRunning,onStartSimulation,onStopSimulation,onOpenHelp,onOpenLegal,onOpenDiagnostics,demoNotificationsEnabled,onToggleDemoNotifications,styleStorageKey,completedRealOrders,viewMode,onViewModeChange,
    renderRealOrder,onRefresh,onExportCSV,onExportJSON,
    soundAlerts,setSoundAlerts,kitchenMode,setKitchenMode,maxConcurrentOrders,setMaxConcurrentOrders,
    startDate,endDate,setStartDate,setEndDate
  }=props;
  const [stage,setStage]=useState<Stage>("all");
  const [sort,setSort]=useState<SortMode>("priority");
  const [search,setSearch]=useState("");
  const [page,setPage]=useState(1);
  const [expanded,setExpanded]=useState<string|null>(null);
  const [showSearch,setShowSearch]=useState(false);
  const isTestPreview=isMerchantPreviewSimulatorEnabled();
  const pitchPolish=isIsolatedCloudflareMerchantPitchPreviewEnabled(); // Strict demo-host-only visual treatment.
  const [boardStyle,setBoardStyle]=useState<OrderBoardStyle>(()=>readBoardStyle(styleStorageKey));
  useEffect(()=>setBoardStyle(readBoardStyle(styleStorageKey)),[styleStorageKey]);
  const chooseBoardStyle=(choice:OrderBoardStyle)=>{
    setBoardStyle(choice);
    // Only a harmless style enum is stored; no order, customer, payment or login data.
    if(typeof window!=="undefined")try{window.localStorage.setItem(styleStorageKey,choice);}catch{}
  };


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
  const testBatch=()=>{setStage("all");onViewModeChange("active");setPage(1);onSimulateBatch();};
  const realActive=realOrders.length;
  const fakeActive=activeFake.length;
  const commonFocus="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
  return (
    <main data-testid="orders-focused-workspace" className="space-y-3 md:space-y-4 pb-28 md:pb-10 min-w-0 max-w-full">
      <div data-testid="orders-mobile-header" className={`rounded-[1.4rem] border border-outline-variant/10 bg-surface-container-lowest dark:bg-zinc-950 px-3 py-3 sm:px-5 sm:py-4 shadow-sm space-y-3 ${pitchPolish?"border-white/70 dark:border-zinc-800/80 bg-white/95 shadow-[0_9px_28px_-17px_rgba(15,23,42,0.38)]":""}`}>
        {/* The same original controls, laid out as a compact mobile header. */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 sm:flex sm:flex-wrap sm:justify-between sm:gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <ClipboardList size={20} aria-hidden="true"/>
            </div>
            <div className="min-w-0">
              <h1 className={`font-headline font-extrabold text-xl sm:text-2xl tracking-tight text-on-surface ${pitchPolish?"leading-tight antialiased":""}`}>Orders</h1>
              <p className={`text-[11px] sm:text-xs text-on-surface-variant ${pitchPolish?"leading-relaxed tracking-[0.005em]":""}`}>Pickup-first kitchen queue</p>
            </div>
          </div>
          <button type="button" onClick={onRefresh} aria-label="Refresh real orders"
            className={`inline-flex h-11 min-w-11 items-center justify-center gap-1.5 px-3 rounded-xl border border-outline-variant/20 bg-surface-container-low text-xs font-semibold text-on-surface ${pitchPolish?"motion-safe:transition-[background-color,transform,box-shadow] motion-safe:duration-200 active:scale-[0.98] hover:shadow-sm":""} ${commonFocus}`}>
            <RefreshCw size={15} aria-hidden="true"/><span className="hidden sm:inline">Refresh</span>
          </button>
          <div className="col-span-2 min-w-0 w-full sm:col-span-1 sm:w-auto">
            <PreviewFakeOrderTrigger incoming={incoming} count={fakeOrders.length} onSimulate={testArrival} onClear={onClear}
              simulationRunning={simulationRunning} onStartSimulation={onStartSimulation} onStopSimulation={onStopSimulation}
              demoNotificationsEnabled={demoNotificationsEnabled} onToggleDemoNotifications={onToggleDemoNotifications}/>
          </div>
        </div>

        <div className="hidden sm:flex flex-wrap items-center justify-between gap-2">
          <div role="group" aria-label="Choose your Orders style" className="flex items-center gap-1 rounded-xl bg-surface-container-low p-1">
            <button type="button" aria-pressed={boardStyle==="expediter"} onClick={()=>chooseBoardStyle("expediter")}
              className={`min-h-9 px-3 rounded-lg text-xs font-bold ${boardStyle==="expediter"?"bg-surface-container-lowest shadow-sm text-primary":"text-on-surface-variant"}`}>
              A · Expediter
            </button>
            <button type="button" aria-pressed={boardStyle==="compact"} onClick={()=>chooseBoardStyle("compact")}
              className={`min-h-9 px-3 rounded-lg text-xs font-bold ${boardStyle==="compact"?"bg-surface-container-lowest shadow-sm text-primary":"text-on-surface-variant"}`}>
              B · Compact
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center rounded-xl bg-surface-container-low p-1 gap-1">
            <button type="button" onClick={()=>enterView("active")} aria-pressed={viewMode==="active"}
              className={`min-h-11 rounded-lg px-2 sm:px-3 text-xs font-bold transition-colors ${viewMode==="active"?"bg-surface-container-lowest text-primary shadow-sm":"text-on-surface-variant"} ${commonFocus}`}>
              Current <span className="opacity-75">{viewMode==="active"?realActive:""}</span>
            </button>
            <button type="button" onClick={()=>enterView("history")} aria-pressed={viewMode==="history"}
              className={`min-h-11 rounded-lg px-2 sm:px-3 text-xs font-bold transition-colors ${viewMode==="history"?"bg-surface-container-lowest text-primary shadow-sm":"text-on-surface-variant"} ${commonFocus}`}>
              History
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 items-center text-[11px]">
            <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full bg-surface-container-low text-on-surface-variant font-bold">{realActive} real</span>
            {fakeActive>0&&<span className="hidden sm:inline-flex px-2.5 py-1 rounded-full border border-amber-300 bg-amber-100 text-amber-900 font-bold">{fakeActive} test</span>}
            <details className="relative group">
              <summary className={`list-none cursor-pointer min-h-11 inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/20 px-2.5 text-xs font-bold text-on-surface select-none ${commonFocus}`}>
                <MoreHorizontal size={16} aria-hidden="true"/> Tools <ChevronDown size={12} aria-hidden="true"/>
              </summary>
              <div className="absolute z-30 right-0 top-full mt-2 w-64 max-w-[80vw] bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-xl p-3 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">Secondary tools</p>
                {isTestPreview&&<div className="space-y-2 sm:hidden">
                  <button type="button" onClick={testArrival} aria-label="Simulate one fake incoming pickup order"
                    className="min-h-11 w-full text-left rounded-lg bg-amber-50 text-amber-950 px-3 text-xs font-bold">
                    Simulate one fake order
                  </button>
                  {fakeOrders.length>0&&<button type="button" onClick={onClear}
                    className="min-h-11 w-full text-left rounded-lg px-3 text-xs font-bold text-amber-800 dark:text-amber-200">
                    Clear all test orders ({fakeOrders.length})
                  </button>}
                  <div role="group" aria-label="Choose your mobile ticket style" className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">Ticket display</p>
                    <p className="text-[11px] leading-4 text-on-surface-variant">
                      A: full order &amp; actions. B: scan many orders, tap any row for actions.
                    </p>
                    <div className="flex gap-1.5">
                      <button type="button" onClick={event=>{chooseBoardStyle("expediter");event.currentTarget.closest("details")?.removeAttribute("open");}} aria-pressed={boardStyle==="expediter"}
                        className={`min-h-11 flex-1 rounded-lg px-2 text-xs font-bold ${boardStyle==="expediter"?"bg-primary text-on-primary":"bg-surface-container-low text-on-surface"}`}>
                        A · Expediter
                      </button>
                      <button type="button" onClick={event=>{chooseBoardStyle("compact");event.currentTarget.closest("details")?.removeAttribute("open");}} aria-pressed={boardStyle==="compact"}
                        className={`min-h-11 flex-1 rounded-lg px-2 text-xs font-bold ${boardStyle==="compact"?"bg-primary text-on-primary":"bg-surface-container-low text-on-surface"}`}>
                        B · Compact
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button type="button" onClick={onOpenHelp}
                      className="min-h-11 rounded-lg bg-surface-container-low px-2 text-xs font-semibold text-on-surface">
                      Help & Tips
                    </button>
                    <button type="button" onClick={onOpenLegal}
                      className="min-h-11 rounded-lg bg-surface-container-low px-2 text-xs font-semibold text-on-surface">
                      Legal & Privacy
                    </button>
                  </div>
                  <button type="button" onClick={onOpenDiagnostics}
                    className="min-h-11 w-full rounded-lg bg-surface-container-low px-3 text-xs font-semibold text-on-surface">
                    System diagnostics
                  </button>
                </div>}
                {isTestPreview&&<button type="button" onClick={testBatch} className="w-full rounded-lg text-left px-3 py-2 text-xs font-bold bg-amber-50 text-amber-900 hover:bg-amber-100 dark:bg-amber-950/20 dark:text-amber-100">Test busy queue · +24 FAKE orders</button>}
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

              </div>
            </details>
          </div>
        </div>
      </div>

      {isTestPreview ? (
        <details className="rounded-xl bg-amber-50/75 dark:bg-amber-950/15 border border-amber-200/60 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
          <summary className="cursor-pointer flex items-center gap-2 font-semibold">
            <ShieldCheck size={15} aria-hidden="true"/> Preview test only · real pickup actions disabled
            <ChevronDown size={13} aria-hidden="true" className="ml-auto"/>
          </summary>
          <p className="pt-2 text-[11px] leading-relaxed">Fake tickets simulate Accept, Ready, payment and collection only on this page. Actual pickup and payment changes require separately approved database activation.</p>
        </details>
      ) : !pickupOrderingEnabled() ? (
        <p role="status" className="rounded-xl border border-outline-variant/15 bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
          Pickup order, payment and collection changes are currently disabled. Existing orders remain available for viewing.
        </p>
      ) : null}

      <div data-testid="orders-queue-card" className={`bg-surface-container-lowest dark:bg-zinc-950 border border-outline-variant/10 rounded-[1.4rem] p-3 sm:p-4 shadow-sm space-y-3 min-w-0 ${pitchPolish?"bg-white/95 border-white/70 dark:border-zinc-800/80 shadow-[0_10px_30px_-17px_rgba(15,23,42,0.38)]":""}`}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className={`font-headline text-[15px] sm:text-lg font-bold whitespace-nowrap text-on-surface ${pitchPolish?"tracking-tight leading-snug antialiased":""}`}>{viewMode==="active"?"Kitchen queue":"Order history"}</h2>
            <p className="text-[11px] text-on-surface-variant">
              {viewMode==="active"?<>
                <span className="md:hidden">Tap a stage below</span>
                <span className="hidden md:inline">New orders first, ready orders next</span>
              </>:isTestPreview?"Completed and cancelled orders, including labelled simulations":"Completed and cancelled orders"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <select value={sort} onChange={e=>setSort(e.target.value as SortMode)}
              aria-label="Sort mobile orders" className="md:hidden min-h-11 max-w-[90px] rounded-xl bg-surface-container-low text-on-surface text-[11px] font-semibold px-1.5 border border-outline-variant/10">
              <option value="priority">Priority</option>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="highest">Highest R</option>
            </select>
            <button type="button" onClick={()=>setShowSearch(!showSearch)}
              aria-pressed={showSearch} aria-label={showSearch?"Close order search":"Search orders"}
              className={`h-11 w-11 flex items-center justify-center rounded-xl bg-surface-container-low ${pitchPolish?"motion-safe:transition-[background-color,transform,box-shadow] motion-safe:duration-200 active:scale-[0.98] hover:shadow-sm":""} ${commonFocus}`}>
              {showSearch?<X size={17}/>:<Search size={17}/>}
            </button>
          </div>
        </div>
        {showSearch&&<div className="flex gap-2 items-center rounded-xl border border-outline-variant/25 bg-surface-container-lowest px-3 py-2">
          <Search size={16} aria-hidden="true" className="text-on-surface-variant shrink-0"/>
          <input autoFocus type="search" aria-label="Search order ID, customer or product"
            value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search orders…" className="min-w-0 flex-1 bg-transparent text-sm text-on-surface outline-none"/>
        </div>}
        <div className="hidden md:flex items-center justify-between gap-2 min-w-0">
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

        <div aria-live="polite" className="sr-only">{filtered.length} orders match this filter. Display style: {boardStyle==="expediter"?"A detailed tickets with visible actions":"B compact rows, tap to show actions"}.</div>
        <OrdersStyleBoard
          entries={filtered}
          completedEntries={viewMode==="active"
            ? [
              ...completedRealOrders.map(order=>({kind:"real" as const,order})),
              ...fakeOrders.filter(order=>order.status==="completed"||order.status==="cancelled")
                .map(order=>({kind:"fake" as const,order}))
            ]
            : []}
          style={boardStyle}
          viewMode={viewMode}
          onDemoAction={onDemoAction}
          renderRealOrder={renderRealOrder}
          stageFilter={stage}
        />
      </div>
      {isTestPreview&&<p className="text-center text-[11px] text-on-surface-variant px-3">
        <Bell size={12} aria-hidden="true" className="inline mr-1"/> Fake orders are browser-only training cards. No actual orders, payments or notifications are created.
      </p>}
    </main>
  );
}
