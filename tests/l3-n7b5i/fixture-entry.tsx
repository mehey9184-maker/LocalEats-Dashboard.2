// L3-N7B5I: original Merchant Home rendered with synthetic owner data only.
// No auth network, order checkout, payment, push, Rider or hosted data access.
import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import {DashboardOverview} from "../../src/components/DashboardOverview";
import type {Order,Shop,User,MenuItem} from "../../src/types";

type Scenario="fresh"|"failed"|"unverified"|"loading"|"other-shop";
const shopA:Shop={
 id:11,name:"Synthetic Kota A",owner_id:"fixture-owner-a",approval_status:"approved",
 is_active:true,location:"Fixture Johannesburg",description:"Test shop only",
 operating_hours:{open:"08:00",close:"20:00"}
};
const shopB:Shop={
 id:22,name:"Synthetic Kota B",owner_id:"fixture-owner-b",approval_status:"approved",
 is_active:false,location:"Fixture Johannesburg"
};
const currentUser:User={id:"fixture-owner-a",email:"synthetic-merchant@example.invalid",
 user_metadata:{full_name:"Synthetic Merchant"}};
const date="2026-11-20T09:00:00.000Z";
const fakeOrder=(id:string,shop_id:number,delivery_type:"collection"|"delivery",status:"pending"|"preparing"|"ready"|"completed"):Order=>({
 id,shop_id,user_id:"fixture-buyer",product_name:"Synthetic Kota",
 delivery_type,order_type:delivery_type==="collection"?"pickup":"delivery",
 status,pickup_status:status==="ready"?"ready_for_pickup":status,
 payment_status:"unpaid",revision:0,total_price:25,
 created_at:date,customer_name:"Fixture Customer",
 phone:"000000",email:"test@example.invalid",address:"Offline Test",city:"Johannesburg",
 items:[{name:"Synthetic Kota",price:25,quantity:1}]
} as Order);
const allOrders:Order[]=[
 fakeOrder("owner-a-pending",11,"collection","pending"),
 fakeOrder("owner-a-ready",11,"collection","ready"),
 fakeOrder("other-owner-pending",22,"collection","pending"),
 fakeOrder("old-delivery-record",11,"delivery","completed")
];
const allMenu:MenuItem[]=[
 {id:"kota-one",shop_id:11,name:"Synthetic Kota",price:25,image_url:"",
  is_available:true,created_at:date,stock_quantity:5},
 {id:"kota-b",shop_id:22,name:"Other shop item",price:80,image_url:"",
  is_available:true,created_at:date}
];

function Fixture(){
 const [scenario,setScenario]=useState<Scenario>("fresh");
 const [layout,setLayout]=useState<"compact"|"advanced">("compact");
 const [navigation,setNavigation]=useState("none");
 const [refreshes,setRefreshes]=useState(0);
 const riskActions=0;
 const user=scenario==="unverified"?null:currentUser;
 const currentShop=scenario==="unverified"?undefined:scenario==="other-shop"?shopB:shopA;
 const ordersState=scenario==="fresh"||scenario==="other-shop"?"fresh":scenario==="failed"?"failed":"unverified";
 const menuState=scenario==="failed"?"failed":scenario==="loading"?"loading":"ready";
 const switchLayout=(next:"compact"|"advanced")=>{
  // Only local fixture display preference; no server write or real settings.
  localStorage.setItem("localeats_dashboard_layout",next);
  setLayout(next);
 };
 return <main style={{maxWidth:1510,margin:"auto",padding:8}} data-testid="home-fixture">
  <header aria-label="Isolated Home test controls" style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
   <button data-testid="home-fresh" onClick={()=>setScenario("fresh")}>Verified Home</button>
   <button data-testid="home-failed" onClick={()=>setScenario("failed")}>Failed read</button>
   <button data-testid="home-loading" onClick={()=>setScenario("loading")}>Loading</button>
   <button data-testid="home-unverified" onClick={()=>setScenario("unverified")}>Unverified owner</button>
   <button data-testid="home-other-shop" onClick={()=>setScenario("other-shop")}>Different verified shop</button>
   <button data-testid="home-compact" onClick={()=>switchLayout("compact")}>Compact layout</button>
   <button data-testid="home-advanced" onClick={()=>switchLayout("advanced")}>Advanced layout</button>
   <output data-testid="home-nav">{navigation}</output>
   <output data-testid="home-refresh">{refreshes}</output>
   <output data-testid="home-write-attempts">{riskActions}</output>
  </header>
  <p data-testid="fixture-scope">{currentShop?.id??"none"}:{ordersState}:{menuState}:{layout}</p>
  <DashboardOverview
   key={layout}
   orders={allOrders}
   loading={scenario==="loading"}
   shops={currentShop?[currentShop]:[]}
   user={user}
   onRefresh={()=>setRefreshes(v=>v+1)}
   onNavigate={setNavigation}
   onEditProfile={()=>setNavigation("profile")}
   onInstallApp={()=>setNavigation("install")}
   menuItems={allMenu}
   menuReadState={menuState}
   orderReadState={ordersState}
   trialInfo={{daysRemaining:60,isExpired:false}}
   currentShop={currentShop}
   darkMode={false}
  />
  <output data-testid="fixture-mutations">{riskActions}</output>
 </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
