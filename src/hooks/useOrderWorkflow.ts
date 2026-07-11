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
    const previousOrders = [...orders];
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

    const { data, error } = await supabase
      .from("orders")
      .update(cleanedUpdateData)
      .eq("id", id)
      .select();

    if (error || !data || data.length === 0) {
      console.error("Update Order Status Error:", error || "RLS Policy blocked the update (0 rows affected)");
      setOrders(previousOrders);
      toast.error("We couldn't update the order status. You may not have permission.");
    } else {
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
    }
  };

  const requestRider = async (
    id: string,
    targetRiderId?: string,
    targetRiderName?: string,
    targetRiderPhone?: string
  ) => {
    const previousOrders = [...orders];
    const isManualInHouse = !targetRiderId && targetRiderName;
    const FLAT_DELIVERY_FEE = 5;

    setOrders((prev) =>
      prev.map((o) =>
        o.id === id
          ? {
              ...o,
              status: "accepted",
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
      status: "accepted",
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

    const { data, error } = await supabase
      .from("orders")
      .update(cleanedRequestData)
      .eq("id", id)
      .select();

    if (error || !data || data.length === 0) {
      console.error("Request Rider Error:", error || "RLS Policy blocked the update (0 rows affected)");
      setOrders(previousOrders);
      toast.error(`We couldn't request a rider right now. You may not have permission.`);
    } else {
      if (isManualInHouse) {
        toast.success(`Order assigned instantly to ${targetRiderName}!`);
      } else {
        toast.success("Rider requested! Searching for available cyclists...");
      }
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
