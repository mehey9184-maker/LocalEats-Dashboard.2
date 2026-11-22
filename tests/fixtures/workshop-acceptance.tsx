// CI ONLY: mounts the ACTUAL workshop React component without the authenticated
// Merchant App, order API, Firebase or Supabase. Does not weaken preview gate.
import React, {useState} from "react";
import {createRoot} from "react-dom/client";
import {MerchantWorkshopDemo} from "../../src/components/MerchantWorkshopDemo";
import "../../src/index.css";

function AcceptanceShell(){
  const [open,setOpen]=useState(true);
  return <div className="min-h-screen bg-slate-100 p-5">
    <button type="button" id="reopen-workshop" onClick={()=>setOpen(true)}
      className="rounded bg-slate-800 px-4 py-2 font-bold text-white">
      Reopen Workshop Demo
    </button>
    {open&&<MerchantWorkshopDemo onClose={()=>setOpen(false)}/>}
  </div>;
}

createRoot(document.getElementById("root")!).render(<AcceptanceShell/>);
