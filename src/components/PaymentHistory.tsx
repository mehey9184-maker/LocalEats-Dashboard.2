import React, { useState } from "react";
import { Download } from "lucide-react";
import { Shop, Order } from "../types";
import {
  verifiedShopPickupPaymentRecords,
  pickupPaymentAmount,
  pickupPaymentMethod,
  pickupPaymentRecordStatus,
  merchantPaymentWritesUnavailable,
  type MerchantPaymentReadState,
} from "../services/merchantPaymentsTrust";
import {
  MERCHANT_FREE_MONTHS,
  PROPOSED_MERCHANT_PLANS,
  merchantSubscriptionsActivationEnabled,
  merchantSubscriptionsTrialNotice,
  merchantSubscriptionPaymentNotice,
} from "../services/merchantSubscriptionsPreview";

interface PaymentHistoryProps {
  shopId: number;
  currentShop?: Shop;
  setShops?: React.Dispatch<React.SetStateAction<Shop[]>>;
  orders?: Order[];
  setOrders?: React.Dispatch<React.SetStateAction<Order[]>>;
  ordersReadState?: MerchantPaymentReadState;
}

export const PaymentHistory: React.FC<PaymentHistoryProps> = ({
  shopId,
  currentShop,
  orders = [],
  ordersReadState = "checking",
}) => {
  const [paymentsSubTab, setPaymentsSubTab] = useState<"billing" | "cod">("billing");

  // Confirmed Orders API rows can explain a collection order's recorded
  // payment state; they do not prove cash reconciliation, payouts or billing.
  const shopIsVerified = currentShop && String(currentShop.id) === String(shopId);
  const pickupOrders = shopIsVerified
    ? verifiedShopPickupPaymentRecords(orders, shopId, ordersReadState)
    : null;

  return (
    <div className="w-full space-y-6 bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xs">
      <div className="flex items-center justify-between pb-4 border-b border-outline-variant/15">
        <div>
          <h2 className="text-xl font-extrabold text-on-surface">Payments — Read-only Overview</h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Review verified collection-order payment records. Bank settlement, subscriptions and billing are not verified here.
          </p>
        </div>
        <button
          type="button"
          disabled={merchantPaymentWritesUnavailable()}
          title="Financial exports require an authoritative billing and settlement API"
          className="px-4 py-2 rounded-2xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={15} />
          <span>Export Unavailable</span>
        </button>
      </div>

      <p role="status" className="text-xs text-on-surface-variant rounded-2xl border border-outline-variant/15 px-4 py-3 bg-surface-container-low">
        Payments Preview only — no funds, cash handovers, card-machine settlements, refunds or subscription charges are confirmed or changed on this page.
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setPaymentsSubTab("billing")}
          aria-pressed={paymentsSubTab === "billing"}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            paymentsSubTab === "billing" ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"
          }`}
        >
          Subscription & Billing History
        </button>
        <button
          type="button"
          onClick={() => setPaymentsSubTab("cod")}
          aria-pressed={paymentsSubTab === "cod"}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            paymentsSubTab === "cod" ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"
          }`}
        >
          Collection Payment Records ({pickupOrders?.length ?? "—"})
        </button>
      </div>

      {paymentsSubTab === "billing" ? (
        <div className="space-y-5">
          <section aria-labelledby="merchant-subscription-preview-heading" className="space-y-3">
            <div>
              <h3 id="merchant-subscription-preview-heading" className="text-sm font-extrabold text-on-surface">
                Proposed shop subscriptions — Preview only
              </h3>
              <p className="text-xs text-on-surface-variant">
                {MERCHANT_FREE_MONTHS} free calendar months per shop after verified trading launch. Tier benefits are proposals, not active features.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PROPOSED_MERCHANT_PLANS.map((plan) => (
                <article key={plan.id} className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4 space-y-2">
                  <h4 className="text-sm font-extrabold text-on-surface">{plan.label}</h4>
                  <p className="text-lg font-extrabold text-on-surface">R{plan.monthlyPriceZar}<span className="text-xs font-medium text-on-surface-variant">/month per shop</span></p>
                  <p className="text-xs font-bold text-on-surface">{plan.headline}</p>
                  <ul className="list-disc pl-4 space-y-1 text-xs text-on-surface-variant">
                    {plan.proposedBenefits.map((benefit) => <li key={benefit}>{benefit}</li>)}
                  </ul>
                  <p className="text-xs text-on-surface-variant">Proposed — not available to select</p>
                </article>
              ))}
            </div>
            {!merchantSubscriptionsActivationEnabled() && (
              <div role="status" className="space-y-1 text-xs text-on-surface-variant bg-surface-container border border-outline-variant/15 rounded-2xl p-3">
                <p>{merchantSubscriptionsTrialNotice()}</p>
                <p>{merchantSubscriptionPaymentNotice()}</p>
              </div>
            )}
          </section>
          <div className="overflow-x-auto">
          <p role="status" className="text-xs text-on-surface-variant py-4">
            Verified subscription and billing transactions are unavailable. An authoritative payment API is required before presenting a financial ledger.
          </p>
          <table className="w-full text-left text-xs text-on-surface">
            <thead>
              <tr className="border-b border-outline-variant/15 text-on-surface-variant font-bold">
                <th className="py-2.5 px-3">Transaction ID</th>
                <th className="py-2.5 px-3">Method</th>
                <th className="py-2.5 px-3">Amount</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Date</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="text-xs text-on-surface-variant py-8 text-center">
                  No verified billing records are available in this Preview. This does not mean that no transactions exist.
                </td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {pickupOrders === null ? (
            <p role="status" className="text-xs text-on-surface-variant py-8 text-center">
              Collection payment records are unavailable until this shop's Orders API read is confirmed. Check Orders for current status.
            </p>
          ) : pickupOrders.length === 0 ? (
            <p role="status" className="text-xs text-on-surface-variant py-8 text-center">
              No collection orders were found in the current verified Orders response. No settlement conclusion can be drawn.
            </p>
          ) : (
            <>
              <p className="text-xs text-on-surface-variant">
                Showing {pickupOrders.length} collection order records from the confirmed Orders response. These are not settled cash or bank transactions.
              </p>
              {pickupOrders.map((order) => {
                const status = pickupPaymentRecordStatus(order.payment_status);
                return (
                  <div
                    key={String(order.id)}
                    className="flex items-center justify-between p-4 rounded-2xl bg-surface-container-low border border-outline-variant/15 gap-3"
                  >
                    <div>
                      <span className="text-xs font-mono font-bold text-primary">#{String(order.id).slice(0, 8)}</span>
                      <h4 className="font-bold text-sm text-on-surface">
                        {typeof order.customer_name === "string" && order.customer_name.trim() ? order.customer_name : "Customer details unavailable"}
                      </h4>
                      <p className="text-xs text-on-surface-variant">
                        Order total (not settlement): <strong className="text-on-surface">{pickupPaymentAmount(order.total_price)}</strong>
                      </p>
                      <p className="text-xs text-on-surface-variant">{pickupPaymentMethod(order.payment_method)}</p>
                    </div>
                    <span
                      aria-label="Read-only order payment status"
                      title="View or confirm payment using the authorised Orders workflow only"
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                        order.payment_status === "paid" ? "bg-emerald-600 text-white" : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                      }`}
                    >
                      {status}
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default PaymentHistory;
