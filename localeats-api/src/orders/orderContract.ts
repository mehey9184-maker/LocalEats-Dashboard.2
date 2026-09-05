export const PILOT_SERVICE_FEE = 2.5;
export const PILOT_DELIVERY_FEE = 10;
export const PILOT_MAX_DELIVERY_KM = 4;

export type DeliveryType = "collection" | "delivery";
export type PaymentMethod = "cash" | "cash_on_arrival" | "card_machine";

export interface CreateOrderLineInput {
  menu_item_id: string;
  quantity: number;
  notes?: string;
  variant_id?: string;
}

export interface CreateOrderInput {
  idempotency_key: string;
  shop_id: string;
  items: CreateOrderLineInput[];
  delivery_type: DeliveryType;
  delivery_schedule_mode: "standard";
  delivery_coordinates?: { lat: number; lng: number };
  promo_code?: string;
  tip_amount: number;
  payment_method: PaymentMethod;
  customer_details: {
    name: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    delivery_instructions?: string;
  };
}

export interface ShopForOrder {
  id: string;
  name: string;
  is_active: boolean | null;
  approval_status: string | null;
  latitude: number | null;
  longitude: number | null;
  lat: number | null;
  lng: number | null;
}

export interface MenuItemForOrder {
  id: string;
  shop_id: string;
  name: string;
  price: number | string;
  is_available: boolean | null;
}

export interface PricedOrderLine {
  menu_item_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  notes?: string;
}

export interface AuthoritativePrice {
  lines: PricedOrderLine[];
  subtotal: number;
  delivery_fee: number;
  service_fee: number;
  discount_amount: number;
  tip_amount: number;
  total_price: number;
}

export class OrderContractError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "OrderContractError";
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SENSITIVE_PAYMENT_KEYS = new Set([
  "card_number",
  "cardnumber",
  "cvv",
  "cvc",
  "security_code",
  "expiry",
  "expiry_date",
  "card_expiry",
  "pan",
]);

const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const asObject = (value: unknown, field: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OrderContractError(400, "INVALID_REQUEST", `${field} must be an object.`);
  }
  return value as Record<string, unknown>;
};

const requiredText = (value: unknown, field: string, maxLength: number): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new OrderContractError(400, "INVALID_REQUEST", `${field} is required.`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new OrderContractError(400, "INVALID_REQUEST", `${field} is too long.`);
  }
  return normalized;
};

const optionalText = (value: unknown, field: string, maxLength: number): string | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new OrderContractError(400, "INVALID_REQUEST", `${field} must be text.`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new OrderContractError(400, "INVALID_REQUEST", `${field} is too long.`);
  }
  return normalized || undefined;
};

const assertNoSensitivePaymentData = (value: unknown, path = "request"): void => {
  if (typeof value === "string") {
    const labelledCardData = /\b(?:cvv|cvc|card\s*(?:number|no)|expir(?:y|ation))\s*[:=]/i;
    const compactDigits = value.trim().replace(/[ -]/g, "");
    const possiblePan = /^\d{13,19}$/.test(compactDigits);
    if (labelledCardData.test(value) || possiblePan) {
      throw new OrderContractError(
        400,
        "SENSITIVE_PAYMENT_DATA_REJECTED",
        `Sensitive card data is not accepted (${path}).`,
      );
    }
    return;
  }
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoSensitivePaymentData(entry, `${path}[${index}]`));
    return;
  }
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase().replace(/[\s-]/g, "_");
    if (SENSITIVE_PAYMENT_KEYS.has(normalizedKey)) {
      throw new OrderContractError(
        400,
        "SENSITIVE_PAYMENT_DATA_REJECTED",
        `Sensitive card data is not accepted (${path}.${key}).`,
      );
    }
    assertNoSensitivePaymentData(nestedValue, `${path}.${key}`);
  }
};

export const parseCreateOrderInput = (raw: unknown): CreateOrderInput => {
  assertNoSensitivePaymentData(raw);
  const body = asObject(raw, "request");

  if ("_clientPricing" in body || "client_pricing" in body) {
    throw new OrderContractError(
      400,
      "CLIENT_PRICING_REJECTED",
      "Client-calculated prices are not accepted.",
    );
  }

  const idempotencyKey = requiredText(body.idempotency_key, "idempotency_key", 64);
  if (!UUID_PATTERN.test(idempotencyKey)) {
    throw new OrderContractError(400, "INVALID_IDEMPOTENCY_KEY", "idempotency_key must be a UUID.");
  }

  const shopId = requiredText(String(body.shop_id ?? ""), "shop_id", 100);
  const deliveryType = body.delivery_type;
  if (deliveryType !== "collection" && deliveryType !== "delivery") {
    throw new OrderContractError(400, "INVALID_DELIVERY_TYPE", "delivery_type must be collection or delivery.");
  }

  if (body.delivery_schedule_mode !== "standard") {
    throw new OrderContractError(
      400,
      "UNSUPPORTED_DELIVERY_SCHEDULE",
      "Only standard ordering is currently available.",
    );
  }

  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) {
    throw new OrderContractError(400, "INVALID_ITEMS", "Order items must contain between 1 and 50 lines.");
  }

  const seenItemIds = new Set<string>();
  const items = body.items.map((rawLine, index): CreateOrderLineInput => {
    const line = asObject(rawLine, `items[${index}]`);
    const menuItemId = requiredText(line.menu_item_id, `items[${index}].menu_item_id`, 100);
    if (seenItemIds.has(menuItemId)) {
      throw new OrderContractError(400, "DUPLICATE_ITEM", `Duplicate menu item ${menuItemId}.`);
    }
    seenItemIds.add(menuItemId);

    if (!Number.isInteger(line.quantity) || Number(line.quantity) < 1 || Number(line.quantity) > 20) {
      throw new OrderContractError(400, "INVALID_QUANTITY", `items[${index}].quantity must be 1 to 20.`);
    }

    const variantId = optionalText(line.variant_id, `items[${index}].variant_id`, 100);
    if (variantId) {
      throw new OrderContractError(
        422,
        "VARIANT_NOT_SUPPORTED",
        "This menu variant cannot yet be verified by the server.",
      );
    }

    return {
      menu_item_id: menuItemId,
      quantity: Number(line.quantity),
      notes: optionalText(line.notes, `items[${index}].notes`, 500),
    };
  });

  const rawPaymentMethod = body.payment_method;
  if (rawPaymentMethod !== "cash" && rawPaymentMethod !== "cash_on_arrival" && rawPaymentMethod !== "card_machine") {
    throw new OrderContractError(400, "INVALID_PAYMENT_METHOD", "Unsupported payment method.");
  }
  if (deliveryType === "delivery" && rawPaymentMethod !== "cash" && rawPaymentMethod !== "cash_on_arrival") {
    throw new OrderContractError(400, "INVALID_PAYMENT_METHOD", "Delivery is cash-only during the pilot.");
  }

  const promoCode = optionalText(body.promo_code, "promo_code", 50);
  if (promoCode) {
    throw new OrderContractError(
      422,
      "PROMO_NOT_SUPPORTED",
      "Promo codes are unavailable until server-side validation is enabled.",
    );
  }

  const tipAmount = Number(body.tip_amount ?? 0);
  if (!Number.isFinite(tipAmount) || tipAmount < 0 || tipAmount > 1_000) {
    throw new OrderContractError(400, "INVALID_TIP", "tip_amount must be between 0 and 1000.");
  }

  let deliveryCoordinates: { lat: number; lng: number } | undefined;
  if (deliveryType === "delivery") {
    const coordinates = asObject(body.delivery_coordinates, "delivery_coordinates");
    const lat = Number(coordinates.lat);
    const lng = Number(coordinates.lng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw new OrderContractError(400, "INVALID_COORDINATES", "Valid delivery coordinates are required.");
    }
    deliveryCoordinates = { lat, lng };
  }

  const customer = asObject(body.customer_details, "customer_details");
  return {
    idempotency_key: idempotencyKey,
    shop_id: shopId,
    items,
    delivery_type: deliveryType,
    delivery_schedule_mode: "standard",
    delivery_coordinates: deliveryCoordinates,
    tip_amount: roundMoney(tipAmount),
    payment_method: rawPaymentMethod,
    customer_details: {
      name: requiredText(customer.name, "customer_details.name", 120),
      phone: requiredText(customer.phone, "customer_details.phone", 30),
      email: optionalText(customer.email, "customer_details.email", 254) ?? "",
      address:
        deliveryType === "delivery"
          ? requiredText(customer.address, "customer_details.address", 500)
          : optionalText(customer.address, "customer_details.address", 500) ?? "",
      city: optionalText(customer.city, "customer_details.city", 120) ?? "",
      delivery_instructions: optionalText(
        customer.delivery_instructions,
        "customer_details.delivery_instructions",
        500,
      ),
    },
  };
};

export const calculateDistanceKm = (
  originLat: number,
  originLng: number,
  destinationLat: number,
  destinationLng: number,
): number => {
  const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latDelta = toRadians(destinationLat - originLat);
  const lngDelta = toRadians(destinationLng - originLng);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(toRadians(originLat)) *
      Math.cos(toRadians(destinationLat)) *
      Math.sin(lngDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const assertShopCanAcceptOrder = (shop: ShopForOrder, input: CreateOrderInput): void => {
  if (shop.id !== input.shop_id) {
    throw new OrderContractError(404, "SHOP_NOT_FOUND", "Shop not found.");
  }
  if (shop.approval_status !== "approved" || shop.is_active !== true) {
    throw new OrderContractError(409, "SHOP_UNAVAILABLE", "This shop is not accepting orders.");
  }
  if (input.delivery_type !== "delivery" || !input.delivery_coordinates) return;

  const shopLat = Number(shop.lat ?? shop.latitude);
  const shopLng = Number(shop.lng ?? shop.longitude);
  if (!Number.isFinite(shopLat) || !Number.isFinite(shopLng)) {
    throw new OrderContractError(409, "DELIVERY_LOCATION_UNAVAILABLE", "This shop has no verified delivery location.");
  }

  const distanceKm = calculateDistanceKm(
    shopLat,
    shopLng,
    input.delivery_coordinates.lat,
    input.delivery_coordinates.lng,
  );
  if (distanceKm > PILOT_MAX_DELIVERY_KM) {
    throw new OrderContractError(
      422,
      "OUTSIDE_DELIVERY_RADIUS",
      `Delivery address is outside the ${PILOT_MAX_DELIVERY_KM} km pilot radius.`,
    );
  }
};

export const calculateAuthoritativePrice = (
  input: CreateOrderInput,
  menuItems: MenuItemForOrder[],
): AuthoritativePrice => {
  const menuById = new Map(menuItems.map((item) => [item.id, item]));
  const lines = input.items.map((requested): PricedOrderLine => {
    const menuItem = menuById.get(requested.menu_item_id);
    if (!menuItem || menuItem.shop_id !== input.shop_id) {
      throw new OrderContractError(422, "INVALID_MENU_ITEM", "One or more menu items do not belong to this shop.");
    }
    if (menuItem.is_available !== true) {
      throw new OrderContractError(409, "MENU_ITEM_UNAVAILABLE", `${menuItem.name} is unavailable.`);
    }
    const unitPrice = Number(menuItem.price);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new OrderContractError(500, "INVALID_SERVER_PRICE", "A menu item has an invalid server price.");
    }
    return {
      menu_item_id: menuItem.id,
      name: menuItem.name,
      unit_price: roundMoney(unitPrice),
      quantity: requested.quantity,
      line_total: roundMoney(unitPrice * requested.quantity),
      ...(requested.notes ? { notes: requested.notes } : {}),
    };
  });

  const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.line_total, 0));
  const deliveryFee = input.delivery_type === "delivery" ? PILOT_DELIVERY_FEE : 0;
  const serviceFee = subtotal > 0 ? PILOT_SERVICE_FEE : 0;
  const totalPrice = roundMoney(subtotal + deliveryFee + serviceFee + input.tip_amount);

  return {
    lines,
    subtotal,
    delivery_fee: deliveryFee,
    service_fee: serviceFee,
    discount_amount: 0,
    tip_amount: input.tip_amount,
    total_price: totalPrice,
  };
};

export type OrderLifecycleState =
  | "pending"
  | "preparing"
  | "ready_for_pickup"
  | "finding_rider"
  | "rider_assigned"
  | "picked_up"
  | "delivering"
  | "delivered";

const ALLOWED_TRANSITIONS: Record<OrderLifecycleState, readonly OrderLifecycleState[]> = {
  pending: ["preparing"],
  preparing: ["ready_for_pickup"],
  ready_for_pickup: ["finding_rider"],
  finding_rider: ["rider_assigned"],
  rider_assigned: ["picked_up"],
  picked_up: ["delivering"],
  delivering: ["delivered"],
  delivered: [],
};

export const assertLifecycleTransition = (
  from: OrderLifecycleState,
  to: OrderLifecycleState,
): void => {
  if (!ALLOWED_TRANSITIONS[from]?.includes(to)) {
    throw new OrderContractError(409, "INVALID_ORDER_TRANSITION", `Order cannot move from ${from} to ${to}.`);
  }
};
