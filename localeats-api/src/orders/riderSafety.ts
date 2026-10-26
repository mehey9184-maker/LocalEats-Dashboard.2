import { OrderContractError } from "./orderContract.js";
import { lifecycleStateFromOrder, type StoredOrder } from "./orderService.js";

// No persisted fulfillment discriminator is currently guaranteed. Do not offer or claim new work.
export const assertNewRiderWorkAllowed = (): void => {
  throw new OrderContractError(503, "FULFILLMENT_CONTRACT_REQUIRED", "New Rider work is deferred until fulfillment isolation is persisted.");
};

// Existing assignments may drain. Never infer a new delivery from an address or fee.
export const assertAssignedDelivery = (order: StoredOrder, riderId: string): void => {
  if (order.rider_id !== riderId || !riderId || order.delivery_type === "collection") {
    throw new OrderContractError(403, "FORBIDDEN", "This is not your assigned delivery.");
  }
  const state = lifecycleStateFromOrder(order);
  if (state === "delivered") return; // Retain authorized history even when old GPS is absent.
  const coordinate = (value: unknown, limit: number) =>
    (typeof value === "number" || (typeof value === "string" && value.trim() !== "")) &&
    Number.isFinite(Number(value)) && Math.abs(Number(value)) <= limit;
  if (!["rider_assigned", "picked_up", "delivering", "delivered"].includes(state) ||
      !coordinate(order.lat, 90) || !coordinate(order.lng, 180)) {
    throw new OrderContractError(409, "FULFILLMENT_CONTRACT_REQUIRED", "The existing assignment lacks safe delivery evidence.");
  }
};
