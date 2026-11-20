// L3-N7B5D: synthetic-only visual fixture. No auth clients, API or hosted data.
import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import type {Shop} from "../../src/types";
import {MerchantSubscriptionPlans,SubscriptionCountdown} from "../../src/components/MerchantSubscriptionPlans";
import {OrdersFocusedWorkspace} from "../../src/components/OrdersFocusedWorkspace";

const shops:Shop[]=[
 {id:"fixture-a",owner_id:"test-owner-a",name:"Synthetic A",subscription_status:"trial",trial_end_date:"2030-01-01T00:00:00Z"},
 {id:"fixture-b",owner_id:"test-owner-b",name:"Synthetic B",subscription_status:"trial",trial_end_date:"2030-01-01T00:00:00Z"}
];
const readOnly=()=>{throw Error("Synthetic UI must not mutate a real order, payment or shop.");};

function Fixture(){
 const [shopIndex,setShopIndex]=useState(0);
 const [deadline]=useState(()=>Date.now()+6500);
 const [viewMode,setViewMode]=useState<"active"|"history">("active");
 const [soundAlerts,setSoundAlerts]=useState(false);
 const [kitchenMode,setKitchenMode]=useState(false);
 const [maxConcurrentOrders,setMaxConcurrentOrders]=useState(8);
 const [startDate,setStartDate]=useState("");
 const [endDate,setEndDate]=useState("");
 const shop=shops[shopIndex];
 return <main style={{maxWidth:1280,margin:"0 auto",padding:12,fontFamily:"system-ui"}}>
  <h1>LocalEats isolated lifecycle fixture</h1>
  <p data-testid="fixture-merchant">Synthetic identity: {shop.owner_id}</p>
  <button type="button" data-testid="switch-merchant" onClick={()=>setShopIndex(i=>i===0?1:0)}>Switch synthetic merchant</button>
  <section data-testid="live-clock-probe"><SubscriptionCountdown deadline={deadline} sample/></section>
  <MerchantSubscriptionPlans shop={shop} verified/>
  <OrdersFocusedWorkspace
   realOrders={[]}
   fakeOrders={[]}
   completedRealOrders={[]}
   viewMode={viewMode}
   onViewModeChange={setViewMode}
   onDemoAction={readOnly}
   incoming={false}
   onSimulate={readOnly}
   onSimulateBatch={readOnly}
   onClear={readOnly}
   styleStorageKey={`l3-n7b5d-style:${shop.id}`}
   renderRealOrder={()=>null}
   onRefresh={readOnly}
   onExportCSV={readOnly}
   onExportJSON={readOnly}
   soundAlerts={soundAlerts}
   setSoundAlerts={setSoundAlerts}
   kitchenMode={kitchenMode}
   setKitchenMode={setKitchenMode}
   maxConcurrentOrders={maxConcurrentOrders}
   setMaxConcurrentOrders={setMaxConcurrentOrders}
   startDate={startDate}
   endDate={endDate}
   setStartDate={setStartDate}
   setEndDate={setEndDate}
  />
 </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
