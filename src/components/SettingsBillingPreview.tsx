import React from "react";
import { CreditCard, Info, Ticket, Zap, ShieldCheck, Sparkles } from "lucide-react";
import {
  MERCHANT_FREE_MONTHS,
  PROPOSED_MERCHANT_PLANS,
  merchantSubscriptionsActivationEnabled,
  merchantSubscriptionsTrialNotice,
  merchantSubscriptionPaymentNotice,
} from "../services/merchantSubscriptionsPreview";

/** Settings must not manufacture subscription entitlements, card vaults or
 * invoices. Preserve the existing billing panel/card layout for safe review.
 */
export const SettingsBillingPreview: React.FC = () => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 w-full">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/10 pb-4">
      <div className="text-left">
        <h3 className="font-headline font-bold text-lg text-on-surface">Billing & App Subscription</h3>
        <p className="text-xs text-on-surface-variant">Review proposed plans. No subscription, invoices, card linking or automatic charges are active.</p>
      </div>
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary uppercase tracking-wider self-start sm:self-auto">
        <Sparkles size={12} /> Early Partner Proposal
      </span>
    </div>
    <div className="p-6 bg-surface-container-low border border-primary/20 rounded-2xl relative overflow-hidden shadow-sm shadow-primary/5 text-left">
      <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-xl pointer-events-none" />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 text-left">
          <span className="text-[10px] uppercase font-black tracking-widest text-primary bg-primary/10 px-2.5 py-1 rounded-full">Subscription Preview</span>
          <h4 className="text-xl font-headline font-extrabold text-on-surface flex items-center gap-2 mt-1">
            Early Partner — Not Activated
          </h4>
          <p className="text-sm text-on-surface-variant max-w-xl">{merchantSubscriptionsTrialNotice()}</p>
          <div className="flex flex-wrap gap-4 pt-2 text-xs font-medium text-on-surface-variant">
            <span className="flex items-center gap-1.5 text-primary bg-primary/5 px-2.5 py-1 rounded-lg border border-primary/10">
              <ShieldCheck size={14} /> No active subscription
            </span>
            <span className="flex items-center gap-1.5 text-primary bg-primary/5 px-2.5 py-1 rounded-lg border border-primary/10">
              <Sparkles size={14} /> Features require separate activation
            </span>
          </div>
        </div>
        <div className="bg-surface-container-high/60 border border-outline-variant/10 rounded-2xl p-5 text-center shrink-0 min-w-[180px]">
          <p className="text-xs text-on-surface-variant/80 font-bold uppercase tracking-wider">Subscription Billing</p>
          <p className="text-lg font-headline font-black text-on-surface mt-1">Not Active</p>
          <span className="text-[9px] px-2 py-0.5 bg-primary/10 text-primary font-bold uppercase rounded mt-2 inline-block">
            {MERCHANT_FREE_MONTHS} months proposed per shop
          </span>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <div className="p-5 bg-surface-container-low rounded-2xl border border-outline-variant/10 space-y-4 text-left">
          <h4 className="font-headline font-bold text-base text-on-surface flex items-center gap-2 text-left">
            <Zap size={18} className="text-primary" /> Future Subscription Tiers
          </h4>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            {merchantSubscriptionPaymentNotice()} There is no permanent discount, enforced order cap or paid plan selection in this Preview.
          </p>
          <div className="space-y-3 pt-2">
            {PROPOSED_MERCHANT_PLANS.map((plan) => (
              <div key={plan.id} className="p-3 bg-surface-container-high/40 rounded-xl border border-outline-variant/5 flex items-center justify-between gap-3">
                <div className="text-left space-y-1">
                  <p className="text-xs font-black text-on-surface">LocalEats {plan.label}</p>
                  <p className="text-[10px] text-on-surface-variant">{plan.headline}</p>
                  <p className="text-[9px] text-on-surface-variant/80">{plan.proposedBenefits.join(" · ")}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-headline font-bold text-on-surface">R{plan.monthlyPriceZar} <span className="text-[9px] font-normal text-on-surface-variant">/mo</span></p>
                  <span className="text-[9px] font-bold text-primary">Proposed</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="p-5 bg-surface-container-low rounded-2xl border border-outline-variant/10 space-y-4 text-left">
          <h4 className="font-headline font-bold text-base text-on-surface flex items-center gap-2">
            <Info size={18} className="text-on-surface-variant/60" /> Company Billing Details
          </h4>
          <p className="text-xs text-on-surface-variant">Billing information cannot be collected or saved until an authorised subscription and invoicing service is available. Please do not enter tax or personal details in Preview.</p>
          <button type="button" disabled className="w-full bg-primary/10 text-primary py-2.5 rounded-xl text-xs font-black uppercase opacity-50 cursor-not-allowed">
            Save Billing Info — Unavailable
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="p-5 bg-surface-container-low rounded-2xl border border-outline-variant/10 space-y-4 text-left">
          <h4 className="font-headline font-bold text-base text-on-surface flex items-center justify-between">
            <span className="flex items-center gap-2"><CreditCard size={18} className="text-primary" /> Card Linking — Unavailable</span>
            <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-surface-container-high text-on-surface-variant px-2 py-1 rounded-full uppercase tracking-wider">Not Verified</span>
          </h4>
          <p className="text-xs text-on-surface-variant">
            No payment provider vault is connected or verified here. Do not enter card numbers, expiry dates or CVV. Future payment methods must use a provider-hosted, independently reviewed secure flow.
          </p>
          <button type="button" disabled className="w-full bg-primary text-on-primary py-2.5 rounded-xl text-xs font-black uppercase opacity-50 cursor-not-allowed">
            Secure Card Linking — Unavailable
          </button>
        </div>
        <div className="p-5 bg-surface-container-low rounded-2xl border border-outline-variant/10 space-y-4 text-left">
          <h4 className="font-headline font-bold text-base text-on-surface flex items-center gap-2">
            <Ticket size={18} className="text-on-surface-variant/60" /> Invoice & Statement History
          </h4>
          <p role="status" className="text-xs text-on-surface-variant">
            No verified invoices are available in this Preview. A missing invoice record is not proof of payment, a discount or a zero balance.
          </p>
        </div>
      </div>
    </div>
    {!merchantSubscriptionsActivationEnabled() && (
      <p role="status" className="text-xs text-on-surface-variant bg-surface-container rounded-2xl border border-outline-variant/15 px-4 py-3">
        Subscription, payments, invoices and merchant plan restrictions remain disabled. No plan is selected or paid.
      </p>
    )}
  </div>
);

export default SettingsBillingPreview;
