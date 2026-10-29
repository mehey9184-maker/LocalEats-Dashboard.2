import type { SupabaseClient } from "@supabase/supabase-js";
import { deriveDeliveryProof, type DeliveryProof } from "./deliveryProof.js";
import {
  assertLifecycleTransition,
  assertShopCanAcceptOrder,
  assertNewDeliveryCreationAllowed,
  calculateAuthoritativePrice,
  type AuthoritativePrice,
  type CreateOrderInput,
  type MenuItemForOrder,
  OrderContractError,
  type OrderLifecycleState,
  type ShopForOrder,
} from "./orderContract.js";

export interface StoredOrder {
  id: string;
  shop_id: string | number;
  user_id: string;
  rider_id: string | null;
  status: string | null;
  delivery_status: string | null;
  payment_method: string | null;
  price: number | string | null;
  total_price: number | string;
  delivery_fee: number | string | null;
  service_fee: number | string | null;
  discount_amount: number | string | null;
  tip_amount: number | string | null;
  items: unknown;
  lat: number | string | null;
  lng: number | string | null;
  delivery_type?: "collection" | "delivery" | null;
  delivery_pin_hash?: string | null;
  delivery_qr_hash?: string | null;
  delivery_pin_failed_attempts?: number | null;
  delivery_pin_locked_until?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface NewOrderRecord {
  shop_id: string;
  user_id: string;
  product_name: string;
  product_variant: string | null;
  price: number;
  total_price: number;
  status: "pending";
  delivery_status: "none";
  payment_method: string;
  customer_name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  delivery_fee: number;
  service_fee: number;
  discount_amount: number;
  tip_amount: number;
  idempotency_key: string;
  items: AuthoritativePrice["lines"];
  delivery_type: "collection" | "delivery";
  delivery_pin_hash: string | null;
  delivery_qr_hash: string | null;
}

export interface InsertOrderResult {
  order: StoredOrder | null;
  error: { code?: string; message: string } | null;
}

export interface OrderRepository {
  findOrderByIdempotencyKey(key: string): Promise<StoredOrder | null>;
  findShop(shopId: string): Promise<ShopForOrder | null>;
  findMenuItems(shopId: string, itemIds: string[]): Promise<MenuItemForOrder[]>;
  insertOrder(record: NewOrderRecord): Promise<InsertOrderResult>;
}

export interface CreateOrderResult {
  order: StoredOrder;
  replayed: boolean;
  deliveryProof?: Pick<DeliveryProof, "pin" | "qr_token">;
}

export const orderRequiresDeliveryProof = (order: StoredOrder): boolean =>
  order.delivery_type === "delivery" &&
  order.status !== "delivered" &&
  order.status !== "cancelled" &&
  order.delivery_status !== "delivered" &&
  order.delivery_status !== "cancelled";

export interface AuthoritativeOrderQuote
  extends Pick<
    AuthoritativePrice,
    | "subtotal"
    | "delivery_fee"
    | "service_fee"
    | "discount_amount"
    | "tip_amount"
    | "total_price"
  > {
  delivery_type: CreateOrderInput["delivery_type"];
  payment_method: CreateOrderInput["payment_method"];
}

const validateAndPriceOrder = async (
  repository: OrderRepository,
  userId: string,
  input: CreateOrderInput,
): Promise<AuthoritativePrice> => {
  if (!userId) {
    throw new OrderContractError(401, "UNAUTHORIZED", "Authentication is required.");
  }

  const shop = await repository.findShop(input.shop_id);
  if (!shop) throw new OrderContractError(404, "SHOP_NOT_FOUND", "Shop not found.");
  assertShopCanAcceptOrder(shop, input);

  const menuItems = await repository.findMenuItems(
    input.shop_id,
    input.items.map((item) => item.menu_item_id),
  );
  return calculateAuthoritativePrice(input, menuItems);
};

export const quoteOrder = async (
  repository: OrderRepository,
  userId: string,
  input: CreateOrderInput,
): Promise<AuthoritativeOrderQuote> => {
  const pricing = await validateAndPriceOrder(repository, userId, input);
  return {
    subtotal: pricing.subtotal,
    delivery_fee: pricing.delivery_fee,
    service_fee: pricing.service_fee,
    discount_amount: pricing.discount_amount,
    tip_amount: pricing.tip_amount,
    total_price: pricing.total_price,
    delivery_type: input.delivery_type,
    payment_method: input.payment_method,
  };
};

const numericEqual = (left: unknown, right: unknown): boolean =>
  left !== null && left !== "" && right !== null && right !== "" &&
  Number.isFinite(Number(left)) && Number(left) === Number(right);

// Compare persisted intent, never today's catalog prices. Missing legacy intent fails closed.
const isSameOrderIntent = (existing: StoredOrder, userId: string, input: CreateOrderInput): boolean => {
  if (!existing.id || existing.user_id !== userId || String(existing.shop_id) !== input.shop_id ||
      existing.delivery_type !== input.delivery_type || existing.payment_method !== input.payment_method ||
      !numericEqual(existing.tip_amount, input.tip_amount)) return false;
  for (const [field, value] of Object.entries({ customer_name: input.customer_details.name,
    phone: input.customer_details.phone, email: input.customer_details.email,
    address: input.customer_details.address, city: input.customer_details.city })) {
    if (existing[field] !== value) return false;
  }
  const notes = [...input.items.map((line) => line.notes), input.customer_details.delivery_instructions].filter(Boolean).join(" • ") || null;
  if (existing.notes !== notes) return false;
  if (input.delivery_type === "delivery") {
    if (!input.delivery_coordinates || !numericEqual(existing.lat, input.delivery_coordinates.lat) ||
        !numericEqual(existing.lng, input.delivery_coordinates.lng)) return false;
  } else if (existing.lat !== null || existing.lng !== null) return false;
  if (!Array.isArray(existing.items) || existing.items.length !== input.items.length) return false;
  return input.items.every((line, index) => {
    const saved = (existing.items as Record<string, unknown>[])[index];
    return saved && saved.menu_item_id === line.menu_item_id && numericEqual(saved.quantity, line.quantity) &&
      (saved.notes ?? undefined) === line.notes && Number.isFinite(Number(saved.unit_price)) &&
      Number.isFinite(Number(saved.line_total));
  });
};

export const createOrder = async (
  repository: OrderRepository,
  userId: string,
  input: CreateOrderInput,
  deliveryProofSecret?: string,
): Promise<CreateOrderResult> => {
  if (!userId) throw new OrderContractError(401, "UNAUTHORIZED", "Authentication is required.");
  const existing = await repository.findOrderByIdempotencyKey(input.idempotency_key);
  if (existing) {
    if (!isSameOrderIntent(existing, userId, input)) {
      throw new OrderContractError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "This idempotency key was already used for a different order.",
      );
    }
    const replayProof = orderRequiresDeliveryProof(existing)
      ? deriveDeliveryProof(input.idempotency_key, deliveryProofSecret)
      : undefined;
    return {
      order: existing,
      replayed: true,
      deliveryProof: replayProof
        ? { pin: replayProof.pin, qr_token: replayProof.qr_token }
        : undefined,
    };
  }

  assertNewDeliveryCreationAllowed(input);
  const pricing = await validateAndPriceOrder(repository, userId, input);
  // Preserve delivery creation for a future approved release, behind the launch policy.
  const deliveryProof = input.delivery_type === "delivery"
    ? deriveDeliveryProof(input.idempotency_key, deliveryProofSecret)
    : undefined;

  const coordinates = input.delivery_coordinates;
  const notes = [
    ...pricing.lines.map((line) => line.notes).filter((note): note is string => Boolean(note)),
    input.customer_details.delivery_instructions,
  ].filter((note): note is string => Boolean(note));

  const record: NewOrderRecord = {
    shop_id: input.shop_id,
    user_id: userId,
    product_name: pricing.lines.map((line) => line.name).join(", "),
    product_variant: null,
    price: pricing.subtotal,
    total_price: pricing.total_price,
    status: "pending",
    delivery_status: "none",
    payment_method: input.payment_method,
    customer_name: input.customer_details.name,
    phone: input.customer_details.phone,
    email: input.customer_details.email,
    address: input.customer_details.address,
    city: input.customer_details.city,
    lat: coordinates?.lat ?? null,
    lng: coordinates?.lng ?? null,
    notes: notes.length > 0 ? notes.join(" • ") : null,
    delivery_fee: pricing.delivery_fee,
    service_fee: pricing.service_fee,
    discount_amount: pricing.discount_amount,
    tip_amount: pricing.tip_amount,
    idempotency_key: input.idempotency_key,
    items: pricing.lines,
    delivery_type: input.delivery_type,
    delivery_pin_hash: deliveryProof?.pin_hash ?? null,
    delivery_qr_hash: deliveryProof?.qr_hash ?? null,
  };

  const inserted = await repository.insertOrder(record);
  if (inserted.error) {
    if (inserted.error.code === "23505") {
      const racedOrder = await repository.findOrderByIdempotencyKey(input.idempotency_key);
      if (racedOrder && isSameOrderIntent(racedOrder, userId, input)) {
        return {
          order: racedOrder,
          replayed: true,
          deliveryProof: orderRequiresDeliveryProof(racedOrder) && deliveryProof
            ? { pin: deliveryProof.pin, qr_token: deliveryProof.qr_token }
            : undefined,
        };
      }
      throw new OrderContractError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "This idempotency key was already used for a different order.",
      );
    }
    throw new OrderContractError(
      503,
      "ORDER_PERSISTENCE_FAILED",
      "The order could not be saved. No order was placed.",
    );
  }
  if (!inserted.order?.id) {
    throw new OrderContractError(
      503,
      "ORDER_PERSISTENCE_FAILED",
      "The database did not confirm the order. No order was placed.",
    );
  }
  return {
    order: inserted.order,
    replayed: false,
    deliveryProof: deliveryProof
      ? { pin: deliveryProof.pin, qr_token: deliveryProof.qr_token }
      : undefined,
  };
};

const throwDatabaseError = (operation: string, error: { message: string } | null): never => {
  console.error(`Supabase ${operation} failed:`, error?.message ?? "unknown database error");
  throw new OrderContractError(503, "DATABASE_UNAVAILABLE", "The order service is temporarily unavailable.");
};

export class SupabaseOrderRepository implements OrderRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findOrderByIdempotencyKey(key: string): Promise<StoredOrder | null> {
    const { data, error } = await this.client
      .from("orders")
      .select("*")
      .eq("idempotency_key", key)
      .maybeSingle();
    if (error) throwDatabaseError("idempotency lookup", error);
    return (data as StoredOrder | null) ?? null;
  }

  async findShop(shopId: string): Promise<ShopForOrder | null> {
    const { data, error } = await this.client
      .from("shops")
      .select("id,name,is_active,approval_status,archived_at,location,latitude,longitude,lat,lng")
      .eq("id", shopId)
      .maybeSingle();
    if (error) throwDatabaseError("shop lookup", error);
    return (data as ShopForOrder | null) ?? null;
  }

  async findMenuItems(shopId: string, itemIds: string[]): Promise<MenuItemForOrder[]> {
    const { data, error } = await this.client
      .from("menu_items")
      .select("id,shop_id,name,price,is_available")
      .eq("shop_id", shopId)
      .in("id", itemIds);
    if (error) throwDatabaseError("menu lookup", error);
    return (data as MenuItemForOrder[] | null) ?? [];
  }

  async insertOrder(record: NewOrderRecord): Promise<InsertOrderResult> {
    const { data, error } = await this.client
      .from("orders")
      .insert(record)
      .select("*")
      .single();
    return {
      order: (data as StoredOrder | null) ?? null,
      error: error ? { code: error.code, message: error.message } : null,
    };
  }
}

export interface MutableOrderRecord extends StoredOrder {
  owner_id?: string;
}

export const lifecycleStateFromOrder = (order: StoredOrder): OrderLifecycleState => {
  const invalid = (): never => { throw new OrderContractError(409, "INVALID_ORDER_TRANSITION", "Invalid or terminal order state."); };
  if (order.delivery_type != null && order.delivery_type !== "delivery" && order.delivery_type !== "collection") return invalid();
  const status = order.status;
  const delivery = order.delivery_status;
  if (typeof status === "string" && ["pending", "preparing", "ready_for_pickup"].includes(status) && delivery === "none" && order.rider_id === null) {
    return status as OrderLifecycleState;
  }
  if (status === "ready_for_pickup" && order.delivery_type !== "collection") {
    if (delivery === "finding_rider" && order.rider_id === null) return "finding_rider";
    if (typeof delivery === "string" && ["rider_assigned", "picked_up", "delivering"].includes(delivery) &&
        typeof order.rider_id === "string" && order.rider_id.trim().length > 0) return delivery as OrderLifecycleState;
  }
  if (status === "delivered" && delivery === "delivered" && order.delivery_type !== "collection" &&
      typeof order.rider_id === "string" && order.rider_id.trim().length > 0) return "delivered";
  return invalid();
};

export const lifecycleUpdateFor = (
  order: StoredOrder,
  target: OrderLifecycleState,
): Record<string, unknown> => {
  const current = lifecycleStateFromOrder(order);
  assertLifecycleTransition(current, target);
  const updatedAt = new Date().toISOString();

  switch (target) {
    case "preparing":
      return { status: "preparing", delivery_status: "none", updated_at: updatedAt };
    case "ready_for_pickup":
      return { status: "ready_for_pickup", delivery_status: "none", updated_at: updatedAt };
    case "finding_rider":
      return { status: "ready_for_pickup", delivery_status: "finding_rider", updated_at: updatedAt };
    case "rider_assigned":
    case "picked_up":
    case "delivering":
      return { delivery_status: target, updated_at: updatedAt };
    case "delivered":
      return { status: "delivered", delivery_status: "delivered", updated_at: updatedAt };
    default:
      throw new OrderContractError(409, "INVALID_ORDER_TRANSITION", "Unsupported target state.");
  }
};
