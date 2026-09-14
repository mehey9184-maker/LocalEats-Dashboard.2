import React from "react";
import { toast } from "sonner";
import { MerchantApi, MerchantApiError } from "../services/MerchantApi";
import type { MenuItem, Order, OrderStatus, Shop } from "../types";

interface OrderWorkflowProps {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  menuItems: MenuItem[];
  setMenuItems: React.Dispatch<React.SetStateAction<MenuItem[]>>;
  currentShop: Shop | undefined;
  // Retained temporarily so existing call sites do not need a broad UI rewrite.
  // Authoritative order mutations no longer use this frontend database adapter.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  fetchOrders: () => void;
}

const asOrder = (value: Record<string, unknown>): Order => value as unknown as Order;

const displayWorkflowError = (error: unknown): void => {
  const message =
    error instanceof MerchantApiError || error instanceof Error
      ? error.message
      : "The order could not be updated.";
  toast.error(message);
};

type MerchantTransitionAction = "accept" | "ready" | "reject" | "cancel" | "collected";

export const resolveMerchantTransitionAction = (
  order: Order,
  requestedStatus: OrderStatus,
): MerchantTransitionAction => {
  if (requestedStatus === "preparing") return "accept";
  if (requestedStatus === "ready" || requestedStatus === "ready_for_pickup") return "ready";
  if (requestedStatus === "cancelled") {
    if (order.status === "pending") return "reject";
    if (order.status === "preparing") return "cancel";
    throw new MerchantApiError(
      "Merchant cancellation is only available before an order is ready for pickup.",
      409,
    );
  }
  if (requestedStatus === "collected") {
    const isCollection = order.delivery_type === "collection" ||
      (order.delivery_type === undefined &&
        (order.order_type === "collection" || order.order_type === "pickup"));
    if ((order.status !== "ready_for_pickup" && order.status !== "ready") || !isCollection) {
      throw new MerchantApiError(
        "Only a ready collection order can be marked collected.",
        409,
      );
    }
    return "collected";
  }
  throw new MerchantApiError(
    "That order action is disabled until it has a dedicated server-authorized transition.",
    409,
  );
};

export const useOrderWorkflow = ({
  orders,
  setOrders,
  fetchOrders,
}: OrderWorkflowProps) => {
  const replaceConfirmedOrder = (order: Record<string, unknown>): void => {
    const confirmed = asOrder(order);
    setOrders((current) =>
      current.map((candidate) =>
        String(candidate.id) === String(confirmed.id) ? confirmed : candidate,
      ),
    );
  };

  const updateOrderStatus = async (
    id: string,
    status: OrderStatus,
    _message?: string,
    _estimatedTime?: string,
  ) => {
    try {
      const currentOrder = orders.find((order) => String(order.id) === String(id));
      if (!currentOrder) {
        throw new MerchantApiError("Order not found. Refresh and try again.", 404);
      }
      const action = resolveMerchantTransitionAction(currentOrder, status);
      const order = await MerchantApi.transitionOrder(id, action);
      replaceConfirmedOrder(order);

      if (action === "accept") {
        toast.success("Order accepted and moved to Preparing.");
      } else if (action === "ready") {
        toast.success(
          order.delivery_status === "finding_rider"
            ? "Order is ready. Approved riders can now claim it."
            : "Order is ready for customer pickup.",
        );
      } else if (action === "collected") {
        toast.success("Collection confirmed.");
      } else {
        toast.success(action === "reject" ? "Order rejected." : "Order cancelled.");
      }
      await fetchOrders();
    } catch (error) {
      displayWorkflowError(error);
      throw error;
    }
  };

  const requestRider = async (
    id: string,
    targetRiderId?: string,
    targetRiderName?: string,
    _targetRiderPhone?: string,
  ) => {
    try {
      if (targetRiderId || targetRiderName) {
        throw new MerchantApiError(
          "Direct rider assignment is disabled until the server can verify the rider and shop pairing.",
          409,
        );
      }
      const order = await MerchantApi.transitionOrder(id, "ready");
      replaceConfirmedOrder(order);
      toast.success("Order is ready. Approved riders can now claim it.");
      await fetchOrders();
    } catch (error) {
      displayWorkflowError(error);
      throw error;
    }
  };

  const dispatchOrderToRider = async (
    _id: string,
    _riderId: string,
    _riderName?: string,
    _riderPhone?: string,
  ) => {
    const error = new MerchantApiError(
      "Rider assignment must be claimed through the LocalEats server and cannot be set by this screen.",
      409,
    );
    displayWorkflowError(error);
    throw error;
  };

  const convertOrderToPickup = async (_id: string) => {
    const error = new MerchantApiError(
      "Changing delivery type is disabled until a server-authorized conversion flow is available.",
      409,
    );
    displayWorkflowError(error);
    throw error;
  };

  return {
    updateOrderStatus,
    requestRider,
    dispatchOrderToRider,
    convertOrderToPickup,
  };
};
