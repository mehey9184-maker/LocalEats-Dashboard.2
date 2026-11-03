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
  // After an API-confirmed write, block further actions until the authoritative
  // list shows a changed order revision. A stale card must not submit twice.
  const [confirmedPrevious, setConfirmedPrevious] = useState<{
    orderId: string; revision: number;
  } | null>(null);
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
  const hasUnconfirmedCommand = pickupOrderingEnabled() && MerchantApi.hasPendingPickupCommand(order);
  const awaitingRefresh = confirmedPrevious !== null &&
    confirmedPrevious.orderId === String(order.id) && confirmedPrevious.revision === order.revision;
  const canAct = pickupOrderingEnabled() && !busy && !disabled &&
    !hasUnconfirmedCommand && !awaitingRefresh;
  const markConfirmed = () => {
    setConfirmedPrevious({orderId: String(order.id), revision: order.revision});
    window.dispatchEvent(new Event("merchant-pickup-order-confirmed"));
  };

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
      const method=label.includes("cash") ? "cash" : "card_machine";
      const methodLabel=method==="cash" ? "cash" : "physical card-machine";
      if (!window.confirm(
        `Have you actually received ${methodLabel} payment of R ${order.total_price.toFixed(2)} at the shop? This records PAYMENT only, not food collection.`
      )) return;
      extra.payment_method = method;
    }
    if (action === "collect") {
      if (!window.confirm("Has the customer actually received the food? Mark Collected only after physical handover; payment alone does not complete an order.")) return;
      extra.handover_confirmed = true;
    }
    setBusy(true);
    setError("");
    try {
      await MerchantApi.transitionPickupOrder(order, action, extra);
      markConfirmed();
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
          {pickupOrderingEnabled() && hasUnconfirmedCommand && !awaitingRefresh && (
            <button type="button" disabled={busy}
              className="text-xs font-bold underline"
              onClick={async event => {
                event.stopPropagation();
                setBusy(true);
                try {
                  await MerchantApi.retryPendingPickupOrder(order);
                  markConfirmed();
                  setError("");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Outcome unconfirmed.");
                } finally { setBusy(false); }
              }}
            >Retry unresolved command</button>
          )}
          {hasUnconfirmedCommand && !awaitingRefresh && (
            <p role="alert" className="text-xs text-amber-700">
              The previous command outcome is unconfirmed. Retry that same command;
              do not start another payment or handover action.
            </p>
          )}
          {awaitingRefresh && (
            <p role="status" className="text-xs text-emerald-700">
              The API confirmed the action. Waiting for refreshed order details before
              allowing another step. Use Refresh if the order card stays unchanged.
            </p>
          )}
          {error && <p role="alert" className="text-xs text-error">{error}</p>
          {!!actions.length && !pickupOrderingEnabled() && (
            <p className="text-xs text-on-surface-variant">Pickup actions are disabled until the approved pilot is activated.</p>
          )}
          {disabled && !!actions.length && <p className="text-xs text-error">Order limit reached.</p>}
        </>
      )}
    </div>
  );
}
