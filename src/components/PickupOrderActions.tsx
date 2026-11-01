import React, { useState } from "react";
import { MerchantApi } from "../services/MerchantApi";
import {
  pickupOrderingEnabled,
  pickupState,
  pickupPaymentLabel,
  pickupAmountLabel,
  type PickupAction,
} from "../services/merchantPickupPolicy";

type DisplayMode = "full" | "summary" | "actions";

export function PickupOrderActions({ order, mode = "full", disabled = false }: {
  order: any;
  mode?: DisplayMode;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  let status: string;
  try {
    status = pickupState(order);
  } catch {
    return <p role="alert" className="text-xs text-amber-700">Pickup state unavailable. Refresh before changing this order.</p>;
  }
  const actions = status === "pending" ? ["Accept → Preparing", "Reject"]
    : status === "preparing" ? ["Mark Ready"]
    : status === "ready_for_pickup"
      ? order.payment_status === "paid" ? ["Food handed over → Collected"] : ["Confirm cash received", "Confirm card-machine payment"]
      : [];
  const canAct = pickupOrderingEnabled() && !busy && !disabled;

  const act = async (label: string) => {
    if (!canAct) return;
    const action: PickupAction = label.startsWith("Accept") ? "accept"
      : label === "Reject" ? "reject" : label === "Mark Ready" ? "ready"
      : label.startsWith("Food") ? "collect" : "confirm_payment";
    const extra: Record<string, unknown> = {};
    if (action === "reject") {
      const reason = window.prompt("Why is this order rejected?");
      if (!reason?.trim()) return;
      extra.reason = reason;
    }
    if (action === "confirm_payment") {
      if (!window.confirm("Confirm you have actually received payment at the shop?")) return;
      extra.payment_method = label.includes("cash") ? "cash" : "card_machine";
    }
    if (action === "collect") {
      if (!window.confirm("Confirm the food has actually been handed to the customer?")) return;
      extra.handover_confirmed = true;
    }
    setBusy(true);
    setError("");
    try {
      await MerchantApi.transitionPickupOrder(order, action, extra);
      window.dispatchEvent(new Event("merchant-pickup-order-confirmed"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No change was confirmed. Retry the same action.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 py-2" onClick={event => event.stopPropagation()}>
      {mode !== "actions" && (
        <>
          <p className="text-xs font-bold">
            Pickup · {status === "collected" ? "Collected" : status === "ready_for_pickup" ? "Ready" : status} · {pickupPaymentLabel(order)}
          </p>
          <p className="text-xs">{pickupAmountLabel(order)}</p>
          {order.phone && <a className="text-xs underline" href={`tel:${String(order.phone).replace(/[^+0-9]/g, "")}`}>Optional call: {order.phone}</a>}
        </>
      )}
      {mode !== "summary" && (
        <>
          <div className={mode === "actions" ? "flex flex-col gap-2" : "flex flex-wrap gap-2"}>
            {actions.map(label => {
              const primary = label.startsWith("Accept") || label === "Mark Ready" || label.startsWith("Food");
              return <button
                key={label}
                type="button"
                disabled={!canAct}
                onClick={event => { event.stopPropagation(); void act(label); }}
                title={pickupOrderingEnabled() ? "Update the pickup order through the LocalEats API" : "Requires separately approved pickup activation"}
                className={mode === "actions" && primary
                  ? `w-full py-5 ${label === "Mark Ready" ? "bg-teal-500 hover:bg-teal-400" : label.startsWith("Food") ? "bg-blue-600 hover:bg-blue-500" : "bg-emerald-600 hover:bg-emerald-500"} text-white text-lg md:text-xl font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed`
                  : mode === "actions" ? "w-full px-3 py-3 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed" : "px-3 py-2 rounded-full bg-primary text-white text-xs font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"}
              >{busy ? "Saving..." : label}</button>;
            })}
          </div>
          {pickupOrderingEnabled() && MerchantApi.hasPendingPickupCommand(order) && (
            <button type="button" disabled={busy}
              className="text-xs font-bold underline"
              onClick={async event => {
                event.stopPropagation();
                setBusy(true);
                try {
                  await MerchantApi.retryPendingPickupOrder(order);
                  window.dispatchEvent(new Event("merchant-pickup-order-confirmed"));
                  setError("");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Outcome unconfirmed.");
                } finally { setBusy(false); }
              }}
            >Retry previous action</button>
          )}
          {error && <p role="alert" className="text-xs text-error">{error}</p>}
          {!!actions.length && !pickupOrderingEnabled() && (
            <p className="text-xs text-on-surface-variant">Pickup actions are disabled until the approved pilot is activated.</p>
          )}
          {disabled && !!actions.length && <p className="text-xs text-error">Order limit reached.</p>}
        </>
      )}
    </div>
  );
}
