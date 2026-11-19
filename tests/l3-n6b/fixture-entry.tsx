import React,{useEffect,useRef,useState} from "react";
import {createRoot} from "react-dom/client";
import {OrdersManagement} from "../../src/components/OrdersManagement";
import {MerchantApi} from "../../src/services/MerchantApi";
import {auth,setFixtureUid} from "../l3-n6/fixture-auth";

function Fixture(){
 const [owner,setOwner]=useState("merchant-a");
 const [shop,setShop]=useState<any>(null);
 const [orders,setOrders]=useState<any[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [refreshes,setRefreshes]=useState(0);
 const [misfires,setMisfires]=useState(0);
 const [tab,setTab]=useState("orders");
 const [kitchenMode,setKitchenMode]=useState(false);
 const [soundAlerts,setSoundAlerts]=useState(false);
 const sequence=useRef(0);
 const load=async()=>{
   const mySeq=++sequence.current;
   const uid=auth.currentUser?.uid;
   setLoading(true);setError("");
   try{
     const verified=await MerchantApi.getMerchantShop();
     if(!verified||verified.owner_id!==uid||verified.approval_status!=="approved")
       throw Error("Merchant approval or ownership is not verified.");
     const actualOrders=await MerchantApi.getOrders();
     if(mySeq!==sequence.current||auth.currentUser?.uid!==uid)return;
     if(actualOrders.some(o=>String(o.shop_id)!==String(verified.id)))
       throw Error("Merchant order shop scope is invalid.");
     setShop(verified);setOrders(actualOrders);
   }catch(e){
     if(mySeq!==sequence.current||auth.currentUser?.uid!==uid)return;
     setError(e instanceof Error?e.message:"Could not load orders.");
     // Preserve previously verified same-account order data during transient failure.
     // New accounts never see the previous shop or orders.
   }finally{
     if(mySeq===sequence.current&&auth.currentUser?.uid===uid)setLoading(false);
   }
 };
 useEffect(()=>{void load();return()=>{++sequence.current;};},[]);
 const switchAccount=()=>{
   const next=owner==="merchant-a"?"merchant-b":"merchant-a";
   ++sequence.current;setOwner(next);setShop(null);setOrders([]);setError("");
   setFixtureUid(next);void load();
 };
 const refresh=()=>{setRefreshes(n=>n+1);void load();};
 const rejectMutation=()=>{setMisfires(n=>n+1);throw Error("L3-N6B no mutations");};
 return <main style={{padding:12,maxWidth:1500,margin:"0 auto",overflowX:"clip"}}>
   <header role="banner">
    <h1>LocalEats Merchant · Orders (isolated browser fixture)</h1>
    <p role="note">Synthetic shop and orders only. No real users, writes, cash, cards or push.</p>
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
      <button data-testid="switch-account" onClick={switchAccount}>Switch synthetic merchant</button>
      <button data-testid="test-refresh" onClick={refresh}>Refresh test orders</button>
    </div>
    <p data-testid="fixture-uid">Verified identity: {owner}</p>
    <p data-testid="fixture-refreshes">Refresh requests: {refreshes}</p>
    <p data-testid="fixture-misfires">Mutation attempts: {misfires}</p>
   </header>
   {error&&<p role="alert" data-testid="fixture-error">{error}</p>}
   {loading&&<p role="status" data-testid="fixture-loading">Verifying shop and orders…</p>}
   {shop&&<section data-testid="real-orders-page" aria-label="Merchant Orders page">
     <OrdersManagement
       orders={orders as any}
       loading={loading}
       currentShop={shop as any}
       onUpdateStatus={rejectMutation}
       onDeleteAllOrders={rejectMutation}
       onRefresh={refresh}
       kitchenMode={kitchenMode}
       setKitchenMode={setKitchenMode}
       soundAlerts={soundAlerts}
       setSoundAlerts={setSoundAlerts}
       onRequestRider={rejectMutation}
       onUnassignRider={rejectMutation}
       onTabChange={setTab}
     />
   </section>}
   {!shop&&!loading&&!error&&<p data-testid="not-authorized">Merchant Orders unavailable until shop ownership is verified.</p>}
 </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
