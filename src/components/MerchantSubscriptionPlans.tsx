import React,{useEffect,useMemo,useState} from "react";
import {CalendarClock,CheckCircle2,Clock3,Info,ShieldAlert} from "lucide-react";
import type {Shop} from "../types";

export type PlanTier="free"|"plus"|"pro"|"premium"|"unverified";
type PlanView={tier:PlanTier;label:string;status:string;expiry:number|null;source:string};
const PLANS=[{id:"free",name:"Free",price:0},{id:"plus",name:"Plus",price:199},{id:"pro",name:"Pro",price:399},{id:"premium",name:"Premium",price:499}] as const;

export function parsePlanExpiry(value:unknown):number|null {
  // Require an absolute date with an explicit timezone; no browser-local guessing.
  if(typeof value!=="string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value))return null;
  const timestamp=Date.parse(value);
  return Number.isFinite(timestamp)?timestamp:null;
}
export function planFromVerifiedShop(shop?:Shop):PlanView {
  if(!shop)return {tier:"unverified",label:"Plan unavailable",status:"unknown",expiry:null,source:"Owned shop not yet verified"};
  if(shop.subscription_status==="trial")return {
    tier:"free",label:"Free introductory period",status:"trial",
    expiry:parsePlanExpiry(shop.trial_end_date),
    source:"Trial status reported by the shop API; not a financial ledger"
  };
  const activeTier=(["plus","pro","premium"] as const).find(t=>t===shop.subscription_plan);
  if(shop.subscription_status==="active"&&activeTier)return {
    tier:activeTier,label:activeTier[0].toUpperCase()+activeTier.slice(1),status:"active",
    expiry:parsePlanExpiry(shop.subscription_expires_at),
    source:"Plan reported by the shop API; payment not independently verified"
  };
  if(shop.subscription_status==="expired"||shop.subscription_status==="past_due")return {
    tier:"unverified",label:"Renewal review pending",status:shop.subscription_status,
    expiry:parsePlanExpiry(shop.subscription_expires_at),
    source:"Reported subscription status; not a shop-approval decision"
  };
  if(shop.subscription_status==="active")return {
    tier:"unverified",label:"Plan name unavailable",status:"active",expiry:null,
    source:"Active status reported, but no recognized tier"
  };
  return {
    tier:"free",label:"Free mode",status:"unknown",expiry:null,
    source:"Billing is not active; a three-month expiry has not been assigned by the API"
  };
}
export function countdownParts(deadline:number,now:number){
  const remaining=Math.max(0,deadline-now);
  const seconds=Math.floor(remaining/1000);
  return {elapsed:remaining<=0,days:Math.floor(seconds/86400),hours:Math.floor(seconds%86400/3600),
    minutes:Math.floor(seconds%3600/60),seconds:seconds%60};
}
export function SubscriptionCountdown({deadline,sample=false}:{deadline:number|null;sample?:boolean}){
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{
    setNow(Date.now());
    if(deadline===null)return;
    const interval=window.setInterval(()=>setNow(Date.now()),1000);
    return ()=>window.clearInterval(interval);
  },[deadline]);
  if(deadline===null)return <p data-testid="subscription-expiry-unverified" className="font-semibold text-on-surface text-sm">Expiry date awaiting confirmation</p>;
  const t=countdownParts(deadline,now);
  const pad=(n:number)=>String(n).padStart(2,"0");
  return <div className="space-y-1">
    <p data-testid={sample?"sample-plan-clock":"verified-plan-clock"}
      className="font-headline font-extrabold text-lg sm:text-xl tabular-nums text-on-surface"
      aria-label={t.elapsed?"Expiry deadline passed":`${t.days} days ${t.hours} hours ${t.minutes} minutes ${t.seconds} seconds remaining`}>
      {t.elapsed?"Deadline passed":`${t.days}d ${pad(t.hours)}h ${pad(t.minutes)}m ${pad(t.seconds)}s`}
    </p>
    <p className="text-[11px] text-on-surface-variant">
      {sample?"Illustrative timer only":`API date: ${new Intl.DateTimeFormat("en-ZA",{dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Johannesburg"}).format(new Date(deadline))} (South Africa)`}
    </p>
    {t.elapsed&&!sample&&<p className="text-xs text-on-surface-variant">Expiry does not automatically suspend the shop.</p>}
  </div>;
}
function previewExampleAllowed(){
  return typeof window!=="undefined" &&
    import.meta.env.VITE_MERCHANT_PREVIEW_READ_ONLY==="true" &&
    import.meta.env.VITE_PICKUP_ORDERING_ENABLED!=="true" &&
    import.meta.env.VITE_PAYMENTS_PLAN_DEMO_ENABLED==="true" &&
    /^local-eats-dashboard-2-6m8o-[a-z0-9]+-mehey9184-makers-projects\.vercel\.app$/.test(window.location.hostname);
}
export function MerchantSubscriptionPlans({shop,verified}:{shop?:Shop;verified:boolean}){
  const current=useMemo(()=>planFromVerifiedShop(verified?shop:undefined),[verified,shop]);
  const [sampleDeadline,setSampleDeadline]=useState<number|null>(null);
  useEffect(()=>setSampleDeadline(null),[shop?.id]);
  const canDemo=previewExampleAllowed();
  return <div data-testid="payments-plan-preview" className="space-y-5">
    <section className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-headline text-base font-extrabold text-on-surface">
          <CalendarClock size={18} className="text-primary" aria-hidden="true"/> Your current plan
        </h3>
        <span className="rounded-full bg-surface-container-lowest px-3 py-1.5 text-xs font-black text-on-surface">{current.label}</span>
      </div>
      <p className="text-xs text-on-surface-variant">{current.source}</p>
      <div className="space-y-1">
        <p className="flex gap-2 items-center text-[11px] uppercase tracking-wider font-extrabold text-on-surface-variant">
          <Clock3 size={14} aria-hidden="true"/> Remaining time
        </p>
        <SubscriptionCountdown deadline={current.expiry}/>
      </div>
      <p className="text-xs text-on-surface-variant">
        This display does not collect money, create a renewal, change shop approval or notify Super Admin.
      </p>
      {canDemo&&<div className="space-y-2 border-t border-primary/20 pt-3">
        <button type="button" onClick={()=>setSampleDeadline(sampleDeadline===null?Date.now()+2*86400000:null)}
          className="min-h-10 rounded-lg bg-amber-50 text-amber-950 border border-amber-400 px-3 text-xs font-bold">
          {sampleDeadline===null?"Preview: show sample countdown":"Hide sample countdown"}
        </button>
        {sampleDeadline!==null&&<div data-testid="sample-subscription-countdown" className="space-y-2 rounded-xl border-2 border-dashed border-amber-400 bg-amber-50/70 p-3">
          <p className="font-extrabold text-xs text-amber-900">SAMPLE ONLY · Not this shop's subscription</p>
          <SubscriptionCountdown deadline={sampleDeadline} sample/>
        </div>}
      </div>}
    </section>
    <section className="space-y-2">
      <h3 className="font-headline text-base font-extrabold text-on-surface">LocalEats plans</h3>
      <p className="text-xs text-on-surface-variant">
        Planned three-month free introductory period, followed by a chosen monthly tier. Tier benefits and launch dates are not finalized.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {PLANS.map(plan=>{
          const isCurrent=current.tier===plan.id;
          return <article key={plan.id} className={`rounded-2xl border p-4 space-y-2 min-w-0 ${isCurrent?"bg-primary/5 border-primary/40":"bg-surface-container-low border-outline-variant/15"}`}>
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-headline font-black text-on-surface">{plan.name}</h4>
              {isCurrent&&<span className="text-[10px] font-bold text-primary inline-flex items-center gap-1">
                <CheckCircle2 size={12} aria-hidden="true"/> {current.status==="unknown"?"Display mode":"Current"}
              </span>}
            </div>
            <div className="flex items-end gap-1">
              <span className="font-headline text-2xl font-extrabold text-on-surface">R{plan.price}</span>
              <span className="text-xs text-on-surface-variant mb-1">{plan.id==="free"?"/ intro":"/ month"}</span>
            </div>
            <p className="text-[11px] text-on-surface-variant">
              {plan.id==="free"?"Three months planned; start date not yet confirmed":"Future tier · benefits still being decided"}
            </p>
            <p className="text-[10px] font-bold text-on-surface-variant">Not available for purchase yet</p>
          </article>;
        })}
      </div>
    </section>
    <p role="note" className="rounded-xl border border-outline-variant/15 p-3 text-xs text-on-surface-variant leading-5">
      <Info size={14} aria-hidden="true" className="inline mr-1"/>
      Expiry notifications and face-to-face payment confirmation for Super Admin are proposed for a later, separately approved backend phase.
      <ShieldAlert size={14} aria-hidden="true" className="inline ml-1"/>
    </p>
  </div>;
}
