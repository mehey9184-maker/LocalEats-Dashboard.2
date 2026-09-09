import { supabase } from "../lib/supabase";
import { Order, OrderStatus } from "../types";

/**
 * OrderService
 * Abstracts all direct Supabase/Firestore database calls related to Orders.
 * This prepares the app to seamlessly switch to the v1 HTTP API in the future.
 */
export const OrderService = {
  /**
   * Fetch recent orders for specific shops
   */
  fetchRecentOrders: async (shopIds: string[] | number[]) => {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .in("shop_id", shopIds)
      .order("created_at", { ascending: false })
      .limit(250);
      
    if (error) throw error;
    return data as Order[];
  },

  /**
   * Update the primary status of an order
   */
  updateOrderStatus: async (orderId: string, status: OrderStatus) => {
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", orderId);
    if (error) throw error;
  },

  /**
   * Update the delivery status of an order
   */
  updateDeliveryStatus: async (orderId: string, status: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ delivery_status: status })
      .eq("id", orderId);
    if (error) throw error;
  },

  /**
   * Remove the rider from an order
   */
  unassignRider: async (orderId: string) => {
    const { error } = await supabase
      .from("orders")
      .update({
        delivery_status: "finding_rider",
        rider_id: null,
      })
      .eq("id", orderId);
    if (error) throw error;
  },

  /**
   * Rate a rider for a specific order
   */
  rateRider: async (orderId: string, riderId: string, rating: number, avgRating: number) => {
    // Update the order with the merchant's rating
    const { error: orderError } = await supabase
      .from('orders')
      .update({ merchant_rating: rating })
      .eq('id', orderId);
    if (orderError) throw orderError;

    // Update the rider's overall rating
    const { error: riderError } = await supabase
      .from('rider_profiles')
      .update({ rating: avgRating })
      .eq('id', riderId);
    if (riderError) throw riderError;
  },

  /**
   * Send a chat message for an order
   */
  sendChatMessage: async (message: any) => {
    const { error } = await supabase.from("chat_messages").insert(message);
    if (error) throw error;
  },

  /**
   * Delete all orders for the current merchant's shops
   * (Used in the Danger Zone settings)
   */
  deleteAllOrdersForShops: async (shopIds: string[] | number[]) => {
    const { error } = await supabase
      .from("orders")
      .delete()
      .in("shop_id", shopIds);
    if (error) throw error;
  },

  /**
   * Create a new manual order (POS / Walk-in)
   */
  createOrder: async (orderPayload: any) => {
    const { data, error } = await supabase
      .from("orders")
      .insert(orderPayload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
