import { Download } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Order, Shop } from "../types";
import { isPickupOrder, pickupPaymentLabel } from "../services/merchantPickupPolicy";

interface PaymentHistoryProps {
  shop: Shop;
  orders: Order[];
  readState: "unverified" | "fresh" | "failed";
}

const formatAmount = (amount: number) =>
  Number.isFinite(amount) && amount >= 0 ? `R ${amount.toFixed(2)}` : "Amount unavailable";

const formatMethod = (method?: string) =>
  method === "cash" ? "Cash" : method === "card_machine" ? "Card at shop" : "Method unavailable";

export function PaymentHistory({ shop, orders, readState }: PaymentHistoryProps) {
  const rows = orders
    .filter((order) => readState !== "unverified" && isPickupOrder(order) && String(order.shop_id) === String(shop.id))
    .map((order) => ({
      id: order.id,
      amount: formatAmount(order.total_price),
      method: formatMethod(order.payment_method),
      status: pickupPaymentLabel(order),
    }));

  const exportReport = () => {
    if (readState !== "fresh" || rows.length === 0) return;
    try {
      const doc = new jsPDF();
      doc.text("LocalEats pickup payments", 14, 16);
      doc.setFontSize(10);
      doc.text(shop.name, 14, 24);
      autoTable(doc, {
        startY: 30,
        head: [["Order", "Order total", "Method", "Payment status"]],
        body: rows.map(({ id, amount, method, status }) => [id, amount, method, status]),
      });
      doc.save("localeats-pickup-payments.pdf");
    } catch {
      toast.error("Could not download the pickup payments report.");
    }
  };

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-black text-on-surface">Pickup payments</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Payment status for pickups in your Orders inbox. Confirm money received from the order in Orders.
          </p>
        </div>
        <button
          type="button"
          onClick={exportReport}
          disabled={readState !== "fresh" || rows.length === 0}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          <Download size={16} aria-hidden="true" />
          Download report
        </button>
      </div>

      {readState !== "fresh" && (
        <p role="status" className="rounded-xl bg-surface-container-high p-4 text-sm text-on-surface">
          {readState === "failed"
            ? "Orders could not be refreshed. Displayed payment statuses may be out of date."
            : "Waiting for verified order history."}
        </p>
      )}

      {rows.length > 0 ? (
        <ul className="divide-y divide-outline-variant/20 rounded-2xl border border-outline-variant/20 bg-surface-container-low">
          {rows.map(({ id, amount, method, status }) => (
            <li key={id} className="flex flex-wrap justify-between gap-3 p-4 text-sm">
              <div className="min-w-0">
                <p className="break-all font-bold text-on-surface">Order {id}</p>
                <p className="text-on-surface-variant">{method} · {status}</p>
              </div>
              <p className="font-bold text-on-surface">{amount}</p>
            </li>
          ))}
        </ul>
      ) : readState === "fresh" && (
        <p className="rounded-2xl bg-surface-container-low p-5 text-sm text-on-surface-variant">
          No pickup orders in the verified inbox.
        </p>
      )}
    </section>
  );
}
