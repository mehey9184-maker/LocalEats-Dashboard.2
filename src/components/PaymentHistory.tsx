import React, { useState, useEffect } from "react";
import { Download, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Shop, Order, Payment } from "../types";
import { supabase } from "../lib/supabase";

interface PaymentHistoryProps {
  shopId: number;
  currentShop?: Shop;
  setShops?: React.Dispatch<React.SetStateAction<Shop[]>>;
  orders?: Order[];
  setOrders?: React.Dispatch<React.SetStateAction<Order[]>>;
}

export const PaymentHistory: React.FC<PaymentHistoryProps> = ({
  shopId,
  currentShop,
  orders = [],
}) => {
  const [paymentsSubTab, setPaymentsSubTab] = useState<"billing" | "cod">("billing");
  const [settledCodOrders, setSettledCodOrders] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("localeats_settled_cod_orders") || "[]");
    } catch {
      return [];
    }
  });

  const toggleCodSettlement = (orderId: string) => {
    setSettledCodOrders((prev) => {
      const isSettled = prev.includes(orderId);
      const next = isSettled ? prev.filter((id) => id !== orderId) : [...prev, orderId];
      localStorage.setItem("localeats_settled_cod_orders", JSON.stringify(next));

      toast.success(isSettled ? "Status updated to Pending Handover" : "Marked Cash Handover Settled!", {
        description: `Order #${orderId.slice(0, 8)} updated.`,
        icon: isSettled ? <ShieldAlert size={16} className="text-amber-500" /> : <ShieldCheck size={16} className="text-emerald-500" />,
      });
      return next;
    });
  };

  const generateFinancialAndCodReport = () => {
    try {
      const doc = new jsPDF();
      const shopName = currentShop?.name || "LocalEats Vendor";
      const dateStr = new Date().toLocaleDateString("en-ZA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      doc.setFillColor(24, 24, 27);
      doc.rect(0, 0, 210, 28, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(255, 255, 255);
      doc.text("LocalEats - Financial & COD Reconciliation Report", 14, 16);

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.text(`Store: ${shopName} | Generated: ${dateStr}`, 14, 23);

      const codOrders = orders.filter(
        (o) => o.payment_method?.toLowerCase().includes("cash") || o.payment_method?.toLowerCase().includes("cod")
      );

      const codRows = codOrders.map((o) => [
        o.id.slice(0, 8).toUpperCase(),
        o.customer_name || "Guest Customer",
        o.rider_name || "Assigned Courier",
        `R ${(Number(o.total_price) || 0).toFixed(2)}`,
        settledCodOrders.includes(o.id) ? "SETTLED & CLEARED" : "PENDING HANDOVER",
        new Date(o.created_at).toLocaleDateString("en-ZA"),
      ]);

      autoTable(doc, {
        startY: 35,
        head: [["Order ID", "Customer Name", "Courier Handshake", "Amount", "Handshake Status", "Date"]],
        body: codRows.length > 0 ? codRows : [["No COD orders logged", "-", "-", "R 0.00", "-", "-"]],
        headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: "bold" },
        styles: { fontSize: 8 },
        theme: "striped",
      });

      const filename = `Financial_COD_Report_${shopName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
      doc.save(filename);
      toast.success("Financial & COD Report downloaded!", {
        description: `Saved as ${filename}`,
        icon: <Download className="text-emerald-500" />,
      });
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("Failed to generate PDF financial report.");
    }
  };

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPayments = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("payments")
          .select("*")
          .eq("shop_id", shopId)
          .order("payment_date", { ascending: false })
          .limit(100);

        if (error) throw error;
        setPayments(data || []);
      } catch (error) {
        console.error("Error fetching payments:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPayments();
  }, [shopId]);

  return (
    <div className="w-full space-y-6 bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-xs">
      <div className="flex items-center justify-between pb-4 border-b border-outline-variant/15">
        <div>
          <h2 className="text-xl font-extrabold text-on-surface">Payment & COD Financial Ledger</h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Track subscription payments, voucher redemptions, and cash-on-delivery handshakes.
          </p>
        </div>
        <button
          onClick={generateFinancialAndCodReport}
          className="px-4 py-2 rounded-2xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all cursor-pointer shadow-xs"
        >
          <Download size={15} />
          <span>Export Financial PDF</span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setPaymentsSubTab("billing")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            paymentsSubTab === "billing" ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"
          }`}
        >
          Subscription & Billing History
        </button>
        <button
          onClick={() => setPaymentsSubTab("cod")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            paymentsSubTab === "cod" ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"
          }`}
        >
          COD Cash Reconciliation ({orders.filter((o) => o.payment_method?.toLowerCase().includes("cash")).length})
        </button>
      </div>

      {paymentsSubTab === "billing" ? (
        <div className="overflow-x-auto">
          {loading ? (
            <p className="text-xs text-on-surface-variant py-8 text-center">Loading payments...</p>
          ) : payments.length === 0 ? (
            <p className="text-xs text-on-surface-variant py-8 text-center">No payment transactions recorded.</p>
          ) : (
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
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-outline-variant/10 hover:bg-surface-container/30">
                    <td className="py-2.5 px-3 font-mono font-bold text-primary">{p.transaction_id}</td>
                    <td className="py-2.5 px-3">{p.payment_method}</td>
                    <td className="py-2.5 px-3 font-bold">R {Number(p.amount).toFixed(2)}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-600">
                        {p.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-on-surface-variant">
                      {new Date(p.payment_date).toLocaleDateString("en-ZA")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {orders
            .filter((o) => o.payment_method?.toLowerCase().includes("cash") || o.payment_method?.toLowerCase().includes("cod"))
            .map((order) => {
              const isSettled = settledCodOrders.includes(order.id);
              return (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-4 rounded-2xl bg-surface-container-low border border-outline-variant/15"
                >
                  <div>
                    <span className="text-xs font-mono font-bold text-primary">#{order.id.slice(0, 8)}</span>
                    <h4 className="font-bold text-sm text-on-surface">{order.customer_name || "Guest Customer"}</h4>
                    <p className="text-xs text-on-surface-variant">
                      Total Cash to Collect: <strong className="text-on-surface">R {Number(order.total_price || 0).toFixed(2)}</strong>
                    </p>
                  </div>
                  <button
                    onClick={() => toggleCodSettlement(order.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isSettled ? "bg-emerald-600 text-white" : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    {isSettled ? "Settled & Cleared ✓" : "Mark Settled"}
                  </button>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};

export default PaymentHistory;
