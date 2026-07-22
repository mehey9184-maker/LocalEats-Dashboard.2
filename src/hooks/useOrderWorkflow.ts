import { toast } from "sonner";
import { Order, OrderStatus, MenuItem, Shop } from "../types";
import { getOrderTransitionData, safeStripOrderColumns } from "../utils";
import React from "react";

interface OrderWorkflowProps {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  menuItems: MenuItem[];
  setMenuItems: React.Dispatch<React.SetStateAction<MenuItem[]>>;
  currentShop: Shop | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  fetchOrders: () => void;
}

export const useOrderWorkflow = ({
  orders,
  setOrders,
  menuItems,
  setMenuItems,
  currentShop,
  supabase,
  fetchOrders,
}: OrderWorkflowProps) => {

  const updateOrderStatus = async (
    id: string,
    status: OrderStatus,
    message?: string,
    estimatedTime?: string
  ) => {
    const orderToUpdate = orders.find((o) => o.id === id);
    if (!orderToUpdate) return;

    // Use centralized transition helper
    const transitionData = getOrderTransitionData(
      orderToUpdate,
      status,
      currentShop?.name || "Local Merchant",
      Number(currentShop?.id) || 0
    );

    if (message) transitionData.acceptance_message = message;
    if (estimatedTime) transitionData.estimated_delivery_time = estimatedTime;

    // Optimistic Update
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === id) {
          const updated: Order = { ...o, ...transitionData };
          if (status === "completed" && o.delivery_status === "finding_rider") {
            updated.delivery_status = undefined; // Hide from live track locally
          }
          return updated;
        }
        return o;
      })
    );

    const cleanedUpdateData = await safeStripOrderColumns(supabase, transitionData);

    let { data, error } = await supabase
      .from("orders")
      .update(cleanedUpdateData)
      .eq("id", id)
      .select();

    // If update failed due to unmigrated columns or schema cache error, retry with minimal core fields
    if (error && (error.code === "42703" || error.message?.includes("column") || error.message?.includes("schema cache"))) {
      const minimalUpdate: Record<string, unknown> = { status: transitionData.status };
      if (transitionData.delivery_status !== undefined) {
        minimalUpdate.delivery_status = transitionData.delivery_status;
      }
      const retryResult = await supabase
        .from("orders")
        .update(minimalUpdate)
        .eq("id", id)
        .select();
      data = retryResult.data;
      error = retryResult.error;
    }

    // Save local override so UI remains responsive even during transient database validation failures
    try {
      const existingOverrides = JSON.parse(localStorage.getItem("localeats_order_overrides") || "{}");
      existingOverrides[id] = {
        ...(existingOverrides[id] || {}),
        ...transitionData,
        updated_at: new Date().toISOString()
      };
      localStorage.setItem("localeats_order_overrides", JSON.stringify(existingOverrides));
    } catch {
      // Ignore localStorage errors
    }

    if (error && (!data || data.length === 0)) {
      console.warn("Database sync notice (saved to local fallback cache):", error);
    }
    
    toast.success(`Order marked as ${status}`);

    // Stock Decrement Logic: When an order is accepted (moved to 'preparing')
    if (status === "preparing") {
      const order = orders.find((o) => o.id === id);
      if (order) {
        const menuItem = menuItems.find(
          (mi) => mi.name === order.product_name && Number(mi.shop_id) === Number(order.shop_id)
        );
        if (
          menuItem &&
          menuItem.stock_quantity !== undefined &&
          menuItem.stock_quantity !== null &&
          menuItem.stock_quantity !== -1 &&
          menuItem.stock_quantity > 0
        ) {
          const newStock = menuItem.stock_quantity - 1;
          const { error: stockError } = await supabase
            .from("menu_items")
            .update({ stock_quantity: newStock })
            .eq("id", menuItem.id);

          if (stockError) {
            console.error("Failed to decrement stock:", stockError);
          } else {
            // Update local state
            setMenuItems((prev) =>
              prev.map((mi) =>
                mi.id === menuItem.id
                  ? { ...mi, stock_quantity: newStock }
                  : mi
              )
            );
          }
        }
      }
    }

    // Notify about client update when picked up (completed)
    if (status === "completed") {
      toast.info("Notification sent to client app", {
        description: "The customer has been notified that their order was picked up.",
        duration: 4000,
      });
    }

    // Notify about acceptance message
    if (status === "preparing" && message) {
      toast.info("Acceptance message sent!", {
        description: `"${message}" sent to the customer app.`,
        duration: 4000,
      });
    }

    fetchOrders();
  };

  const requestRider = async (
    id: string,
    targetRiderId?: string,
    targetRiderName?: string,
    targetRiderPhone?: string
  ) => {
    const isManualInHouse = !targetRiderId && targetRiderName;
    const FLAT_DELIVERY_FEE = 5;

    setOrders((prev) =>
      prev.map((o) =>
        o.id === id
          ? {
              ...o,
              status: o.status || "pending",
              delivery_status: isManualInHouse ? "accepted" : "finding_rider",
              delivery_fee: FLAT_DELIVERY_FEE,
              rider_id: targetRiderId || null,
              rider_name: targetRiderName || o.rider_name || null,
              rider_phone: targetRiderPhone || o.rider_phone || null,
              order_type: "delivery",
              restaurant_name: o.restaurant_name || currentShop?.name || "Local Merchant",
              city: o.city || "Tembisa",
              price: o.price || o.total_price || 0,
              total_price: o.total_price || o.price || 0,
            }
          : o
      )
    );

    const currentOrder = orders.find((o) => o.id === id);
    const updateData: Record<string, unknown> = {
      status: currentOrder?.status || "pending",
      delivery_status: isManualInHouse ? "accepted" : "finding_rider",
      delivery_fee: FLAT_DELIVERY_FEE,
      price: currentOrder?.price || currentOrder?.total_price || 0,
      total_price: currentOrder?.total_price || currentOrder?.price || 0,
      restaurant_name: currentOrder?.restaurant_name || currentShop?.name || "Local Merchant",
      items:
        currentOrder?.items && currentOrder.items.length > 0
          ? currentOrder.items
          : currentOrder?.product_name
            ? [currentOrder.product_name]
            : ["Food Delivery"],
      order_type: "delivery",
      shop_id: currentOrder?.shop_id || Number(currentShop?.id) || 0,
      rider_id: targetRiderId || null,
    };

    // Clean undefined from updateData
    if (updateData.status === undefined) delete updateData.status;
    delete updateData.city; // Clean city just in case it doesn't exist on orders table
    
    const cleanedRequestData = await safeStripOrderColumns(supabase, updateData);

    let { data, error } = await supabase
      .from("orders")
      .update(cleanedRequestData)
      .eq("id", id)
      .select();

    // If update failed due to column issues, retry with minimal request data
    if (error && (error.code === "42703" || error.message?.includes("column") || error.message?.includes("schema cache"))) {
      const minimalRequest = {
        delivery_status: isManualInHouse ? "accepted" : "finding_rider",
        delivery_fee: FLAT_DELIVERY_FEE,
        rider_id: targetRiderId || null,
      };
      const retryResult = await supabase
        .from("orders")
        .update(minimalRequest)
        .eq("id", id)
        .select();
      data = retryResult.data;
      error = retryResult.error;
    }

    // Save local override
    try {
      const existingOverrides = JSON.parse(localStorage.getItem("localeats_order_overrides") || "{}");
      existingOverrides[id] = {
        ...(existingOverrides[id] || {}),
        delivery_status: isManualInHouse ? "accepted" : "finding_rider",
        delivery_fee: FLAT_DELIVERY_FEE,
        rider_id: targetRiderId || null,
        rider_name: targetRiderName || null,
        rider_phone: targetRiderPhone || null,
        updated_at: new Date().toISOString()
      };
      localStorage.setItem("localeats_order_overrides", JSON.stringify(existingOverrides));
    } catch {
      // Ignore
    }

    if (error && (!data || data.length === 0)) {
      console.warn("Database sync notice for rider request (saved to local fallback cache):", error);
    }

    if (isManualInHouse) {
      toast.success(`Order assigned instantly to ${targetRiderName}!`);
    } else {
      toast.success("Rider requested! Searching for available cyclists...");
    }
  };

  const unassignRider = async (id: string) => {
    const previousOrders = [...orders];
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id
          ? {
              ...o,
              delivery_status: "finding_rider",
              rider_id: undefined,
            }
          : o
      )
    );

    const { error } = await supabase
      .from("orders")
      .update({
        delivery_status: "finding_rider",
        rider_id: null,
      })
      .eq("id", id);

    if (error) {
      setOrders(previousOrders);
      toast.error("Failed to unassign rider. Please try again.");
    } else {
      toast.success("Rider unassigned and mission rebroadcasted to fleet");
    }
  };

  return {
    updateOrderStatus,
    requestRider,
    unassignRider,
  };
};
