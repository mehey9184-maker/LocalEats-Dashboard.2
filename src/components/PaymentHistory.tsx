import React, {useEffect, useMemo, useState} from "react";
import {Info, ReceiptText, ShieldAlert, Store} from "lucide-react";
import {MerchantSubscriptionPlans} from "./MerchantSubscriptionPlans";
import type {Order, Shop} from "../types";

interface PaymentHistoryProps {
  shopId: string | number;
  currentShop?: Shop;
  orders?: Order[];
  /** Authenticated, fresh merchant API read for this exact shop. */
  ordersVerified?: boolean;
  /** Server-verified authenticated ownership of the currently selected shop. */
  shopVerified?: boolean;
}

const orderValue=(value:unknown)=>
  typeof value==="number" && Number.isFinite(value) && value>0
    ? `R ${value.toFixed(2)}` : "Order value unavailable";
const dateLabel=(value:string)=>{
  const timestamp=new Date(value);
  return Number.isNaN(timestamp.getTime())?"Date unavailable":timestamp.toLocaleDateString("en-ZA");
};

export const PaymentHistory:React.FC<PaymentHistoryProps>=({
  shopId,currentShop,orders=[],ordersVerified=false,shopVerified=false
})=>{
  const [tab,setTab]=useState<"pickup"|"billing">("pickup");
  const [limit,setLimit]=useState(20);
  // A new shop starts at its own first page; never retain stale pagination.
  useEffect(()=>{setLimit(20);},[shopId]);
  const verified=shopVerified && ordersVerified && !!currentShop && String(currentShop.id)===String(shopId);
  // Order records are not a bank statement or independently verified settlement ledger.
  const pickupOrders=useMemo(()=>{
    if(!verified)return [];
    return orders
      .filter(order=>String(order.shop_id)===String(shopId) && order.delivery_type==="collection")
      .slice()
      .sort((a,b)=>(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0)
        ||String(b.id).localeCompare(String(a.id)));
  },[verified,orders,shopId]);

  return <section data-testid="merchant-payments-p31"
    className="w-full min-w-0 space-y-5 bg-surface-container-lowest p-4 sm:p-6 rounded-3xl border border-outline-variant/15 shadow-xs">
    <header className="flex flex-wrap justify-between items-start gap-3 pb-4 border-b border-outline-variant/15">
      <div className="space-y-1">
        <h2 className="font-headline text-xl font-extrabold text-on-surface">Payments</h2>
        <p className="text-xs text-on-surface-variant">
          Pickup-first · Customers pay at the shop. Online checkout and merchant payouts are not active.
        </p>
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-low border border-outline-variant/15 px-3 py-1.5 text-[11px] font-bold text-on-surface-variant">
        <ShieldAlert size={14} aria-hidden="true"/> Read only
      </span>
    </header>

    <div role="note" className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 flex items-start gap-3">
      <Info size={17} aria-hidden="true" className="text-primary shrink-0 mt-0.5"/>
      <p className="text-xs leading-5 text-on-surface">
        Payment flags in order records are <strong>not cash receipts, bank statements or proof of settlement.</strong> This page cannot mark a transaction paid, received or settled.
      </p>
    </div>

    <div role="group" aria-label="Payment sections" className="flex flex-wrap gap-2">
      <button type="button" aria-pressed={tab==="pickup"} onClick={()=>setTab("pickup")}
        className={`le-press-feedback min-h-11 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${tab==="pickup"?"bg-primary text-on-primary":"bg-surface-container text-on-surface-variant"}`}>
        Pickup orders
      </button>
      <button type="button" aria-pressed={tab==="billing"} onClick={()=>setTab("billing")}
        className={`le-press-feedback min-h-11 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${tab==="billing"?"bg-primary text-on-primary":"bg-surface-container text-on-surface-variant"}`}>
        Subscription & billing
      </button>
    </div>

    {tab==="pickup"?<div aria-label="Pickup order payment information" className="le-panel-enter space-y-3">
      <div className="flex items-center gap-2">
        <ReceiptText size={17} aria-hidden="true" className="text-primary"/>
        <h3 className="font-headline text-sm font-bold text-on-surface">Pickup order payment information</h3>
      </div>
      {!verified?<div role="status" className="rounded-2xl bg-surface-container-low p-6 text-center space-y-2">
        <ShieldAlert size={23} className="mx-auto text-on-surface-variant" aria-hidden="true"/>
        <p className="font-bold text-sm text-on-surface">Verified order information unavailable</p>
        <p className="text-xs text-on-surface-variant">A fresh, authenticated order read is required for this shop. Old or browser-saved payment labels are not displayed as current.</p>
      </div>:pickupOrders.length===0?<div role="status" className="rounded-2xl bg-surface-container-low p-6 text-center space-y-2">
        <Store size={23} className="mx-auto text-on-surface-variant" aria-hidden="true"/>
        <p className="font-bold text-sm text-on-surface">No pickup orders in the verified result</p>
        <p className="text-xs text-on-surface-variant">This does not confirm that no payments occurred. No independent payment ledger is connected.</p>
      </div>:<>
        <p className="text-[11px] text-on-surface-variant">Showing order facts for {currentShop?.name||"your shop"}, not a settlement report.</p>
        <div className="space-y-2">
          {pickupOrders.slice(0,limit).map(order=>{
            const apiFlag=order.payment_status==="paid"?"Order API: marked paid"
              :order.payment_status==="unpaid"?"Order API: not marked paid":"Order payment flag unavailable";
            return <article key={order.id} className="min-w-0 flex flex-wrap justify-between items-center gap-3 rounded-2xl bg-surface-container-low border border-outline-variant/15 p-4">
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-mono font-bold text-primary">#{String(order.id).slice(0,8).toUpperCase()}</p>
                <p className="font-bold text-sm text-on-surface break-words">{order.customer_name||"Customer"}</p>
                <p className="text-[11px] text-on-surface-variant">{dateLabel(order.created_at)} · Pickup · Pay at shop</p>
              </div>
              <div className="min-w-0 sm:text-right space-y-1">
                <p className="text-sm font-bold text-on-surface">{orderValue(order.total_price)}</p>
                <p className="text-[11px] text-on-surface-variant font-semibold">{apiFlag}</p>
                <p className="text-[10px] text-on-surface-variant">Not independent payment proof</p>
              </div>
            </article>;
          })}
        </div>
        {pickupOrders.length>limit&&<button type="button" onClick={()=>setLimit(n=>n+20)}
          className="le-press-feedback min-h-11 w-full rounded-xl border border-outline-variant/20 text-primary text-xs font-bold hover:bg-primary/5">
          Show 20 more · {pickupOrders.length-limit} remaining
        </button>}
      </>}
    </div>:<div aria-label="Subscription and billing plans" className="le-panel-enter">
      <MerchantSubscriptionPlans shop={currentShop} verified={shopVerified && !!currentShop && String(currentShop.id)===String(shopId)}/>
    </div>}
  </section>;
};

export default PaymentHistory;
