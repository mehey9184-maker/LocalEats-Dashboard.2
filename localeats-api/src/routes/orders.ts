import { Router, type Response } from "express";
import { authenticateFirebase, type AuthenticatedRequest } from "../middleware/authenticateFirebase.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import {
  assertLifecycleTransition,
  OrderContractError,
  parseCreateOrderInput,
} from "../orders/orderContract.js";
import {
  createOrder,
  lifecycleStateFromOrder,
  lifecycleUpdateFor,
  quoteOrder,
  SupabaseOrderRepository,
  type StoredOrder,
} from "../orders/orderService.js";
import { deriveDeliveryProof } from "../orders/deliveryProof.js";

const router = Router();
const repository = new SupabaseOrderRepository(supabaseAdmin);

const withoutDeliveryProofHashes = (order: StoredOrder): Omit<StoredOrder, "delivery_pin_hash" | "delivery_qr_hash"> => {
  const { delivery_pin_hash: _pinHash, delivery_qr_hash: _qrHash, ...safeOrder } = order;
  return safeOrder;
};

const customerOrderResponse = (order: StoredOrder) => {
  const safeOrder = {
    ...withoutDeliveryProofHashes(order),
    is_delivery: order.delivery_type === "delivery",
    order_type: order.delivery_type,
  };
  if (order.delivery_type !== "delivery" || typeof order.idempotency_key !== "string") return safeOrder;
  const proof = deriveDeliveryProof(order.idempotency_key, process.env.DELIVERY_PROOF_SECRET);
  return {
    ...safeOrder,
    delivery_confirmation: { pin: proof.pin, qr_token: proof.qr_token },
  };
};

const routeParam = (value: string | string[]): string =>
  Array.isArray(value) ? value[0] ?? "" : value;

const sendOrderError = (res: Response, error: unknown): void => {
  if (error instanceof OrderContractError) {
    res.status(error.status).json({ success: false, code: error.code, error: error.message });
    return;
  }
  console.error("Order API error:", error instanceof Error ? error.message : "unknown error");
  res.status(500).json({ success: false, code: "INTERNAL_ERROR", error: "Internal Server Error" });
};

router.post("/quote", authenticateFirebase, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.authUser?.uid;
    if (!userId) throw new OrderContractError(401, "UNAUTHORIZED", "Authentication is required.");

    const input = parseCreateOrderInput(req.body);
    const quote = await quoteOrder(repository, userId, input);
    res.status(200).json({ success: true, quote });
  } catch (error) {
    sendOrderError(res, error);
  }
});

router.post("/", authenticateFirebase, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.authUser?.uid;
    if (!userId) throw new OrderContractError(401, "UNAUTHORIZED", "Authentication is required.");

    const input = parseCreateOrderInput(req.body);
    const result = await createOrder(repository, userId, input, process.env.DELIVERY_PROOF_SECRET);
    res.status(result.replayed ? 200 : 201).json({
      success: true,
      replayed: result.replayed,
      order: withoutDeliveryProofHashes(result.order),
      delivery_confirmation: result.deliveryProof,
    });
  } catch (error) {
    sendOrderError(res, error);
  }
});

router.get("/", authenticateFirebase, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.authUser?.uid;
    if (!userId) throw new OrderContractError(401, "UNAUTHORIZED", "Authentication is required.");

    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new OrderContractError(503, "DATABASE_UNAVAILABLE", "Orders could not be loaded.");
    res.status(200).json({
      success: true,
      orders: (data ?? []).map((order) => customerOrderResponse(order as StoredOrder)),
    });
  } catch (error) {
    sendOrderError(res, error);
  }
});

router.get("/:id", authenticateFirebase, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.authUser?.uid;
    if (!userId) throw new OrderContractError(401, "UNAUTHORIZED", "Authentication is required.");

    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", req.params.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new OrderContractError(503, "DATABASE_UNAVAILABLE", "Order could not be loaded.");
    if (!data) throw new OrderContractError(404, "ORDER_NOT_FOUND", "Order not found.");
    res.status(200).json({ success: true, order: customerOrderResponse(data as StoredOrder) });
  } catch (error) {
    sendOrderError(res, error);
  }
});

router.post("/:id/cancel", authenticateFirebase, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.authUser?.uid;
    if (!userId) throw new OrderContractError(401, "UNAUTHORIZED", "Authentication is required.");
    const orderId = routeParam(req.params.id);
    const { data: existing, error: loadError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("user_id", userId)
      .maybeSingle();
    if (loadError) throw new OrderContractError(503, "DATABASE_UNAVAILABLE", "Order could not be loaded.");
    if (!existing) throw new OrderContractError(404, "ORDER_NOT_FOUND", "Order not found.");
    if (lifecycleStateFromOrder(existing as StoredOrder) !== "pending") {
      throw new OrderContractError(
        409,
        "CANCELLATION_REQUIRES_SUPPORT",
        "Only pending orders can be cancelled immediately. Contact the shop for an accepted order.",
      );
    }
    const { data, error } = await supabaseAdmin
      .from("orders")
      .update({ status: "cancelled", delivery_status: "none", updated_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("user_id", userId)
      .eq("status", "pending")
      .in("delivery_status", ["none", "pending"])
      .select("*")
      .maybeSingle();
    if (error) throw new OrderContractError(503, "DATABASE_UNAVAILABLE", "Cancellation could not be saved.");
    if (!data) throw new OrderContractError(409, "ORDER_STATE_CHANGED", "The order changed before cancellation. Refresh and try again.");
    res.status(200).json({ success: true, order: customerOrderResponse(data as StoredOrder) });
  } catch (error) {
    sendOrderError(res, error);
  }
});

export const customerOrderRoutes = router;

export const merchantOrderRoutes = Router();

merchantOrderRoutes.get(
  "/",
  authenticateFirebase,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const uid = req.authUser?.uid;
      if (!uid) throw new OrderContractError(401, "UNAUTHORIZED", "Authentication is required.");

      const { data: shops, error: shopError } = await supabaseAdmin
        .from("shops")
        .select("id")
        .eq("owner_id", uid)
        .is("archived_at", null);
      if (shopError) throw new OrderContractError(503, "DATABASE_UNAVAILABLE", "Shop ownership could not be verified.");
      const shopIds = (shops ?? []).map((shop) => String(shop.id));
      if (shopIds.length === 0) {
        res.status(200).json({ success: true, orders: [] });
        return;
      }

      const { data: orders, error: ordersError } = await supabaseAdmin
        .from("orders")
        .select("*")
        .in("shop_id", shopIds)
        .order("created_at", { ascending: false })
        .limit(250);
      if (ordersError) throw new OrderContractError(503, "DATABASE_UNAVAILABLE", "Orders could not be loaded.");
      res.status(200).json({
        success: true,
        orders: (orders ?? []).map((order) => withoutDeliveryProofHashes(order as StoredOrder)),
      });
    } catch (error) {
      sendOrderError(res, error);
    }
  },
);

const loadMerchantOrder = async (uid: string, orderId: string): Promise<StoredOrder> => {
  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError) throw new OrderContractError(503, "DATABASE_UNAVAILABLE", "Order could not be loaded.");
  if (!order) throw new OrderContractError(404, "ORDER_NOT_FOUND", "Order not found.");

  const { data: shop, error: shopError } = await supabaseAdmin
    .from("shops")
    .select("id,owner_id")
    .eq("id", String(order.shop_id))
    .maybeSingle();
  if (shopError) throw new OrderContractError(503, "DATABASE_UNAVAILABLE", "Shop ownership could not be verified.");
  if (!shop || shop.owner_id !== uid) {
    throw new OrderContractError(403, "FORBIDDEN", "This order does not belong to your shop.");
  }
  return order as StoredOrder;
};

const updateMerchantOrder = async (
  uid: string,
  orderId: string,
  action: "accept" | "ready",
): Promise<StoredOrder> => {
  const order = await loadMerchantOrder(uid, orderId);
  const current = lifecycleStateFromOrder(order);

  let update: Record<string, unknown>;
  if (action === "accept") {
    update = lifecycleUpdateFor(order, "preparing");
  } else {
    assertLifecycleTransition(current, "ready_for_pickup");
    const isDelivery = order.delivery_type === "delivery";
    if (isDelivery) assertLifecycleTransition("ready_for_pickup", "finding_rider");
    update = {
      status: "ready_for_pickup",
      delivery_status: isDelivery ? "finding_rider" : "none",
      updated_at: new Date().toISOString(),
    };
  }

  const query = supabaseAdmin
    .from("orders")
    .update(update)
    .eq("id", orderId)
    .eq("status", String(order.status));
  const { data, error } = order.delivery_status === null
    ? await query.is("delivery_status", null).select("*").maybeSingle()
    : await query.eq("delivery_status", String(order.delivery_status)).select("*").maybeSingle();
  if (error) throw new OrderContractError(503, "DATABASE_UNAVAILABLE", "Order state could not be saved.");
  if (!data) {
    throw new OrderContractError(409, "ORDER_STATE_CHANGED", "The order changed before this action completed. Refresh and try again.");
  }
  return data as StoredOrder;
};

merchantOrderRoutes.post(
  "/:id/accept",
  authenticateFirebase,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const uid = req.authUser?.uid;
      if (!uid) throw new OrderContractError(401, "UNAUTHORIZED", "Authentication is required.");
      const order = await updateMerchantOrder(uid, routeParam(req.params.id), "accept");
      res.status(200).json({ success: true, order: withoutDeliveryProofHashes(order) });
    } catch (error) {
      sendOrderError(res, error);
    }
  },
);

merchantOrderRoutes.post(
  "/:id/ready",
  authenticateFirebase,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const uid = req.authUser?.uid;
      if (!uid) throw new OrderContractError(401, "UNAUTHORIZED", "Authentication is required.");
      const order = await updateMerchantOrder(uid, routeParam(req.params.id), "ready");
      res.status(200).json({ success: true, order: withoutDeliveryProofHashes(order) });
    } catch (error) {
      sendOrderError(res, error);
    }
  },
);
