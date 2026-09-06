import type { SupabaseClient } from "@supabase/supabase-js";
import { deriveDeliveryProof, type DeliveryProof } from "./deliveryProof.js";
import {
  assertLifecycleTransition,
  assertShopCanAcceptOrder,
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
  Number.isFinite(Number(left)) && Number(left) === Number(right);

const isSameOrderIntent = (
  existing: StoredOrder,
  userId: string,
  input: CreateOrderInput,
  pricing: AuthoritativePrice,
): boolean => {
  if (
    existing.user_id !== userId ||
    String(existing.shop_id) !== input.shop_id ||
    existing.payment_method !== input.payment_method ||
    !numericEqual(existing.price, pricing.subtotal) ||
    !numericEqual(existing.total_price, pricing.total_price) ||
    !numericEqual(existing.delivery_fee, pricing.delivery_fee) ||
    !numericEqual(existing.service_fee, pricing.service_fee) ||
    !numericEqual(existing.discount_amount, pricing.discount_amount) ||
    !numericEqual(existing.tip_amount, pricing.tip_amount)
  ) {
    return false;
  }

  if (input.delivery_type === "delivery") {
    if (
      !input.delivery_coordinates ||
      !numericEqual(existing.lat, input.delivery_coordinates.lat) ||
      !numericEqual(existing.lng, input.delivery_coordinates.lng)
    ) {
      return false;
    }
  } else if (existing.lat !== null || existing.lng !== null) {
    return false;
  }

  const existingItems = existing.items;
  if (!Array.isArray(existingItems) || existingItems.length !== pricing.lines.length) return false;
  return pricing.lines.every((line, index) => {
    const existingLine = existingItems[index];
    if (!existingLine || typeof existingLine !== "object" || Array.isArray(existingLine)) return false;
    const candidate = existingLine as Record<string, unknown>;
    return (
      candidate.menu_item_id === line.menu_item_id &&
      candidate.name === line.name &&
      numericEqual(candidate.unit_price, line.unit_price) &&
      numericEqual(candidate.quantity, line.quantity) &&
      numericEqual(candidate.line_total, line.line_total) &&
      (candidate.notes ?? undefined) === (line.notes ?? undefined)
    );
  });
};

export const createOrder = async (
  repository: OrderRepository,
  userId: string,
  input: CreateOrderInput,
  deliveryProofSecret?: string,
): Promise<CreateOrderResult> => {
  const pricing = await validateAndPriceOrder(repository, userId, input);
  const deliveryProof = input.delivery_type === "delivery"
    ? deriveDeliveryProof(input.idempotency_key, deliveryProofSecret)
    : undefined;

  const existing = await repository.findOrderByIdempotencyKey(input.idempotency_key);
  if (existing) {
    if (!isSameOrderIntent(existing, userId, input, pricing)) {
      throw new OrderContractError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "This idempotency key was already used for a different order.",
      );
    }
    return {
      order: existing,
      replayed: true,
      deliveryProof: deliveryProof
        ? { pin: deliveryProof.pin, qr_token: deliveryProof.qr_token }
        : undefined,
    };
  }

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
      if (racedOrder && isSameOrderIntent(racedOrder, userId, input, pricing)) {
        return {
          order: racedOrder,
          replayed: true,
          deliveryProof: deliveryProof
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
      .select("id,name,is_active,approval_status,latitude,longitude,lat,lng")
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
  const deliveryStatus = order.delivery_status;
  if (
    deliveryStatus === "finding_rider" ||
    deliveryStatus === "rider_assigned" ||
    deliveryStatus === "picked_up" ||
    deliveryStatus === "delivering" ||
    deliveryStatus === "delivered"
  ) {
    return deliveryStatus;
  }
  if (order.status === "preparing" || order.status === "ready_for_pickup" || order.status === "delivered") {
    return order.status;
  }
  return "pending";
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
