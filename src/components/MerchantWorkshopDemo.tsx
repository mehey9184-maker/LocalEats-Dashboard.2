import {useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent} from "react";
import {createPortal} from "react-dom";
import {
  BellRing, Check, CheckCircle2, Clock3, FlaskConical, Pause,
  Play, RotateCcw, ShieldCheck, ShoppingBag, SkipForward,
  UtensilsCrossed, X,
} from "lucide-react";
import {
  WORKSHOP_STAGES, advanceWorkshop, initialWorkshopState,
  type WorkshopOrder, type WorkshopStage,
} from "../services/merchantWorkshopDemoEngine";
import {isMerchantPreviewSimulatorEnabled} from "../services/merchantPreviewSimulator";
import {isIsolatedCloudflareWorkshopPreviewEnabled} from "../services/cloudflareWorkshopPreviewGuard";

const STAGE_PRESENTATION: Record<WorkshopStage, {
  title: string; step: string; icon: typeof ShoppingBag; color: string;
}> = {
  incoming: {
    title: "New orders", step: "Customer sends a pickup request", icon: BellRing,
    color: "border-amber-300 bg-amber-50 text-amber-900",
  },
  accepted: {
    title: "Accepted", step: "Merchant confirms the order", icon: Check,
    color: "border-sky-300 bg-sky-50 text-sky-900",
  },
  preparing: {
    title: "In the kitchen", step: "Food is being prepared", icon: UtensilsCrossed,
    color: "border-orange-300 bg-orange-50 text-orange-900",
  },
  ready: {
    title: "Ready for pickup", step: "Customer sees an on-screen demo update", icon: Clock3,
    color: "border-emerald-300 bg-emerald-50 text-emerald-900",
  },
  collected: {
    title: "Collected", step: "Pay at shop & handover — simulated", icon: CheckCircle2,
    color: "border-slate-300 bg-slate-50 text-slate-900",
  },
};

const WorkshopTicket = ({order}: {order: WorkshopOrder}) => (
  <article
    data-testid="workshop-fake-ticket"
    className="min-w-0 rounded-xl border border-dashed border-slate-300 bg-white p-3 shadow-sm"
  >
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-amber-950">
        {order.id}
      </span>
      <span className="text-[10px] font-extrabold uppercase text-amber-900">FAKE</span>
    </div>
    <p className="mt-2 break-words text-sm font-bold text-slate-900">{order.sampleName}</p>
    <p className="mt-1 break-words text-xs text-slate-700">{order.item}</p>
    <p className="mt-2 text-xs font-bold text-slate-800">Example R {order.examplePrice.toFixed(2)}</p>
  </article>
);

export function MerchantWorkshopDemo({onClose}: {onClose: () => void}) {
  const [state,setState] = useState(initialWorkshopState);
  const [playing,setPlaying] = useState(true);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement : null;
    closeRef.current?.focus();
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("keydown", onEscape);
      previousFocus?.focus();
    };
  }, [onClose]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      // Do not run a CPU-intensive or misleading demo while the tab is hidden.
      if (document.visibilityState === "hidden") return;
      if (!(isMerchantPreviewSimulatorEnabled() || isIsolatedCloudflareWorkshopPreviewEnabled())) return;
      setState(advanceWorkshop);
    }, 2200);
    return () => window.clearInterval(timer);
  }, [playing]);

  const columns = useMemo(() => WORKSHOP_STAGES.map((stage) => ({
    stage,
    orders: state.orders.filter((order) => order.stage === stage),
  })), [state.orders]);

  const onDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const controls = dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])");
    if (!controls?.length) return;
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  };

  // Second guard: even a direct import cannot open the workshop in Production.
  if (typeof document === "undefined" ||
      !(isMerchantPreviewSimulatorEnabled() || isIsolatedCloudflareWorkshopPreviewEnabled())) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-slate-950/80 p-2 backdrop-blur-sm sm:p-5">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="merchant-workshop-title"
        aria-describedby="merchant-workshop-disclaimer"
        onKeyDown={onDialogKeyDown}
        className="max-h-[96dvh] w-full max-w-7xl overflow-y-auto rounded-2xl bg-slate-50 text-slate-950 shadow-2xl sm:rounded-3xl"
      >
        <header className="sticky top-0 z-10 border-b border-amber-300 bg-amber-100 p-4 sm:px-6 sm:py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="inline-flex items-center gap-1.5 rounded-full border border-amber-500 bg-white px-3 py-1 text-[11px] font-black uppercase tracking-wide text-amber-950">
                <FlaskConical size={15} aria-hidden="true"/> Demo only · No real orders
              </p>
              <h2 id="merchant-workshop-title" className="mt-2 font-headline text-xl font-black sm:text-2xl">
                LocalEats Kitchen Workshop
              </h2>
              <p id="merchant-workshop-disclaimer" className="mt-1 max-w-3xl text-xs leading-5 text-amber-950 sm:text-sm">
                Watch fictional pickup orders move through a shop. This is a sped-up
                training animation, <strong>not</strong> a real order, payment,
                push notification, kitchen performance measurement or live feed.
              </p>
            </div>
            <button
              ref={closeRef} type="button" onClick={onClose} aria-label="Close the workshop demo"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-400 bg-white px-3 text-xs font-bold text-amber-950 hover:bg-amber-50"
            >
              <X size={17} aria-hidden="true"/> Close
            </button>
          </div>
        </header>

        <div className="space-y-5 p-3 sm:p-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${playing ? "bg-emerald-100 text-emerald-900" : "bg-slate-200 text-slate-800"}`}>
                  <span aria-hidden="true" className={`h-2 w-2 rounded-full ${playing ? "animate-pulse bg-emerald-600 motion-reduce:animate-none" : "bg-slate-500"}`}/>
                  {playing ? "Autoplaying fictional orders" : "Demo paused"}
                </span>
                <span className="text-xs font-semibold text-slate-600">Simulation step {state.tick}</span>
                <span className="text-xs font-semibold text-slate-600">· {state.completedTotal} sample handovers</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                Every few seconds, an example order arrives, gets accepted, is prepared, marked
                ready, and collected after a simulated pay-at-shop handover.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setPlaying((prev) => !prev)}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-bold text-white md:flex-none">
                {playing ? <Pause size={15} aria-hidden="true"/> : <Play size={15} aria-hidden="true"/>}
                {playing ? "Pause" : "Resume"}
              </button>
              <button type="button" onClick={() => setState(advanceWorkshop)}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 md:flex-none">
                <SkipForward size={15} aria-hidden="true"/> Next step
              </button>
              <button type="button" onClick={() => {setState(initialWorkshopState()); setPlaying(true);}}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 md:flex-none">
                <RotateCcw size={15} aria-hidden="true"/> Restart
              </button>
            </div>
          </div>

          <section aria-label="Fictional order journey" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {columns.map(({stage,orders}) => {
              const meta = STAGE_PRESENTATION[stage];
              const Icon = meta.icon;
              return (
                <div key={stage} className={`min-w-0 rounded-2xl border-2 p-3 ${meta.color}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon size={19} aria-hidden="true"/>
                      <h3 className="text-sm font-extrabold">{meta.title}</h3>
                    </div>
                    <span className="min-w-7 rounded-full bg-white px-2 py-1 text-center text-xs font-black text-slate-900">
                      {orders.length}
                    </span>
                  </div>
                  <p className="mt-2 min-h-9 text-xs leading-4">{meta.step}</p>
                  <div className="mt-3 space-y-2">
                    {orders.length
                      ? orders.map((order) => <WorkshopTicket key={order.id} order={order}/>)
                      : <p className="rounded-lg border border-dashed border-current/20 bg-white/60 px-3 py-5 text-center text-xs font-medium opacity-80">
                          Waiting for next sample
                        </p>
                    }
                  </div>
                </div>
              );
            })}
          </section>

          <div className="grid gap-3 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-4" aria-labelledby="workshop-events-heading">
              <h3 id="workshop-events-heading" className="flex items-center gap-2 text-base font-extrabold">
                <BellRing size={18} className="text-amber-700" aria-hidden="true"/>
                On-screen demo updates
              </h3>
              <p className="mt-1 text-xs text-slate-600">These messages are not Firebase or device notifications.</p>
              <p className="sr-only" aria-live="polite">{state.events[0]?.message}</p>
              <ol className="mt-3 space-y-2">
                {state.events.map((event) => <li key={event.id} className="rounded-lg bg-slate-50 p-2.5 text-xs leading-5 text-slate-800">
                  <strong className="mr-2 text-amber-900">Step {event.tick}</strong>{event.message}
                </li>)}
              </ol>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-4" aria-labelledby="workshop-safety-heading">
              <h3 id="workshop-safety-heading" className="flex items-center gap-2 text-base font-extrabold">
                <ShieldCheck size={18} className="text-emerald-700" aria-hidden="true"/>
                What a vendor can learn
              </h3>
              <ul className="mt-3 list-inside list-disc space-y-2 text-sm leading-6 text-slate-700">
                <li>How new pickup tickets move through a kitchen queue</li>
                <li>What Accepted, Preparing and Ready mean to a shop owner</li>
                <li>Why the customer pays at the shop before handover</li>
                <li>How a merchant can follow an order without activating delivery</li>
              </ul>
              <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-900">
                There are no customer accounts, live order commands, network
                requests, payment confirmations, FCM alerts, printer jobs,
                backend writes or stored records in this workshop.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
