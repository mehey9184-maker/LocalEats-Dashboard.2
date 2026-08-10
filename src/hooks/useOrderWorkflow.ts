import { toast } from "sonner";
import { Order, OrderStatus, MenuItem, Shop } from "../types";
import { getOrderTransitionData, safeStripOrderColumns } from "../utils";
import { sendPushNotification } from "../lib/firebase";
import { validateDeliveryRadius, checkDeliveryRadiusRPC } from "../utils/deliveryRadius";
import { queueOfflineMutation } from "../utils/offlineSyncQueue";
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

    if ((error && (!data || data.length === 0)) || !navigator.onLine) {
      console.warn("Database sync notice (saved to offline queue for background sync):", error);
      void queueOfflineMutation({
        type: "UPDATE_ORDER",
        payload: {
          id,
          status: transitionData.status,
          delivery_status: transitionData.delivery_status,
          cancellation_reason: message,
        },
      });
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

    // Delivery Radius Validation Check
    const shopLat = currentShop?.lat ?? -25.9984;
    const shopLng = currentShop?.lng ?? 28.2268;
    const custLat = currentOrder?.lat;
    const custLng = currentOrder?.lng;
    const maxRadiusKm = currentShop?.delivery_radius_km ?? 10;
    const isRadiusEnabled = currentShop?.delivery_radius_enabled ?? true;

    if (isRadiusEnabled && custLat && custLng) {
      const radiusResult = validateDeliveryRadius(
        shopLat,
        shopLng,
        custLat,
        custLng,
        maxRadiusKm,
        true
      );

      if (!radiusResult.isWithin) {
        toast.warning(
          `⚠️ Delivery Radius Warning: Order #${id.substring(0, 8)} (${radiusResult.distanceKm} km away) is outside your shop's ${maxRadiusKm} km delivery limit!`,
          {
            description: "Dispatching request anyway, but delivery fee or rider matching may be affected.",
            duration: 7000,
          }
        );
      } else {
        toast.success(
          `📍 Verified inside delivery zone (${radiusResult.distanceKm} km / ${maxRadiusKm} km max)`
        );
      }

      // Execute database RPC validation asynchronously
      if (supabase) {
        void checkDeliveryRadiusRPC(supabase, {
          shopLat,
          shopLng,
          custLat,
          custLng,
          maxRadiusKm,
        });
      }
    }

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
            ? [{ name: currentOrder.product_name, price: currentOrder?.price || currentOrder?.total_price || 0, quantity: 1 }]
            : [{ name: "Food Delivery", price: currentOrder?.price || currentOrder?.total_price || 0, quantity: 1 }],
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

  const dispatchOrderToRider = async (
    id: string,
    riderId: string,
    riderName?: string,
    riderPhone?: string
  ) => {
    const orderToDispatch = orders.find((o) => o.id === id);
    if (!orderToDispatch) return;

    // Local Optimistic Update
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id
          ? {
              ...o,
              status: "dispatched" as OrderStatus,
              delivery_status: "accepted",
              rider_id: riderId,
              rider_name: riderName || o.rider_name || "Linked Courier",
              rider_phone: riderPhone || o.rider_phone || "",
            }
          : o
      )
    );

    const updateData = {
      status: "dispatched",
      delivery_status: "accepted",
      rider_id: riderId,
      rider_name: riderName || "Linked Courier",
      rider_phone: riderPhone || "",
    };

    const cleanedData = await safeStripOrderColumns(supabase, updateData);

    const { error } = await supabase
      .from("orders")
      .update(cleanedData)
      .eq("id", id);

    if (error) {
      console.warn("[Dispatch] DB sync warning, saved to local cache:", error);
    }

    // Save local override
    try {
      const existingOverrides = JSON.parse(localStorage.getItem("localeats_order_overrides") || "{}");
      existingOverrides[id] = {
        ...(existingOverrides[id] || {}),
        status: "dispatched",
        delivery_status: "accepted",
        rider_id: riderId,
        rider_name: riderName || "Linked Courier",
        rider_phone: riderPhone || "",
        updated_at: new Date().toISOString()
      };
      localStorage.setItem("localeats_order_overrides", JSON.stringify(existingOverrides));
    } catch {
      // ignore
    }

    // Trigger FCM Push Notification directly to the assigned rider!
    try {
      await sendPushNotification({
        userId: riderId,
        title: "🍕 New Delivery Mission Assigned!",
        body: `Order #${id.slice(-4)} is ready for pickup at ${currentShop?.name || 'LocalEats Store'}.`,
        data: {
          order_id: id,
          type: "mission_dispatched",
          shop_id: String(currentShop?.id || 0),
        },
      });
    } catch (fcmError) {
      console.warn("[FCM] Push notification dispatch error:", fcmError);
    }

    toast.success(`Mission dispatched directly to ${riderName || 'Linked Courier'}! 🚀`);
  };

  const convertOrderToPickup = async (id: string) => {
    const targetOrder = orders.find((o) => o.id === id);
    if (!targetOrder) return;

    const pickupMessage = "No driver available. Store requested Customer Self-Pickup / Collection.";
    const pickupNote = "[Store requested self-pickup: No courier available]";

    // Local Optimistic Update
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id
          ? {
              ...o,
              order_type: "collection",
              delivery_status: null,
              acceptance_message: pickupMessage,
              notes: o.notes?.includes(pickupNote)
                ? o.notes
                : `${o.notes || ''} ${pickupNote}`.trim(),
            }
          : o
      )
    );

    const updateData = {
      order_type: "collection",
      delivery_status: null,
      acceptance_message: pickupMessage,
      notes: targetOrder.notes?.includes(pickupNote)
        ? targetOrder.notes
        : `${targetOrder.notes || ''} ${pickupNote}`.trim(),
    };

    const cleanedData = await safeStripOrderColumns(supabase, updateData);

    await supabase.from("orders").update(cleanedData).eq("id", id);

    // 1. Send Supabase Realtime Broadcast to client app
    try {
      const channel = supabase.channel(`client_order_tracking_${id}`);
      await channel.send({
        type: "broadcast",
        event: "pickup_requested",
        payload: {
          order_id: id,
          title: "🛍️ No Delivery Driver Available - Self-Pickup Required",
          body: `Order #${id.slice(-4)}: Our store currently has no available delivery driver. Please come collect your order!`,
          acceptance_message: pickupMessage,
          order_type: "collection",
          delivery_status: null,
        },
      });
    } catch (bcErr) {
      console.warn("Realtime broadcast error:", bcErr);
    }

    // 2. Trigger FCM Push Notification to Customer (user_id or phone or order_id)
    const recipientId = targetOrder.user_id || targetOrder.phone || id;
    if (recipientId) {
      try {
        const sessionRes = await supabase.auth.getSession();
        const token = sessionRes?.data?.session?.access_token;
        await sendPushNotification({
          userId: recipientId,
          title: "🛍️ Order Self-Pickup Notification",
          body: `Order #${id.slice(-4)}: Our store currently has no available delivery driver. Please come collect your order!`,
          data: {
            order_id: id,
            type: "pickup_requested",
            order_type: "collection",
            acceptance_message: pickupMessage,
          },
          userJwt: token,
        });
      } catch (e) {
        console.warn("[FCM] Customer push error:", e);
      }
    }

    toast.info("Order converted to Self-Pickup / Collection! Client notified.");
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
    dispatchOrderToRider,
    convertOrderToPickup,
    unassignRider,
  };
};
