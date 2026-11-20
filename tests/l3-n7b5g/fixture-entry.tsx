// L3-N7B5G: synthetic visual-only attention fixture, no auth or API clients.
import React,{useRef,useState} from "react";
import {createRoot} from "react-dom/client";
import {usePageNotificationAttention,pageForMerchantNotice,type MerchantNoticeTopic} from "../../src/hooks/usePageNotificationAttention";
import type {Order,MenuItem} from "../../src/types";

const pendingOrder=(id:string)=>({id,status:"pending"}) as Order;
const menuStock=(id:string,quantity:number)=>({id,stock_quantity:quantity}) as MenuItem;

function AttentionHarness(){
 const [scope,setScope]=useState<string|null>("owner-a:shop-a");
 const [ordersFresh,setOrdersFresh]=useState(false);
 const [orderIds,setOrderIds]=useState<string[]>([]);
 const [menuFresh,setMenuFresh]=useState(false);
 const [lowIds,setLowIds]=useState<string[]>([]);
 const [activeTab,setActiveTab]=useState("home");
 const [showHook,setShowHook]=useState(true);
 const [epoch,setEpoch]=useState(0);
 const [calls,setCalls]=useState(0);
 const heldCallback=useRef<((topic:MerchantNoticeTopic)=>void)|null>(null);

 const startA=()=>{setScope("owner-a:shop-a");setOrdersFresh(true);setOrderIds(["a-1"]);setMenuFresh(true);setLowIds([]);setActiveTab("home");};
 const startB=()=>{setScope("owner-b:shop-b");setOrdersFresh(true);setOrderIds(["b-1"]);setMenuFresh(true);setLowIds([]);setActiveTab("home");};
 const swapReady=()=>{setScope("owner-b:shop-b");setOrdersFresh(false);setOrderIds(["a-1","a-2"]);setMenuFresh(false);setLowIds([]);setActiveTab("home");};
 return <main style={{padding:12,fontFamily:"system-ui"}}>
  <h1>Offline Merchant notification-attention lifecycle fixture</h1>
  <p>No real customers, orders, notifications, permissions, APIs, push sends or persistent storage.</p>
  <p data-testid="owner">{scope??"none"}</p>
  <p data-testid="freshness">{ordersFresh?"fresh":"stale"}</p>
  <p data-testid="active-tab">{activeTab}</p>
  <button data-testid="verify-a" onClick={startA}>Verify owner A first snapshot</button>
  <button data-testid="new-a-order" onClick={()=>setOrderIds(["a-1","a-2"])}>Verified new A order</button>
  <button data-testid="hold-callback" onClick={()=>setEpoch(v=>v+1)}>Capture A callback {epoch}</button>
  <button data-testid="switch-b" onClick={startB}>Switch verified owner B</button>
  <button data-testid="switch-b-unverified" onClick={swapReady}>Switch B without fresh read</button>
  <button data-testid="verify-b" onClick={()=>{setOrdersFresh(true);setOrderIds(["b-1"]);setMenuFresh(true);setLowIds([]);}}>Verify B baseline</button>
  <button data-testid="new-b-order" onClick={()=>setOrderIds(["b-1","b-2"])}>Verified new B order</button>
  <button data-testid="stale-b-order" onClick={()=>{setOrdersFresh(false);setOrderIds(["b-1","b-2","b-3"]);}}>Unverified B order</button>
  <button data-testid="reverify-b" onClick={()=>setOrdersFresh(true)}>Reverify B</button>
  <button data-testid="new-stock" onClick={()=>setLowIds(["menu-low-1"])}>Verified low stock</button>
  <button data-testid="tab-orders" onClick={()=>setActiveTab("orders")}>Open Orders</button>
  <button data-testid="tab-menu" onClick={()=>setActiveTab("menu")}>Open Menu</button>
  <button data-testid="tab-marketing" onClick={()=>setActiveTab("marketing")}>Open Marketing</button>
  <button data-testid="tab-home" onClick={()=>setActiveTab("home")}>Open Home</button>
  <button data-testid="unmount" onClick={()=>setShowHook(false)}>Unmount attention</button>
  <button data-testid="remount" onClick={()=>setShowHook(true)}>Remount attention</button>
  <p data-testid="callback-invocations">{calls}</p>
  {showHook&&<RenderAttention scope={scope} ordersFresh={ordersFresh} orderIds={orderIds}
   menuFresh={menuFresh} lowIds={lowIds} activeTab={activeTab}
   holdCallback={heldCallback} capture={epoch} onInvoke={()=>setCalls(v=>v+1)}/>}
  <button data-testid="invoke-old-callback" onClick={()=>{heldCallback.current?.("new_order");setCalls(v=>v+1);}}>Invoke captured previous merchant callback</button>
  <p data-testid="topic-new-order">{pageForMerchantNotice("new_order")}</p>
  <p data-testid="topic-inventory">{pageForMerchantNotice("inventory_low")}</p>
  <p data-testid="topic-payment">{pageForMerchantNotice("payment")}</p>
 </main>;
}

function RenderAttention({scope,ordersFresh,orderIds,menuFresh,lowIds,activeTab,holdCallback,capture,onInvoke}:{
 scope:string|null;ordersFresh:boolean;orderIds:string[];
 menuFresh:boolean;lowIds:string[];activeTab:string;
 holdCallback:React.MutableRefObject<((topic:MerchantNoticeTopic)=>void)|null>;
 capture:number;onInvoke:()=>void;
}){
 const {pulses,pulseForTopic}=usePageNotificationAttention({
  scope,ordersFresh,orders:orderIds.map(pendingOrder),
  menuFresh,menuItems:lowIds.map(id=>menuStock(id,2)),activeTab
 });
 // Capture the old owner's callback ONLY from a direct test button click.
 const snapshotCallback=()=>{void capture;holdCallback.current=pulseForTopic;};
 return <section data-testid="attention-hook">
  <output data-testid="pulse-orders">{pulses.orders??"quiet"}</output>
  <output data-testid="pulse-menu">{pulses.menu??"quiet"}</output>
  <output data-testid="pulse-marketing">{pulses.marketing??"quiet"}</output>
  <output data-testid="pulse-payments">{pulses.payments??"quiet"}</output>
  <button data-testid="capture-callback" onClick={snapshotCallback}>Capture scope callback</button>
  <button data-testid="trigger-new-order" onClick={()=>{pulseForTopic("new_order");onInvoke();}}>Pulse order topic</button>
  <button data-testid="trigger-marketing" onClick={()=>{pulseForTopic("marketing");onInvoke();}}>Pulse marketing topic</button>
  <button data-testid="trigger-payment" onClick={()=>{pulseForTopic("payment");onInvoke();}}>Pulse payment topic</button>
 </section>;
}

createRoot(document.getElementById("root")!).render(<AttentionHarness/>);
