// L3-N7B5F browser presentation only; all reads and channel callbacks are synthetic.
import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import {Toaster} from "sonner";
import {ConnectivityMonitor} from "../../src/components/ConnectivityMonitor";
import {syntheticAdapter,syntheticState,resolveOldestRead,emitChannel,setSyntheticOnline} from "./fixture-connectivity";
import type {supabase as MerchantAdapter} from "../../src/lib/supabase";
const adapter=syntheticAdapter as unknown as Pick<typeof MerchantAdapter,"from"|"removeChannel">;
function Fixture(){
 const [visible,setVisible]=useState(true);
 const [shop,setShop]=useState("fixture-merchant-a");
 const [diagCount,setDiagCount]=useState(0);
 const [tick,setTick]=useState(0);
 return <main style={{maxWidth:760,margin:"0 auto",padding:16,fontFamily:"system-ui"}}>
  <h1>LocalEats synthetic connectivity monitor</h1>
  <p role="note">No real backend, shop, order, payment or notification is accessed.</p>
  <p data-testid="synthetic-shop">{shop}</p>
  <div className="flex flex-wrap gap-2">
   <button data-testid="set-offline" onClick={()=>setSyntheticOnline(false)}>Offline</button>
   <button data-testid="set-online" onClick={()=>setSyntheticOnline(true)}>Online</button>
   <button data-testid="probe-success" onClick={()=>resolveOldestRead(false)}>Read success</button>
   <button data-testid="probe-failure" onClick={()=>resolveOldestRead(true)}>Read failure</button>
   <button data-testid="channel-subscribed" onClick={()=>emitChannel("SUBSCRIBED")}>Channel subscribed</button>
   <button data-testid="channel-closed" onClick={()=>emitChannel("CLOSED")}>Channel closed</button>
   <button data-testid="old-channel-subscribed" onClick={()=>emitChannel("SUBSCRIBED",true)}>Old callback</button>
   <button data-testid="add-review" onClick={()=>{syntheticState.queuedCount=3;window.dispatchEvent(new Event("offline_queue_updated"));}}>Add 3 review records</button>
   <button data-testid="clear-review" onClick={()=>{syntheticState.queuedCount=0;window.dispatchEvent(new Event("offline_queue_updated"));}}>Clear synthetic records</button>
   <button data-testid="toggle-monitor" onClick={()=>setVisible(v=>!v)}>Toggle monitor</button>
   <button data-testid="switch-synthetic-shop" onClick={()=>setShop(v=>v==="fixture-merchant-a"?"fixture-merchant-b":"fixture-merchant-a")}>Switch shop</button>
  </div>
  <p data-testid="read-count">{syntheticState.reads.length}</p>
  <p data-testid="active-channels">{syntheticState.activeChannels.size}</p>
  <p data-testid="record-count">{syntheticState.queuedCount}</p>
  <p data-testid="write-count">{syntheticState.backendWrites}</p>
  <button data-testid="refresh-fixture-values" onClick={()=>setTick(v=>v+1)}>Refresh fixture info {tick}</button>
  {visible&&<ConnectivityMonitor key={shop} supabase={adapter} onOpenDiagnostics={()=>setDiagCount(v=>v+1)}/>}
  <p data-testid="diagnostics-click-count">{diagCount}</p>
  <Toaster/>
 </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
