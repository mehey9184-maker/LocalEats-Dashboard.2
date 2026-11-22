// Standalone Cloudflare preview entry: this deliberately does NOT import
// Merchant App, Firebase, Supabase, order APIs, printers, or private routes.
import React, {useState} from "react";
import {createRoot} from "react-dom/client";
import {MerchantWorkshopDemo} from "../../src/components/MerchantWorkshopDemo";
import {isIsolatedCloudflareWorkshopPreviewEnabled} from "../../src/services/cloudflareWorkshopPreviewGuard";
import "./styles.css";

function CloudflareWorkshopShell(){
  const [open,setOpen] = useState(true);
  if(!isIsolatedCloudflareWorkshopPreviewEnabled()){
    return <main className="mx-auto max-w-xl p-8">
      <h1 className="font-black text-xl">LocalEats Workshop unavailable</h1>
      <p className="mt-3 text-sm">This demo is only available on its separately approved Cloudflare preview hostname.</p>
    </main>;
  }
  return <main className="min-h-dvh bg-[#fff7ed] p-6 text-slate-950">
    <div className="mx-auto max-w-3xl rounded-3xl border border-orange-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-extrabold uppercase tracking-widest text-orange-900">LocalEats · Practice only</p>
      <h1 className="mt-3 text-3xl font-black">Merchant Kitchen Workshop</h1>
      <p className="mt-3 leading-7 text-slate-700">
        Watch an example kitchen handle fictional kota orders. This does not connect to
        shops, customers, accounts, payments or the real LocalEats ordering system.
      </p>
      <button type="button" onClick={()=>setOpen(true)}
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-orange-700 px-5 font-bold text-white hover:bg-orange-800">
        Open fictional workshop
      </button>
    </div>
    {open && <MerchantWorkshopDemo onClose={()=>setOpen(false)}/>}
  </main>;
}

createRoot(document.getElementById("root")!).render(<CloudflareWorkshopShell/>);
