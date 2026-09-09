import { Router, type RequestHandler, type Response } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { authenticateFirebase, type AuthenticatedRequest } from "../middleware/authenticateFirebase.js";
import { OrderContractError, assertLifecycleTransition } from "../orders/orderContract.js";
import { hashDeliveryProof } from "../orders/deliveryProof.js";

const router = Router();

export const APPROVED_RIDER_CONNECTION_STATUS = "approved";

export const isApprovedRiderProfile = (profile: { verification_status?: unknown }): boolean =>
  profile.verification_status === "approved";

export const isApprovedRiderConnection = (connection: { status?: unknown }): boolean =>
  connection.status === APPROVED_RIDER_CONNECTION_STATUS;

export type DeliveryProofKind = "pin" | "qr";

export const parseRiderDeliveryProof = (
  proof: unknown,
): { kind: DeliveryProofKind; value: string } => {
  if (typeof proof === "string" && /^\d{4}$/.test(proof)) {
    return { kind: "pin", value: proof };
  }
  if (typeof proof === "string" && /^le_[0-9a-f]{64}$/.test(proof)) {
    return { kind: "qr", value: proof };
  }
  throw new OrderContractError(
    400,
    "INVALID_DELIVERY_CONFIRMATION",
    "Enter a 4-digit PIN or scan a LocalEats QR code.",
  );
};

export type DeliveryCompletionOutcome =
  | {
      ok: true;
      order: Record<string, unknown>;
      replayed: boolean;
    }
  | {
      ok: false;
      status: number;
      code: string;
      message: string;
      retryAfter?: number;
    };

export const interpretDeliveryCompletion = (value: unknown): DeliveryCompletionOutcome => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OrderContractError(
      503,
      "INVALID_DATABASE_RESPONSE",
      "The database did not confirm delivery completion.",
    );
  }

  const payload = value as Record<string, unknown>;
  if (payload.success === true) {
    if (!payload.order || typeof payload.order !== "object" || Array.isArray(payload.order)) {
      throw new OrderContractError(
        503,
        "INVALID_DATABASE_RESPONSE",
        "The database did not return the completed order.",
      );
    }
    return {
      ok: true,
      order: payload.order as Record<string, unknown>,
      replayed: payload.replayed === true,
    };
  }

  if (payload.success !== false || typeof payload.error_code !== "string") {
    throw new OrderContractError(
      503,
      "INVALID_DATABASE_RESPONSE",
      "The database returned an invalid delivery-completion result.",
    );
  }

  switch (payload.error_code) {
    case "RIDER_NOT_APPROVED":
      return { ok: false, status: 403, code: "RIDER_NOT_APPROVED", message: "Rider is not approved." };
    case "RIDER_NOT_ASSIGNED":
      return { ok: false, status: 403, code: "FORBIDDEN", message: "You cannot complete this delivery." };
    case "ORDER_NOT_FOUND":
      return { ok: false, status: 404, code: "ORDER_NOT_FOUND", message: "Order not found." };
    case "INVALID_ORDER_STATE":
      return {
        ok: false,
        status: 409,
        code: "INVALID_ORDER_TRANSITION",
        message: "This order is not ready to be completed.",
      };
    case "INVALID_DELIVERY_PROOF":
    case "INVALID_DELIVERY_PROOF_KIND":
      return {
        ok: false,
        status: 409,
        code: "INVALID_DELIVERY_CONFIRMATION",
        message: "The delivery PIN or QR code is incorrect.",
      };
    case "PIN_LOCKED": {
      const candidate = Number(payload.retry_after);
      const retryAfter = Number.isFinite(candidate) && candidate > 0 ? Math.ceil(candidate) : 1;
      return {
        ok: false,
        status: 429,
        code: "DELIVERY_PIN_LOCKED",
        message: "Too many incorrect PIN attempts. Try again later or scan the delivery QR code.",
        retryAfter,
      };
    }
    default:
      throw new OrderContractError(
        503,
        "INVALID_DATABASE_RESPONSE",
        "The database returned an unknown delivery-completion result.",
      );
  }
};

const sendError = (res: Response, error: unknown): void => {
  if (error instanceof OrderContractError) {
    res.status(error.status).json({ success: false, code: error.code, error: error.message });
    return;
  }
  console.error("Rider order API error:", error instanceof Error ? error.message : "unknown error");
  res.status(500).json({ success: false, code: "INTERNAL_ERROR", error: "Internal Server Error" });
};

const resolveRider = async (firebaseUid: string) => {
  const { data, error } = await supabaseAdmin
    .from("rider_profiles")
    .select("id,is_online,verification_status")
    .eq("firebase_uid", firebaseUid)
    .maybeSingle();
  if (error) {
    throw new OrderContractError(
      503,
      "RIDER_IDENTITY_MAPPING_REQUIRED",
      "Rider identity mapping is not ready. No delivery state was changed.",
    );
  }
  if (!data || !isApprovedRiderProfile(data)) {
    throw new OrderContractError(403, "RIDER_NOT_APPROVED", "Rider is not approved.");
  }
  return data;
};

const AVAILABLE_RIDER_ORDER_COLUMNS = [
  "id",
  "shop_id",
  "product_name",
  "total_price",
  "delivery_fee",
  "payment_method",
  "city",
  "status",
  "delivery_status",
  "delivery_type",
  "created_at",
].join(",");

const ASSIGNED_RIDER_ORDER_COLUMNS = [
  "id",
  "shop_id",
  "product_name",
  "product_variant",
  "price",
  "total_price",
  "delivery_fee",
  "service_fee",
  "discount_amount",
  "tip_amount",
  "payment_method",
  "items",
  "customer_name",
  "phone",
  "address",
  "city",
  "lat",
  "lng",
  "notes",
  "status",
  "delivery_status",
  "rider_id",
  "delivery_type",
  "created_at",
  "updated_at",
].join(",");

export const availableRiderOrderResponse = (
  order: Record<string, unknown>,
): Record<string, unknown> => ({
  id: order.id,
  shop_id: order.shop_id,
  product_name: order.product_name,
  total_price: order.total_price,
  delivery_fee: order.delivery_fee,
  payment_method: order.payment_method,
  city: order.city,
  status: order.status,
  delivery_status: order.delivery_status,
  delivery_type: order.delivery_type,
  created_at: order.created_at,
});

export const assignedRiderOrderResponse = (
  order: Record<string, unknown>,
): Record<string, unknown> => ({
  id: order.id,
  shop_id: order.shop_id,
  product_name: order.product_name,
  product_variant: order.product_variant,
  price: order.price,
  total_price: order.total_price,
  delivery_fee: order.delivery_fee,
  service_fee: order.service_fee,
  discount_amount: order.discount_amount,
  tip_amount: order.tip_amount,
  payment_method: order.payment_method,
  items: order.items,
  customer_name: order.customer_name,
  phone: order.phone,
  address: order.address,
  city: order.city,
  lat: order.lat,
  lng: order.lng,
  notes: order.notes,
  status: order.status,
  delivery_status: order.delivery_status,
  rider_id: order.rider_id,
  delivery_type: order.delivery_type,
  created_at: order.created_at,
  updated_at: order.updated_at,
});

const handleMine: RequestHandler = async (request, res): Promise<void> => {
  try {
    const req = request as AuthenticatedRequest;
    const uid = req.authUser?.uid;
    if (!uid) throw new OrderContractError(401, "UNAUTHORIZED", "Authentication is required.");
    const rider = await resolveRider(uid);
    const scope = req.query.scope === "history" ? "history" : "active";

    let query = supabaseAdmin
      .from("orders")
      .select(ASSIGNED_RIDER_ORDER_COLUMNS)
      .eq("rider_id", rider.id)
      .order("updated_at", { ascending: false });

    query = scope === "history"
      ? query.eq("delivery_status", "delivered")
      : query.in("delivery_status", ["rider_assigned", "picked_up", "delivering"]);

    const { data, error } = await query;
    if (error) throw new OrderContractError(503, "DATABASE_UNAVAILABLE", "Rider deliveries could not be loaded.");
    res.status(200).json({
      success: true,
      orders: (data ?? []).map((order) =>
        assignedRiderOrderResponse(order as unknown as Record<string, unknown>),
      ),
    });
  } catch (error) {
    sendError(res, error);
  }
};

const handleAssignedById: RequestHandler = async (request, res): Promise<void> => {
  try {
    const req = request as AuthenticatedRequest;
    const uid = req.authUser?.uid;
    if (!uid) throw new OrderContractError(401, "UNAUTHORIZED", "Authentication is required.");
    const rider = await resolveRider(uid);
    const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select(ASSIGNED_RIDER_ORDER_COLUMNS)
      .eq("id", orderId)
      .eq("rider_id", rider.id)
      .maybeSingle();
    if (error) throw new OrderContractError(503, "DATABASE_UNAVAILABLE", "Delivery could not be loaded.");
    if (!data) throw new OrderContractError(404, "ORDER_NOT_FOUND", "Assigned delivery was not found.");
    res.status(200).json({
      success: true,
      order: assignedRiderOrderResponse(data as unknown as Record<string, unknown>),
    });
  } catch (error) {
    sendError(res, error);
  }
};

const handleAvailable: RequestHandler = async (request, res): Promise<void> => {
  try {
    const req = request as AuthenticatedRequest;
    const uid = req.authUser?.uid;
    if (!uid) throw new OrderContractError(401, "UNAUTHORIZED", "Authentication is required.");
    const rider = await resolveRider(uid);
    if (rider.is_online !== true) {
      res.status(200).json({ success: true, orders: [] });
      return;
    }

    const { data: connections, error: connectionError } = await supabaseAdmin
      .from("rider_connections")
      .select("shop_id,status,expires_at")
      .eq("rider_id", rider.id)
      .eq("status", APPROVED_RIDER_CONNECTION_STATUS);
    if (connectionError) throw new OrderContractError(503, "DATABASE_UNAVAILABLE", "Rider pairings could not be loaded.");
    const now = Date.now();
    const shopIds = (connections ?? [])
      .filter((connection) => !connection.expires_at || new Date(connection.expires_at).getTime() > now)
      .map((connection) => String(connection.shop_id));
    if (shopIds.length === 0) {
      res.status(200).json({ success: true, orders: [] });
      return;
    }

    const { data: orders, error: orderError } = await supabaseAdmin
      .from("orders")
      .select(AVAILABLE_RIDER_ORDER_COLUMNS)
      .in("shop_id", shopIds)
      .eq("delivery_status", "finding_rider")
      .is("rider_id", null)
      .order("created_at", { ascending: true });
    if (orderError) throw new OrderContractError(503, "DATABASE_UNAVAILABLE", "Available deliveries could not be loaded.");
    res.status(200).json({
      success: true,
      orders: (orders ?? []).map((order) =>
        availableRiderOrderResponse(order as unknown as Record<string, unknown>),
      ),
    });
  } catch (error) {
    sendError(res, error);
  }
};

export interface RiderReadRouteHandlers {
  mine: RequestHandler;
  available: RequestHandler;
  assignedById: RequestHandler;
}

export const registerRiderReadRoutes = (
  targetRouter: ReturnType<typeof Router>,
  authenticate: RequestHandler,
  handlers: RiderReadRouteHandlers,
): void => {
  targetRouter.get("/mine", authenticate, handlers.mine);
  targetRouter.get("/available", authenticate, handlers.available);
  targetRouter.get("/:id", authenticate, handlers.assignedById);
};

registerRiderReadRoutes(router, authenticateFirebase, {
  mine: handleMine,
  available: handleAvailable,
  assignedById: handleAssignedById,
});

router.post("/:id/claim", authenticateFirebase, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const uid = req.authUser?.uid;
    if (!uid) throw new OrderContractError(401, "UNAUTHORIZED", "Authentication is required.");
    const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { data, error } = await supabaseAdmin.rpc("claim_delivery_order", {
      p_order_id: orderId,
      p_firebase_uid: uid,
    });
    if (error) {
      const message = error.message || "Delivery could not be claimed.";
      if (message.includes("no longer available") || message.includes("another rider")) {
        throw new OrderContractError(409, "DELIVERY_ALREADY_CLAIMED", "This delivery is no longer available.");
      }
      if (message.includes("not approved")) {
        throw new OrderContractError(403, "RIDER_NOT_APPROVED", message);
      }
      throw new OrderContractError(503, "DATABASE_UNAVAILABLE", "Delivery claim could not be completed.");
    }
    const order = Array.isArray(data) ? data[0] : data;
    if (!order?.id) throw new OrderContractError(409, "DELIVERY_ALREADY_CLAIMED", "This delivery is no longer available.");
    res.status(200).json({
      success: true,
      order: assignedRiderOrderResponse(order as Record<string, unknown>),
    });
  } catch (error) {
    sendError(res, error);
  }
});

const advanceAssignedDelivery = async (
  uid: string,
  orderId: string,
  expected: "rider_assigned" | "picked_up",
  target: "picked_up" | "delivering",
) => {
  assertLifecycleTransition(expected, target);
  const rider = await resolveRider(uid);
  const { data, error } = await supabaseAdmin
    .from("orders")
    .update({ delivery_status: target, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("rider_id", rider.id)
    .eq("delivery_status", expected)
    .select(ASSIGNED_RIDER_ORDER_COLUMNS)
    .maybeSingle();
  if (error) throw new OrderContractError(503, "DATABASE_UNAVAILABLE", "Delivery state could not be saved.");
  if (!data) throw new OrderContractError(409, "INVALID_ORDER_TRANSITION", "Delivery state changed or rider is not assigned.");
  return data;
};

for (const action of [
  { path: "picked-up", expected: "rider_assigned", target: "picked_up" },
  { path: "delivering", expected: "picked_up", target: "delivering" },
] as const) {
  router.post(`/:id/${action.path}`, authenticateFirebase, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const uid = req.authUser?.uid;
      if (!uid) throw new OrderContractError(401, "UNAUTHORIZED", "Authentication is required.");
      const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const order = await advanceAssignedDelivery(uid, orderId, action.expected, action.target);
      res.status(200).json({
        success: true,
        order: assignedRiderOrderResponse(order as unknown as Record<string, unknown>),
      });
    } catch (error) {
      sendError(res, error);
    }
  });
}

router.post(
  "/:id/delivered",
  authenticateFirebase,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const uid = req.authUser?.uid;
      if (!uid) throw new OrderContractError(401, "UNAUTHORIZED", "Authentication is required.");
      const proof = parseRiderDeliveryProof(req.body?.delivery_pin);
      const proofHash = hashDeliveryProof(proof.value, process.env.DELIVERY_PROOF_SECRET);
      const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { data, error } = await supabaseAdmin.rpc("complete_delivery_order", {
        p_order_id: orderId,
        p_firebase_uid: uid,
        p_delivery_proof_kind: proof.kind,
        p_delivery_proof_hash: proofHash,
      });
      if (error) {
        throw new OrderContractError(503, "DATABASE_UNAVAILABLE", "Delivery completion could not be saved.");
      }

      const outcome = interpretDeliveryCompletion(data);
      if (!outcome.ok) {
        if (outcome.retryAfter !== undefined) {
          res.set("Retry-After", String(outcome.retryAfter));
        }
        res.status(outcome.status).json({
          success: false,
          code: outcome.code,
          error: outcome.message,
          ...(outcome.retryAfter !== undefined ? { retry_after: outcome.retryAfter } : {}),
        });
        return;
      }
      res.status(200).json({
        success: true,
        order: assignedRiderOrderResponse(outcome.order),
        replayed: outcome.replayed,
      });
    } catch (error) {
      sendError(res, error);
    }
  },
);

export default router;
