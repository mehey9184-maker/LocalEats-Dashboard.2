// L3-N7B5E: synthetic, offline-only Kanban pagination fixture.
import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import {OrdersStyleBoard,type BoardEntry,type OrderBoardStyle} from "../../src/components/OrdersStyleBoard";
import type {PreviewTestPickupOrder} from "../../src/components/PreviewFakeOrders";

type StageFilter="all"|"pending"|"preparing"|"ready";
type View="active"|"history";
type Status="pending"|"preparing"|"ready"|"completed";
const fake=(number:number,status:Status):PreviewTestPickupOrder=>({
 id:`FAKE-L1C3-${status}-${number}`,shop_id:"FAKE-NO-SHOP",customer_name:`Synthetic ${status} ${number}`,
 created_at:"2026-11-20T00:00:00Z",delivery_type:"collection",order_type:"collection",
 product_name:"Kota",items:[{name:"Kota",quantity:1,unit_price:25,line_total:25}],
 total_price:25,service_fee:0,
 payment_status:status==="completed"?"paid":"unpaid",
 pickup_status:status==="ready"?"ready_for_pickup":status==="completed"?"collected":status,
 status,revision:status==="pending"?0:status==="preparing"?1:status==="ready"?2:3
});
const active:BoardEntry[]=[
 ...Array.from({length:15},(_,i)=>({kind:"fake" as const,order:fake(i+1,"pending")})),
 ...Array.from({length:14},(_,i)=>({kind:"fake" as const,order:fake(i+1,"preparing")})),
 ...Array.from({length:8},(_,i)=>({kind:"fake" as const,order:fake(i+1,"ready")}))
];
const complete:BoardEntry[]=Array.from({length:27},(_,i)=>({kind:"fake" as const,order:fake(i+1,"completed")}));
const noChanges=()=>{throw Error("Synthetic test must never mutate orders or payments.");};
function Fixture(){
 const [style,setStyle]=useState<OrderBoardStyle>("expediter");
 const [view,setView]=useState<View>("active");
 const [filter,setFilter]=useState<StageFilter>("all");
 return <main style={{maxWidth:1400,margin:"0 auto",padding:12,fontFamily:"system-ui"}}>
  <h1>Offline Kanban pagination lifecycle</h1>
  <p data-testid="safety-statement">Synthetic-only fake orders. No real orders, customer accounts, payments, persistence or notifications.</p>
  <div aria-label="Synthetic controls">
   <button type="button" data-testid="set-expediter" onClick={()=>setStyle("expediter")}>Expediter</button>
   <button type="button" data-testid="set-compact" onClick={()=>setStyle("compact")}>Compact</button>
   <button type="button" data-testid="set-active" onClick={()=>setView("active")}>Active</button>
   <button type="button" data-testid="set-history" onClick={()=>setView("history")}>History</button>
   <button type="button" data-testid="filter-all" onClick={()=>setFilter("all")}>All stages</button>
   <button type="button" data-testid="filter-pending" onClick={()=>setFilter("pending")}>New stages</button>
   <button type="button" data-testid="filter-preparing" onClick={()=>setFilter("preparing")}>Preparing stages</button>
  </div>
  <OrdersStyleBoard entries={view==="active"?active:complete}
   completedEntries={view==="active"?complete:[]}
   style={style} viewMode={view} stageFilter={filter}
   onDemoAction={noChanges} renderRealOrder={()=>null}/>
 </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
