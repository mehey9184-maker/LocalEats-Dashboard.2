// L3-N7B5I: Home display is rendered from synthetic API-free props only.
import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import {DashboardOverview} from "../../src/components/DashboardOverview";
import type {Order,MenuItem,Shop,User} from "../../src/types";

const owner={id:"synthetic-owner",uid:"synthetic-owner",email:"fixture@example.invalid"} as unknown as User;
const ownedShop={
 id:"synthetic-shop",owner_id:"synthetic-owner",name:"Synthetic Kota Shop",
 approval_status:"approved",phone:"+27000000000",whatsapp:"+27000000000",
 is_active:true,opening_time:"08:00",closing_time:"20:00",
 updated_at:"2026-11-20T00:00:00Z"
} as unknown as Shop;
const pendingOrder={
 id:"synthetic-home-order-1",shop_id:"synthetic-shop",user_id:"synthetic-only",
 status:"pending",pickup_status:"pending",payment_status:"unpaid",
 delivery_type:"collection",order_type:"collection",
 total_price:25,created_at:"2026-11-20T00:00:00Z",product_name:"Synthetic Kota"
} as unknown as Order;
const menu={id:"synthetic-menu-1",shop_id:"synthetic-shop",name:"Kota",price:25,is_available:true} as unknown as MenuItem;
function Fixture(){
 const params=new URLSearchParams(window.location.search);
 const scenario=params.get("scenario")||"owned";
 const [tab,setTab]=useState("home");
 const [refresh,setRefresh]=useState(0);
 const isBlank=scenario==="blank";
 const isLoading=scenario==="loading";
 return <main data-testid="home-fixture" style={{margin:"0 auto",maxWidth:1600,padding:12,fontFamily:"system-ui"}}>
  <p data-testid="fixture-warning" role="note">Synthetic-only Merchant Home. No orders, payments, push, real customers or external network.</p>
  <div data-testid="fixture-state">Tab: {tab}, refreshes: {refresh}</div>
  <DashboardOverview
   orders={isBlank?[]:[pendingOrder]}
   loading={isLoading}
   shops={isBlank?[]:[ownedShop]}
   user={isBlank?null:owner}
   currentShop={isBlank?undefined:ownedShop}
   menuItems={isBlank?[]:[menu]}
   menuReadState={isBlank?"loading":"ready"}
   orderReadState={isBlank?"unverified":"fresh"}
   trialInfo={isBlank?null:{daysRemaining:32,isExpired:false}}
   darkMode={false}
   onRefresh={()=>setRefresh(x=>x+1)}
   onNavigate={setTab}
   onEditProfile={()=>setTab("profile")}
   onInstallApp={()=>setTab("install")}
  />
 </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
