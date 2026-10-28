import React,{useEffect,useRef,useState} from "react";
import {onAuthStateChanged,signInWithEmailAndPassword,signOut,type User} from "firebase/auth";
import {localPickupFixture,pickupAuth} from "./auth";
import {createPickupApi,PickupApiError,pickupStatus,type PickupOrder} from "./client";
import "./pickup.css";
const api=createPickupApi(localPickupFixture ? "" : import.meta.env.VITE_LOCALEATS_API_URL || "",async()=>{
 if(!pickupAuth.currentUser) throw new Error("Sign in to continue.");
 return pickupAuth.currentUser.getIdToken();
},fetch,{requireExplicitHttps:import.meta.env.PROD});
const money=(amount:number)=>new Intl.NumberFormat("en-ZA",{style:"currency",currency:"ZAR"}).format(Number(amount));
type Pending={orderId:string;action:string;body:Record<string,unknown>};
export default function PickupMerchantApp() {
 const [user,setUser]=useState<User|null>(null),[starting,setStarting]=useState(true),[email,setEmail]=useState(""),[password,setPassword]=useState("");
 const [orders,setOrders]=useState<PickupOrder[]>([]),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const [pending,setPending]=useState<Pending|null>(null);
 const locked=useRef(false),generation=useRef(0);
 const storageKey=(uid:string)=>"pickup-merchant-command-v1:"+uid;
 useEffect(()=>onAuthStateChanged(pickupAuth,u=>{generation.current++;setUser(u);setOrders([]);setStarting(false);setError("");setPending(null);}),[]);
 const load=async()=>{
  const requestGeneration=generation.current;
  const result=await api.orders(true);
  if(generation.current===requestGeneration) {setOrders(result.orders.filter((o:PickupOrder)=>o.delivery_type==="collection"));setError(previous=>previous.startsWith("Could not refresh") ? "" : previous);}
 };
 useEffect(()=>{
  if(!user) return;
  let active=true;
  try {setPending(JSON.parse(sessionStorage.getItem(storageKey(user.uid)) || "null"));}catch {setPending(null);}
  const refresh=()=>load().catch(e=>{if(active)setError("Could not refresh orders. Displayed orders may be stale. "+e.message);});
  void refresh();const timer=setInterval(refresh,5000);
  return()=>{active=false;clearInterval(timer);};
 },[user]);
 const perform=async(order:PickupOrder,action:string,extra:Record<string,unknown>={})=>{
  if(locked.current || !user) return;locked.current=true;setBusy(true);setError("");setNotice("");
  const requestGeneration=generation.current;
  try {
   if(pending && (pending.orderId!==order.id || pending.action!==action)) throw new Error("Retry the unresolved action before starting another.");
   const command=pending ?? {orderId:order.id,action,body:{command_id:crypto.randomUUID(),expected_revision:order.revision,...extra}};
   sessionStorage.setItem(storageKey(user.uid),JSON.stringify(command));setPending(command);
   const result=await api.command(command.orderId,command.action,command.body);
   if(generation.current!==requestGeneration)return;
   if(!result.order?.id) throw new Error("The service did not confirm this action. Retry it.");
   setOrders(current=>current.map(o=>o.id===result.order.id ? result.order : o));
   sessionStorage.removeItem(storageKey(user.uid));setPending(null);setNotice("Saved by LocalEats.");
   try {await load();}catch {setError("The action was saved, but refresh failed. Refresh to check the latest order.");}
  }catch(e) {
   if(e instanceof PickupApiError && [400,403,404,409].includes(e.status)) {sessionStorage.removeItem(storageKey(user.uid));setPending(null);}
   setError(e instanceof Error ? e.message : "Action failed. Retry the same action.");
  }finally{locked.current=false;setBusy(false);}
 };
 const login=async(event:React.FormEvent)=>{
  event.preventDefault();setBusy(true);setError("");
  try{await signInWithEmailAndPassword(pickupAuth,email,password);setPassword("");}catch{setError("Sign-in failed. Check your details or reset your password in your existing account.");}finally{setBusy(false);}
 };
 return <main className="pickup-app"><div className="pickup-shell">
  <header><div><h1>LocalEats Merchant</h1>{localPickupFixture && <p role="status">LOCAL FIXTURE TEST — no real orders or payments</p>}<p>Pickup orders · Pay at shop</p></div>{user && <button className="secondary" disabled={busy} onClick={()=>void signOut(pickupAuth).catch(e=>setError(e.message))}>Sign out</button>}</header>
  {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
  {starting ? <p>Checking session…</p> : !user ? <section><h2>Merchant sign in</h2><form onSubmit={login}>
   <label>Email<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
   <button disabled={busy}>Sign in</button></form></section> : <>
   <div className="row"><h2>Orders for your shops</h2><button className="secondary" disabled={busy} onClick={()=>void load().then(()=>setError("")).catch(e=>setError(e.message))}>Refresh</button></div>
   {!orders.length && <section>No pickup orders loaded. New orders appear here after the API confirms them.</section>}
   {orders.map(order=><article key={order.id} aria-label={"Order "+order.id}>
    <div className="row"><h3>{order.customer_name}</h3><span className="badge">{pickupStatus(order)}</span></div>
    <p className="muted">Order {order.id} · Shop {order.shop_id}</p><p>Pickup · <strong>{order.payment_status==="paid" ? "Paid at shop ("+order.payment_method+")" : order.payment_status==="unpaid" ? "Unpaid — pay at shop" : "Payment status unavailable"}</strong></p>
    <a className="call secondary" href={"tel:"+order.phone.replace(/[^+0-9]/g,"")}>Optional call: {order.phone}</a>
    <ul>{Array.isArray(order.items) && order.items.map((line,index)=><li key={index}>{line.quantity} × {line.name} — {money(line.line_total)}</li>)}</ul>
    <p className="amount">Authoritative total: {money(order.total_price)}</p>
    {pending?.orderId===order.id ? <button disabled={busy} onClick={()=>void perform(order,pending.action)}>Retry unresolved {pending.action}</button> : <>
     {order.status==="pending" && order.payment_status==="unpaid" && <>
      <button disabled={busy || !!pending} onClick={()=>void perform(order,"accept")}>Accept → Preparing</button>
      <button className="secondary" disabled={busy || !!pending} onClick={()=>{const reason=window.prompt("Reason for rejecting this pending order");if(reason?.trim())void perform(order,"reject",{reason:reason.trim()});}}>Reject</button></>}
     {order.status==="preparing" && order.payment_status==="unpaid" && <button disabled={busy || !!pending} onClick={()=>void perform(order,"ready")}>Ready — notify customer</button>}
     {order.status==="ready_for_pickup" && order.payment_status==="unpaid" && <div><p>Confirm full payment only after receiving it.</p>
      {(["cash","card_machine"] as const).map(method=><button key={method} disabled={busy || !!pending} onClick={()=>{if(window.confirm("Have you received the full "+money(order.total_price)+" by "+(method==="cash" ? "cash" : "physical card machine")+"?"))void perform(order,"payment-confirmation",{payment_method:method});}}>Confirm {method==="cash" ? "cash" : "card-machine"} payment received</button>)}</div>}
     {order.status==="ready_for_pickup" && order.payment_status==="paid" && <button disabled={busy || !!pending} onClick={()=>{if(window.confirm("Have you actually handed the food to the customer?"))void perform(order,"collect",{handover_confirmed:true});}}>Food handed over — mark Collected</button>}
    </>}
   </article>)}
  </>}
 </div></main>;
}
