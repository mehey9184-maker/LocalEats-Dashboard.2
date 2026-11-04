import React, { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Shop, Order } from "../types";
import {
  verifiedShopPickupPaymentRecords,
  pickupPaymentAmount,
  pickupPaymentMethod,
  pickupPaymentRecordStatus,
  merchantPaymentWritesUnavailable,
  merchantPaymentDateLabel,
  merchantPaymentFilteredRecords,
  merchantPaymentNextVisibleCount,
  MERCHANT_PAYMENT_BATCH_SIZE,
  type MerchantPaymentStatusFilter,
  type MerchantPaymentReadState,
} from "../services/merchantPaymentsTrust";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<MerchantPaymentStatusFilter>("all");
  const [visibleCount, setVisibleCount] = useState(MERCHANT_PAYMENT_BATCH_SIZE);

  // Filters belong to one shop only; never carry a previous shop's search across.
  useEffect(() => {
    setSearchQuery("");
    setStatusFilter("all");
    setVisibleCount(MERCHANT_PAYMENT_BATCH_SIZE);
  }, [shopId]);

  // Confirmed Orders API rows can explain a collection order's recorded
  // payment state; they do not prove cash reconciliation, payouts or billing.
  const shopIsVerified = currentShop && String(currentShop.id) === String(shopId);
  const pickupOrders = shopIsVerified
    ? verifiedShopPickupPaymentRecords(orders, shopId, ordersReadState)
    : null;
  const filteredPayments = pickupOrders===null ? [] :
    merchantPaymentFilteredRecords(pickupOrders,searchQuery,statusFilter);
  const hasActiveFilters = searchQuery.trim().length>0 || statusFilter!=="all";

  const updateSearch = (value:string) => {
    setSearchQuery(value);
    setVisibleCount(MERCHANT_PAYMENT_BATCH_SIZE);
  };
  const updateStatusFilter = (value:MerchantPaymentStatusFilter) => {
    setStatusFilter(value);
    setVisibleCount(MERCHANT_PAYMENT_BATCH_SIZE);
  };
  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setVisibleCount(MERCHANT_PAYMENT_BATCH_SIZE);
  };

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
                These {pickupOrders.length} collection order records come from the confirmed Orders response. They are not settled cash or bank transactions.
              </p>
              <div className="space-y-2.5 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-3">
                <label htmlFor="collection-payment-search" className="text-xs font-bold text-on-surface">
                  Find a collection order
                </label>
                <input
                  id="collection-payment-search"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => updateSearch(event.target.value)}
                  placeholder="Search order ID or customer name"
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-3.5 py-2.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <div role="group" aria-label="Filter recorded order payment status" className="flex flex-wrap gap-2">
                  {([
                    ["all", "All records"],
                    ["paid", "Recorded paid"],
                    ["unpaid", "Not confirmed"],
                    ["unknown", "Status unavailable"],
                  ] as const).map(([value,label])=>(
                    <button key={value} type="button"
                      aria-pressed={statusFilter===value}
                      onClick={()=>updateStatusFilter(value)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        statusFilter===value ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {filteredPayments.length===0 ? (
                <div className="space-y-2 py-6 text-center">
                  <p role="status" className="text-xs text-on-surface-variant">
                    No collection order records match the current search or status filter.
                  </p>
                  {hasActiveFilters && (
                    <button type="button" onClick={clearFilters}
                      className="px-3 py-2 rounded-xl bg-primary/10 text-primary text-xs font-bold">
                      Clear search and filters
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <p aria-live="polite" className="text-xs text-on-surface-variant">
                    Showing {Math.min(visibleCount,filteredPayments.length)} of {filteredPayments.length} matching collection order records
                    {hasActiveFilters ? ` (${pickupOrders.length} total)` : ""}. Newest dated orders first; missing dates appear last.
                  </p>
                  {filteredPayments.slice(0,visibleCount).map((order) => {
                    const status = pickupPaymentRecordStatus(order.payment_status);
                    return (
                      <div key={String(order.id)}
                        className="flex items-center justify-between p-4 rounded-2xl bg-surface-container-low border border-outline-variant/15 gap-3">
                        <div>
                          <span className="text-xs font-mono font-bold text-primary">#{String(order.id).slice(0, 8)}</span>
                          <h4 className="font-bold text-sm text-on-surface">
                            {typeof order.customer_name === "string" && order.customer_name.trim() ? order.customer_name : "Customer details unavailable"}
                          </h4>
                          <p className="text-xs text-on-surface-variant">
                            Order total (not settlement): <strong className="text-on-surface">{pickupPaymentAmount(order.total_price)}</strong>
                          </p>
                          <p className="text-xs text-on-surface-variant">{pickupPaymentMethod(order.payment_method)}</p>
                          <p className="text-xs text-on-surface-variant">{merchantPaymentDateLabel(order.created_at)}</p>
                        </div>
                        <span aria-label="Read-only order payment status"
                          title="View or confirm payment using the authorised Orders workflow only"
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                            order.payment_status==="paid" ? "bg-emerald-600 text-white" :
                            order.payment_status==="unpaid" ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" :
                            "bg-surface-container-high text-on-surface-variant"
                          }`}>
                          {status}
                        </span>
                      </div>
                    );
                  })}
                  {visibleCount<filteredPayments.length && (
                    <div className="flex justify-center">
                      <button type="button" onClick={()=>setVisibleCount(count=>merchantPaymentNextVisibleCount(count,filteredPayments.length))}
                        className="px-4 py-2.5 rounded-xl bg-surface-container-high text-on-surface text-xs font-bold border border-outline-variant/20">
                        Show more records ({filteredPayments.length-Math.min(visibleCount,filteredPayments.length)} remaining)
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default PaymentHistory;
