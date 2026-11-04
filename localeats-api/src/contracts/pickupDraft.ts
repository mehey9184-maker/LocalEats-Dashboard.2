/** Shared pure pickup contract. Database RPCs enforce the same business guards atomically. */
import { createHash } from "node:crypto";

export type DraftPickupStatus = "pending" | "preparing" | "ready_for_pickup" | "collected" | "cancelled";
export type DraftPickupAction = "accept" | "ready" | "reject" | "cancel" | "confirm_payment" | "collect";
export interface DraftPickupState {
  status: DraftPickupStatus;
  payment: "unpaid" | "paid";
  revision: number;
  paymentMethod?: "cash" | "card_machine";
}
export interface DraftPickupCommand {
  action: DraftPickupAction;
  actor: "customer" | "merchant";
  authorized: boolean; // Server-derived ownership result, never accepted from a request body.
  orderId: string;
  actorUid: string;
  paymentMethod?: "cash" | "card_machine";
  handoverConfirmed?: boolean;
  expectedRevision: number;
  commandId: string;
  reason?: string;
}
export interface DraftPickupEvent {
  orderId: string;
  actorUid: string;
  commandId: string;
  commandHash: string;
  kind: "accepted" | "ready" | "merchant_rejected" | "customer_cancelled" | "payment_confirmed" | "collected";
  revision: number;
}
export class DraftContractError extends Error {
  constructor(public code: string) { super(code); }
}

// Deterministic keys; array order remains meaningful. API must normalize/validate intent first.
const canonical = (value: unknown): string => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
  }
  throw new DraftContractError("INVALID_CANONICAL_INPUT");
};
export const draftHash = (normalized: unknown): string => createHash("sha256").update(canonical(normalized)).digest("hex");

export interface DraftPriceConsent {
  currency: "ZAR";
  totalMinor: number;
  pricingFingerprint: string;
}
export const draftAssertConsent = (accepted: DraftPriceConsent, current: DraftPriceConsent): void => {
  if (accepted.currency !== "ZAR" || current.currency !== "ZAR" ||
      !Number.isSafeInteger(accepted.totalMinor) || accepted.totalMinor < 0 ||
      !Number.isSafeInteger(current.totalMinor) || current.totalMinor < 0 ||
      !/^[0-9a-f]{64}$/.test(accepted.pricingFingerprint) || !/^[0-9a-f]{64}$/.test(current.pricingFingerprint)) {
    throw new DraftContractError("INVALID_PRICE_CONSENT");
  }
  if (accepted.totalMinor !== current.totalMinor || accepted.pricingFingerprint !== current.pricingFingerprint) {
    throw new DraftContractError("PRICE_CHANGED");
  }
};

export const draftReplayCreation = (
  existing: { userId: string; createIntentHash: string | null; orderId: string } | null,
  userId: string, intentHash: string,
): string | null => {
  if (!userId) throw new DraftContractError("UNAUTHORIZED");
  if (!existing) return null;
  if (existing.userId !== userId || !existing.orderId || !existing.createIntentHash ||
      !/^[0-9a-f]{64}$/.test(intentHash) || existing.createIntentHash !== intentHash) {
    throw new DraftContractError("IDEMPOTENCY_CONFLICT");
  }
  return existing.orderId; // No catalog, clock, payment-method projection or current shop lookup.
};

export const draftTransition = (
  state: DraftPickupState, command: DraftPickupCommand, recorded?: DraftPickupEvent,
): { state: DraftPickupState; event: DraftPickupEvent; replayed: boolean } => {
  if (!command.authorized || !command.orderId || !command.actorUid) throw new DraftContractError("FORBIDDEN");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(command.commandId) || (!Number.isSafeInteger(command.expectedRevision) || command.expectedRevision < 0)) {
    throw new DraftContractError("INVALID_COMMAND");
  }
  if ((command.action !== "confirm_payment" && command.paymentMethod !== undefined) ||
      (command.action !== "collect" && command.handoverConfirmed !== undefined) ||
      (!["reject","cancel"].includes(command.action) && command.reason !== undefined)) throw new DraftContractError("INVALID_COMMAND");
  const commandHash = draftHash({...command,...(command.reason !== undefined ? {reason:command.reason.trim()} : {})});
  if (recorded) {
    if (recorded.orderId !== command.orderId || recorded.actorUid !== command.actorUid || recorded.commandId !== command.commandId || recorded.commandHash !== commandHash) {
      throw new DraftContractError("IDEMPOTENCY_CONFLICT");
    }
    return {state, event: recorded, replayed: true};
  }
  if (state.revision !== command.expectedRevision) throw new DraftContractError("ORDER_STATE_CHANGED");
  if (!["pending", "preparing", "ready_for_pickup", "collected", "cancelled"].includes(state.status) ||
      !["unpaid", "paid"].includes(state.payment) || !Number.isSafeInteger(state.revision) || state.revision < 0 ||
      (["pending", "preparing", "cancelled"].includes(state.status) && state.payment !== "unpaid") ||
      (state.status === "collected" && state.payment !== "paid") ||
      ["collected", "cancelled"].includes(state.status)) throw new DraftContractError("INVALID_ORDER_TRANSITION");
  const requiredActor = command.action === "cancel" ? "customer" : "merchant";
  if (command.actor !== requiredActor) throw new DraftContractError("FORBIDDEN");
  if (!Number.isSafeInteger(state.revision + 1)) throw new DraftContractError("INVALID_REVISION");
  const next = {...state, revision: state.revision + 1};
  let kind: DraftPickupEvent["kind"];
  switch (command.action) {
    case "accept":
      if (state.status !== "pending") throw new DraftContractError("INVALID_ORDER_TRANSITION");
      next.status = "preparing"; kind = "accepted"; break;
    case "ready":
      if (state.status !== "preparing") throw new DraftContractError("INVALID_ORDER_TRANSITION");
      next.status = "ready_for_pickup"; kind = "ready"; break;
    case "reject": case "cancel":
      if (state.status !== "pending" || !command.reason?.trim() || command.reason.trim().length > 500) {
        throw new DraftContractError("INVALID_CANCELLATION");
      }
      next.status = "cancelled"; kind = command.action === "reject" ? "merchant_rejected" : "customer_cancelled"; break;
    case "confirm_payment":
      if (state.status !== "ready_for_pickup" || state.payment !== "unpaid") throw new DraftContractError("INVALID_PAYMENT_TRANSITION");
      if (!["cash", "card_machine"].includes(command.paymentMethod ?? "")) throw new DraftContractError("INVALID_PAYMENT_METHOD");
      next.paymentMethod = command.paymentMethod;
      next.payment = "paid"; kind = "payment_confirmed"; break;
    case "collect":
      if (state.status !== "ready_for_pickup" || state.payment !== "paid") throw new DraftContractError("PAYMENT_CONFIRMATION_REQUIRED");
      if (command.handoverConfirmed !== true) throw new DraftContractError("HANDOVER_CONFIRMATION_REQUIRED");
      next.status = "collected"; kind = "collected"; break;
    default: throw new DraftContractError("INVALID_COMMAND");
  }
  return {state: next, event: {orderId:command.orderId, actorUid:command.actorUid, commandId:command.commandId, commandHash, kind, revision:next.revision}, replayed:false};
};
