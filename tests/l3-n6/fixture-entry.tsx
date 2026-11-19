import React,{useEffect,useRef,useState} from "react";
import {createRoot} from "react-dom/client";
import {PickupOrderActions} from "../../src/components/PickupOrderActions";
import {MerchantApi} from "../../src/services/MerchantApi";
import {auth,setFixtureUid} from "./fixture-auth";

function Fixture(){
 const [uid,setUid]=useState("merchant-a");
 const [order,setOrder]=useState<any>(null);
 const [error,setError]=useState("");
 const generation=useRef(0);
 const load=async()=>{
  const request=++generation.current;
  const owner=auth.currentUser?.uid;
  setError("");
  try {
   const rows=await MerchantApi.getOrders();
   if(request!==generation.current || auth.currentUser?.uid!==owner)return;
   setOrder(rows[0]??null);
  }catch(e){
   if(request!==generation.current || auth.currentUser?.uid!==owner)return;
   setError(e instanceof Error?e.message:"Unable to load orders.");
  }
 };
 useEffect(()=>{
  const handler=()=>{void load();};
  window.addEventListener("merchant-pickup-order-confirmed",handler);
  void load();
  return()=>{++generation.current;window.removeEventListener("merchant-pickup-order-confirmed",handler);};
 },[]);
 const switchUser=()=>{
  const next=uid==="merchant-a"?"merchant-b":"merchant-a";
  ++generation.current;setOrder(null);setError("");setFixtureUid(next);setUid(next);
  // No stale owner order is copied to a second merchant.
  queueMicrotask(()=>{void load();});
 };
 return <main style={{maxWidth:650,margin:"0 auto",padding:16,overflowWrap:"break-word",fontFamily:"system-ui,sans-serif"}}>
  <h1>L3-N6 • Synthetic Merchant Pickup</h1>
  <p role="note">Local browser fixture only — No actual orders, customers, payments, or notification sends.</p>
  <p data-testid="fixture-account">Fixture identity: {uid}</p>
  <button type="button" data-testid="switch-merchant" onClick={switchUser}>Switch synthetic merchant</button>
  <button type="button" data-testid="refresh-order" onClick={()=>void load()}>Refresh from fixture API</button>
  {error&&<p role="alert">{error}</p>}
  {order && <section data-testid="pickup-card" key={uid}>
   <h2>Pickup order • synthetic</h2>
   <p data-testid="fixture-status">Persisted fixture state: {String(order.pickup_status??order.status)} / {String(order.payment_status)}</p>
   <PickupOrderActions order={order}/>
  </section>}
  {!order && !error && <p data-testid="empty">No pickup order for the current merchant.</p>}
 </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
