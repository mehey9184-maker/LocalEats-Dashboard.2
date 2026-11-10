import {useState} from "react";
import {FlaskConical, RefreshCw, X, ShoppingBag} from "lucide-react";

// L1C-3 review fixture. This component has NO order/API callbacks or persistence.
// Even an accidental production build flag cannot display it on a live domain.
const allowPreviewFakeOrders =
  import.meta.env.VITE_MERCHANT_PREVIEW_READ_ONLY === "true" &&
  import.meta.env.VITE_MERCHANT_FAKE_ORDERS_ENABLED === "true" &&
  typeof window !== "undefined" &&
  /^local-eats-dashboard-2-6m8o-[a-z0-9]+-mehey9184-makers-projects\.vercel\.app$/.test(window.location.hostname);

type DemoStatus = "pending" | "preparing" | "ready" | "completed";
type DemoOrder = {id: string; name: string; item: string; total: number; status: DemoStatus};

const DEMO_FIXTURES: readonly DemoOrder[] = [
  {id: "FAKE-001", name: "Test Customer A", item: "Kota", total: 25, status: "pending"},
  {id: "FAKE-002", name: "Test Customer B", item: "Kota + Chips", total: 40, status: "preparing"},
  {id: "FAKE-003", name: "Test Customer C", item: "Kota", total: 25, status: "ready"},
];

const nextStatus: Record<DemoStatus, DemoStatus> = {
  pending: "preparing",
  preparing: "ready",
  ready: "completed",
  completed: "completed",
};

const labels: Record<DemoStatus, string> = {
  pending: "New",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
};

export function PreviewFakeOrders() {
  const [demoOrders, setDemoOrders] = useState<DemoOrder[]>([]);
  if (!allowPreviewFakeOrders) return null;

  const loadDemo = () => setDemoOrders(DEMO_FIXTURES.map(order => ({...order})));
  const clearDemo = () => setDemoOrders([]);
  const advance = (id: string) =>
    setDemoOrders(prev => prev.map(order => order.id === id
      ? {...order, status: nextStatus[order.status]}
      : order));

  return (
    <section data-testid="preview-fake-orders" aria-label="Fake test orders" className="rounded-2xl border border-dashed border-amber-400/70 bg-amber-50/60 dark:bg-amber-950/20 p-3 space-y-3">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <FlaskConical size={16} className="text-amber-700 dark:text-amber-300" aria-hidden="true"/>
          <strong className="text-xs text-on-surface">Fake orders</strong>
          <span className="rounded-full bg-amber-200 text-amber-950 px-2 py-0.5 text-[10px] font-black">TEST ONLY</span>
          <span className="text-[11px] text-on-surface-variant">Browser only · not sent to a shop</span>
        </div>
        {demoOrders.length === 0 ? (
          <button type="button" onClick={loadDemo} className="inline-flex items-center gap-2 rounded-xl bg-primary text-on-primary px-3 py-2 text-xs font-bold">
            <FlaskConical size={14} aria-hidden="true"/> Load 3 fake orders
          </button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={loadDemo} className="inline-flex items-center gap-1 rounded-xl border border-outline-variant/25 px-3 py-2 text-xs font-bold">
              <RefreshCw size={13} aria-hidden="true"/> Reset test
            </button>
            <button type="button" onClick={clearDemo} className="inline-flex items-center gap-1 rounded-xl border border-outline-variant/25 px-3 py-2 text-xs font-bold">
              <X size={13} aria-hidden="true"/> Remove fake orders
            </button>
          </div>
        )}
      </div>
      {demoOrders.length > 0 && (
        <>
          <p role="status" className="text-xs font-medium text-amber-900 dark:text-amber-200">
            These {demoOrders.length} fictional orders are not in your real queue, reports, alerts, or database. Status buttons only change this local demo.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {demoOrders.map(order => (
              <article key={order.id} className="rounded-xl bg-surface-container-lowest border border-amber-300/65 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black text-amber-800 dark:text-amber-200">{order.id} · FAKE</span>
                  <span className="rounded-full bg-amber-100 text-amber-950 px-2 py-0.5 text-[10px] font-bold">{labels[order.status]}</span>
                </div>
                <p className="text-sm font-bold text-on-surface">{order.name}</p>
                <p className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                  <ShoppingBag size={13} aria-hidden="true"/> {order.item} · R {order.total.toFixed(2)}
                </p>
                <button
                  type="button"
                  onClick={() => advance(order.id)}
                  disabled={order.status === "completed"}
                  className="w-full rounded-lg bg-primary/10 text-primary px-3 py-2 text-xs font-bold disabled:opacity-50"
                  aria-label={`Demo only: advance ${order.id} from ${labels[order.status]}`}
                >
                  {order.status === "completed" ? "Test completed" : `Simulate → ${labels[nextStatus[order.status]]}`}
                </button>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
