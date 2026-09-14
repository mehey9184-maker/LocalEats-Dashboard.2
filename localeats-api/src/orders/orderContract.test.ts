import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import express, { Router, type RequestHandler } from "express";
import {
  assertLifecycleTransition,
  assertShopCanAcceptOrder,
  calculateAuthoritativePrice,
  OrderContractError,
  parseCreateOrderInput,
  type ShopForOrder,
} from "./orderContract.js";
import {
  APPROVED_RIDER_CONNECTION_STATUS,
  assertRiderLifecycleAdvance,
  assignedRiderOrderResponse,
  availableRiderOrderResponse,
  interpretDeliveryCompletion,
  isApprovedRiderConnection,
  isApprovedRiderProfile,
  parseRiderDeliveryProof,
  registerRiderReadRoutes,
} from "../routes/riderOrders.js";
import {
  customerOrderResponse,
  customerOrderRoutes,
  merchantLifecycleUpdateForAction,
} from "../routes/orders.js";
import type { StoredOrder } from "./orderService.js";

const migrationSql = readFileSync(
  resolve(process.cwd(), "../supabase/migrations/20260905000000_order_integrity_foundation.sql"),
  "utf8",
);

const riderRouteSource = readFileSync(resolve(process.cwd(), "src/routes/riderOrders.ts"), "utf8");
const orderRouteSource = readFileSync(resolve(process.cwd(), "src/routes/orders.ts"), "utf8");
const orderServiceSource = readFileSync(resolve(process.cwd(), "src/orders/orderService.ts"), "utf8");
const compactOrderRouteSource = orderRouteSource.replace(/\s+/g, " ");
const merchantApiSource = readFileSync(resolve(process.cwd(), "../src/services/MerchantApi.ts"), "utf8");
const merchantWorkflowSource = readFileSync(resolve(process.cwd(), "../src/hooks/useOrderWorkflow.ts"), "utf8");
const merchantOrdersUiSource = readFileSync(resolve(process.cwd(), "../src/components/OrdersManagement.tsx"), "utf8");
const compactRiderRouteSource = riderRouteSource.replace(/\s+/g, " ");
const claimFunctionSql = migrationSql.slice(
  migrationSql.indexOf("create or replace function public.claim_delivery_order"),
  migrationSql.indexOf("drop function if exists public.complete_delivery_order"),
);
const completionFunctionSql = migrationSql.slice(
  migrationSql.indexOf("create function public.complete_delivery_order"),
  migrationSql.indexOf("revoke all on function public.claim_delivery_order"),
);
const compactClaimFunctionSql = claimFunctionSql.replace(/\s+/g, " ");
const compactCompletionFunctionSql = completionFunctionSql.replace(/\s+/g, " ");

const requestJson = async (
  app: ReturnType<typeof express>,
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: Record<string, unknown> }> => {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, init);
    return {
      status: response.status,
      body: (await response.json()) as Record<string, unknown>,
    };
  } finally {
    server.close();
    await once(server, "close");
  }
};

const merchantOrder = (
  status: string | null,
  deliveryStatus: string | null,
  deliveryType: "collection" | "delivery" = "collection",
  riderId: string | null = null,
): StoredOrder => ({
  id: "merchant-order-1",
  shop_id: "shop-1",
  user_id: "customer-1",
  rider_id: riderId,
  status,
  delivery_status: deliveryStatus,
  delivery_type: deliveryType,
  payment_method: "cash",
  price: 25,
  total_price: 25,
  delivery_fee: 0,
  service_fee: 0,
  discount_amount: 0,
  tip_amount: 0,
  items: [],
  lat: null,
  lng: null,
});

const validRequest = (): Record<string, unknown> => ({
  idempotency_key: "550e8400-e29b-41d4-a716-446655440000",
  shop_id: "shop-my-kota-ivory-park",
  items: [{ menu_item_id: "menu-1", quantity: 2 }],
  delivery_type: "delivery",
  delivery_schedule_mode: "standard",
  delivery_coordinates: { lat: -25.983, lng: 28.208 },
  tip_amount: 3,
  payment_method: "cash",
  customer_details: {
    name: "Customer",
    phone: "0712345678",
    email: "customer@example.com",
    address: "Ivory Park",
    city: "Tembisa",
  },
});

test("rejects _clientPricing instead of treating it as authority", () => {
  const request = { ...validRequest(), _clientPricing: { total_price: 1 } };
  assert.throws(() => parseCreateOrderInput(request), (error: unknown) => {
    return error instanceof OrderContractError && error.code === "CLIENT_PRICING_REJECTED";
  });
});

test("rejects sensitive card fields anywhere in the payload", () => {
  const request = { ...validRequest(), checkout: { cvv: "123" } };
  assert.throws(() => parseCreateOrderInput(request), (error: unknown) => {
    return error instanceof OrderContractError && error.code === "SENSITIVE_PAYMENT_DATA_REJECTED";
  });
});

test("rejects card credentials hidden inside notes or delivery instructions", () => {
  const request = validRequest();
  (request.customer_details as Record<string, unknown>).delivery_instructions =
    "CARD_MACHINE_PAYMENT: Card: 4111 1111 1111 1111, Expiry: 12/29, CVV: 123";
  assert.throws(
    () => parseCreateOrderInput(request),
    (error: unknown) =>
      error instanceof OrderContractError && error.code === "SENSITIVE_PAYMENT_DATA_REJECTED",
  );
});

test("delivery accepts cash and rejects card-at-shop", () => {
  assert.equal(parseCreateOrderInput(validRequest()).payment_method, "cash");
  assert.throws(
    () => parseCreateOrderInput({ ...validRequest(), payment_method: "card_machine" }),
    (error: unknown) => error instanceof OrderContractError && error.code === "INVALID_PAYMENT_METHOD",
  );
});

test("pickup accepts cash or the merchant physical card terminal", () => {
  const request = {
    ...validRequest(),
    delivery_type: "collection",
    delivery_coordinates: undefined,
    payment_method: "card_machine",
  };
  assert.equal(parseCreateOrderInput(request).payment_method, "card_machine");
});

test("delivery coordinates require strict finite JSON numbers without coercion", () => {
  const invalidCoordinates: Array<[string, Record<string, unknown>]> = [
    ["null latitude", { lat: null, lng: 28.208 }],
    ["null longitude", { lat: -25.983, lng: null }],
    ["empty latitude", { lat: "", lng: 28.208 }],
    ["empty longitude", { lat: -25.983, lng: "" }],
    ["numeric-string latitude", { lat: "0", lng: 28.208 }],
    ["numeric-string longitude", { lat: -25.983, lng: "0" }],
    ["boolean latitude", { lat: false, lng: 28.208 }],
    ["boolean longitude", { lat: -25.983, lng: false }],
    ["non-finite latitude", { lat: Number.NaN, lng: 28.208 }],
    ["non-finite longitude", { lat: -25.983, lng: Number.POSITIVE_INFINITY }],
    ["latitude above range", { lat: 91, lng: 28.208 }],
    ["latitude below range", { lat: -91, lng: 28.208 }],
    ["longitude above range", { lat: -25.983, lng: 181 }],
    ["longitude below range", { lat: -25.983, lng: -181 }],
    ["array latitude", { lat: [], lng: 28.208 }],
    ["object longitude", { lat: -25.983, lng: {} }],
  ];

  for (const [label, delivery_coordinates] of invalidCoordinates) {
    assert.throws(
      () => parseCreateOrderInput({ ...validRequest(), delivery_coordinates }),
      (error: unknown) => error instanceof OrderContractError && error.code === "INVALID_COORDINATES",
      label,
    );
  }

  assert.deepEqual(
    parseCreateOrderInput({ ...validRequest(), delivery_coordinates: { lat: 0, lng: 0 } }).delivery_coordinates,
    { lat: 0, lng: 0 },
  );
});

test("server menu prices determine every total", () => {
  const input = parseCreateOrderInput(validRequest());
  const price = calculateAuthoritativePrice(input, [
    { id: "menu-1", shop_id: input.shop_id, name: "Kota", price: "25.00", is_available: true },
  ]);
  assert.deepEqual(
    {
      subtotal: price.subtotal,
      deliveryFee: price.delivery_fee,
      serviceFee: price.service_fee,
      tip: price.tip_amount,
      total: price.total_price,
    },
    { subtotal: 50, deliveryFee: 10, serviceFee: 2.5, tip: 3, total: 65.5 },
  );
});

test("unavailable or foreign menu items fail closed", () => {
  const input = parseCreateOrderInput(validRequest());
  assert.throws(
    () =>
      calculateAuthoritativePrice(input, [
        { id: "menu-1", shop_id: input.shop_id, name: "Kota", price: 25, is_available: false },
      ]),
    (error: unknown) => error instanceof OrderContractError && error.code === "MENU_ITEM_UNAVAILABLE",
  );
  assert.throws(
    () =>
      calculateAuthoritativePrice(input, [
        { id: "menu-1", shop_id: "different-shop", name: "Kota", price: 25, is_available: true },
      ]),
    (error: unknown) => error instanceof OrderContractError && error.code === "INVALID_MENU_ITEM",
  );
});

test("delivery radius is verified from server shop coordinates", () => {
  const input = parseCreateOrderInput({
    ...validRequest(),
    delivery_coordinates: { lat: -25.90, lng: 28.208 },
  });
  assert.throws(
    () =>
      assertShopCanAcceptOrder(
        {
          id: input.shop_id,
          name: "Shop",
          is_active: true,
          approval_status: "approved",
          archived_at: null,
          latitude: -25.983,
          longitude: 28.208,
          lat: null,
          lng: null,
        },
        input,
      ),
    (error: unknown) => error instanceof OrderContractError && error.code === "OUTSIDE_DELIVERY_RADIUS",
  );
});

test("canonical lifecycle rejects checkout-to-rider and permits ordered transitions", () => {
  assert.throws(
    () => assertLifecycleTransition("pending", "finding_rider"),
    (error: unknown) => error instanceof OrderContractError && error.code === "INVALID_ORDER_TRANSITION",
  );
  const sequence = [
    "pending",
    "preparing",
    "ready_for_pickup",
    "finding_rider",
    "rider_assigned",
    "picked_up",
    "delivering",
    "delivered",
  ] as const;
  sequence.slice(0, -1).forEach((state, index) => assertLifecycleTransition(state, sequence[index + 1]));
});

test("rider pickup and delivering validate the complete persisted lifecycle pair", () => {
  assert.doesNotThrow(() =>
    assertRiderLifecycleAdvance(
      { status: "ready_for_pickup", delivery_status: "rider_assigned" },
      "rider_assigned",
      "picked_up",
    ),
  );
  assert.doesNotThrow(() =>
    assertRiderLifecycleAdvance(
      { status: "ready_for_pickup", delivery_status: "picked_up" },
      "picked_up",
      "delivering",
    ),
  );

  for (const pair of [
    { status: "cancelled", delivery_status: "rider_assigned" },
    { status: "delivered", delivery_status: "rider_assigned" },
    { status: "cancelled", delivery_status: "picked_up" },
    { status: "delivered", delivery_status: "picked_up" },
    { status: "pending", delivery_status: "rider_assigned" },
    { status: "preparing", delivery_status: "picked_up" },
    { status: "collected", delivery_status: "delivering" },
    { status: null, delivery_status: "delivering" },
  ]) {
    assert.throws(
      () => assertRiderLifecycleAdvance(pair, "rider_assigned", "picked_up"),
      (error: unknown) => error instanceof OrderContractError && error.code === "INVALID_ORDER_STATE",
      `${String(pair.status)} + ${String(pair.delivery_status)} must fail closed`,
    );
  }

  assert.throws(
    () =>
      assertRiderLifecycleAdvance(
        { status: "ready_for_pickup", delivery_status: "finding_rider" },
        "rider_assigned",
        "picked_up",
      ),
    (error: unknown) => error instanceof OrderContractError && error.code === "INVALID_ORDER_TRANSITION",
  );
});

const shopForDelivery = (overrides: Record<string, unknown> = {}): ShopForOrder => ({
  id: "shop-my-kota-ivory-park",
  name: "Shop",
  is_active: true,
  approval_status: "approved",
  archived_at: null,
  latitude: null,
  longitude: null,
  lat: -25.983,
  lng: 28.208,
  ...overrides,
} as ShopForOrder);

const deliveryInput = () => parseCreateOrderInput(validRequest());
const expectDeliveryLocationUnavailable = (shop: ShopForOrder): void => {
  assert.throws(
    () => assertShopCanAcceptOrder(shop, deliveryInput()),
    (error: unknown) =>
      error instanceof OrderContractError && error.status === 409 && error.code === "DELIVERY_LOCATION_UNAVAILABLE",
  );
};

test("shop delivery coordinates use complete coordinate families without mixing", () => {
  assert.doesNotThrow(() => assertShopCanAcceptOrder(shopForDelivery(), deliveryInput()));
  assert.doesNotThrow(() => assertShopCanAcceptOrder(shopForDelivery({
    lat: null,
    lng: null,
    latitude: "-25.983",
    longitude: "28.208",
  }), deliveryInput()));

  expectDeliveryLocationUnavailable(shopForDelivery({ lat: null, lng: null, latitude: null, longitude: null }));
  expectDeliveryLocationUnavailable(shopForDelivery({ lat: -25.983, lng: null, latitude: -25.983, longitude: 28.208 }));
  expectDeliveryLocationUnavailable(shopForDelivery({ lat: null, lng: 28.208, latitude: -25.983, longitude: 28.208 }));
  expectDeliveryLocationUnavailable(shopForDelivery({ lat: null, lng: null, latitude: -25.983, longitude: null }));
  expectDeliveryLocationUnavailable(shopForDelivery({ lat: null, lng: null, latitude: null, longitude: 28.208 }));
});

test("selected shop coordinate pairs reject coercible, non-finite, and out-of-range values", () => {
  for (const invalidLat of ["", "   ", "north", true, [], {}, Number.NaN, Number.POSITIVE_INFINITY, 91, -91]) {
    expectDeliveryLocationUnavailable(shopForDelivery({ lat: invalidLat }));
  }
  for (const invalidLng of ["", "   ", "east", false, [], {}, Number.NaN, Number.NEGATIVE_INFINITY, 181, -181]) {
    expectDeliveryLocationUnavailable(shopForDelivery({ lng: invalidLng }));
  }
  expectDeliveryLocationUnavailable(shopForDelivery({
    lat: null,
    lng: null,
    latitude: "",
    longitude: "28.208",
  }));
});

test("a complete canonical shop pair takes precedence over the complete legacy pair", () => {
  assert.doesNotThrow(() => assertShopCanAcceptOrder(shopForDelivery({
    lat: -25.983,
    lng: 28.208,
    latitude: 40,
    longitude: -74,
  }), deliveryInput()));

  expectDeliveryLocationUnavailable(shopForDelivery({
    lat: "invalid",
    lng: 28.208,
    latitude: -25.983,
    longitude: 28.208,
  }));
});

test("the order repository requests the complete narrow shop eligibility contract", () => {
  assert.match(
    orderServiceSource,
    /\.select\("id,name,is_active,approval_status,archived_at,latitude,longitude,lat,lng"\)/,
  );
});

test("merchant reject is limited to unassigned pending + none", () => {
  const update = merchantLifecycleUpdateForAction(merchantOrder("pending", "none"), "reject");
  assert.equal(update.status, "cancelled");
  assert.equal(update.delivery_status, "none");

  for (const order of [
    merchantOrder("preparing", "none"),
    merchantOrder("ready_for_pickup", "none"),
  ]) {
    assert.throws(
      () => merchantLifecycleUpdateForAction(order, "reject"),
      (error: unknown) => error instanceof OrderContractError && error.code === "INVALID_ORDER_TRANSITION",
    );
  }
  assert.throws(
    () => merchantLifecycleUpdateForAction(merchantOrder("cancelled", "rider_assigned"), "reject"),
    (error: unknown) => error instanceof OrderContractError && error.code === "INVALID_ORDER_STATE",
  );
  assert.throws(
    () => merchantLifecycleUpdateForAction(merchantOrder("pending", "none", "collection", "rider-1"), "reject"),
    (error: unknown) => error instanceof OrderContractError && error.code === "INVALID_ORDER_TRANSITION",
  );
});

test("merchant cancel is limited to unassigned preparing + none", () => {
  const update = merchantLifecycleUpdateForAction(merchantOrder("preparing", "none"), "cancel");
  assert.equal(update.status, "cancelled");
  assert.equal(update.delivery_status, "none");

  for (const order of [
    merchantOrder("pending", "none"),
    merchantOrder("ready_for_pickup", "none"),
    merchantOrder("ready_for_pickup", "finding_rider", "delivery"),
    merchantOrder("ready_for_pickup", "rider_assigned", "delivery"),
    merchantOrder("ready_for_pickup", "picked_up", "delivery"),
    merchantOrder("ready_for_pickup", "delivering", "delivery"),
  ]) {
    assert.throws(
      () => merchantLifecycleUpdateForAction(order, "cancel"),
      (error: unknown) => error instanceof OrderContractError && error.code === "INVALID_ORDER_TRANSITION",
    );
  }
  assert.throws(
    () => merchantLifecycleUpdateForAction(merchantOrder("preparing", "none", "delivery", "rider-1"), "cancel"),
    (error: unknown) => error instanceof OrderContractError && error.code === "INVALID_ORDER_TRANSITION",
  );
});

test("merchant collected is limited to unassigned ready collection + none", () => {
  const update = merchantLifecycleUpdateForAction(
    merchantOrder("ready_for_pickup", "none", "collection"),
    "collected",
  );
  assert.equal(update.status, "collected");
  assert.equal(update.delivery_status, "none");

  for (const order of [
    merchantOrder("ready_for_pickup", "none", "delivery"),
    merchantOrder("ready_for_pickup", "finding_rider", "delivery"),
    merchantOrder("ready_for_pickup", "none", "collection", "rider-1"),
  ]) {
    assert.throws(
      () => merchantLifecycleUpdateForAction(order, "collected"),
      (error: unknown) => error instanceof OrderContractError && error.code === "INVALID_ORDER_TRANSITION",
    );
  }
});

test("merchant terminal routes and client flow retain full source-pair CAS authority", () => {
  for (const action of ["reject", "cancel", "collected"]) {
    assert.ok(orderRouteSource.includes(`"/:id/${action}"`));
    assert.ok(merchantApiSource.includes(`| "${action}"`));
  }
  assert.ok(
    compactOrderRouteSource.includes(
      '.eq("id", orderId) .eq("status", String(order.status))',
    ),
  );
  assert.ok(compactOrderRouteSource.includes('sourcePairQuery.is("rider_id", null)'));
  assert.ok(compactOrderRouteSource.includes('sourceAndRiderQuery.eq("delivery_type", "collection")'));
  assert.match(orderRouteSource, /order\.delivery_status === null[\s\S]*\.is\("delivery_status", null\)/);
  assert.match(orderRouteSource, /\.eq\("delivery_status", String\(order\.delivery_status\)\)/);
  assert.match(merchantWorkflowSource, /MerchantApi\.transitionOrder\(id, action\)/);
  assert.match(merchantWorkflowSource, /action === "reject" \? "Order rejected\." : "Order cancelled\."/);
  assert.match(merchantOrdersUiSource, /runLifecycleAction\(order\.id, "collected"\)/);
  assert.doesNotMatch(merchantWorkflowSource, /supabase\.from\(["']orders["']\)\.update/);
  assert.doesNotMatch(merchantOrdersUiSource, /supabase\.from\(["']orders["']\)\.update/);
});

test("express and unverified promo pricing fail closed", () => {
  assert.throws(
    () => parseCreateOrderInput({ ...validRequest(), delivery_schedule_mode: "express" }),
    (error: unknown) => error instanceof OrderContractError && error.code === "UNSUPPORTED_DELIVERY_SCHEDULE",
  );
  assert.throws(
    () => parseCreateOrderInput({ ...validRequest(), promo_code: "FREE100" }),
    (error: unknown) => error instanceof OrderContractError && error.code === "PROMO_NOT_SUPPORTED",
  );
});

test("the authenticated quote endpoint rejects a request with no Firebase bearer token", async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/orders", customerOrderRoutes);

  const response = await requestJson(app, "/api/v1/orders/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(validRequest()),
  });

  assert.equal(response.status, 401);
  assert.equal(response.body.success, false);
});

test("the /available request reaches the static available-deliveries handler", async () => {
  const app = express();
  const testRouter = Router();
  const passAuthentication: RequestHandler = (_req, _res, next) => next();
  const mine: RequestHandler = (_req, res) => {
    res.status(200).json({ handler: "mine" });
  };
  const available: RequestHandler = (_req, res) => {
    res.status(200).json({ handler: "available" });
  };
  const assignedById: RequestHandler = (req, res) => {
    res.status(200).json({ handler: "by-id", id: req.params.id });
  };

  registerRiderReadRoutes(testRouter, passAuthentication, { mine, available, assignedById });
  app.use("/api/v1/rider/orders", testRouter);
  const response = await requestJson(app, "/api/v1/rider/orders/available");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { handler: "available" });
});

test("rider response contracts expose only role-appropriate allowlisted fields", () => {
  const databaseOrder: Record<string, unknown> = {
    id: "order-1",
    shop_id: "shop-1",
    product_name: "Kota",
    product_variant: null,
    price: 25,
    total_price: 37.5,
    delivery_fee: 10,
    service_fee: 2.5,
    discount_amount: 0,
    tip_amount: 0,
    payment_method: "cash",
    items: [{ name: "Kota", quantity: 1 }],
    customer_name: "Customer",
    phone: "0712345678",
    email: "customer@example.com",
    address: "10 Private Street",
    city: "Tembisa",
    lat: -25.983,
    lng: 28.208,
    notes: "Gate code",
    status: "ready_for_pickup",
    delivery_status: "finding_rider",
    rider_id: null,
    delivery_type: "delivery",
    created_at: "2026-09-06T00:00:00.000Z",
    updated_at: "2026-09-06T00:01:00.000Z",
    user_id: "firebase-customer-1",
    customer_firebase_uid: "firebase-customer-1",
    idempotency_key: "550e8400-e29b-41d4-a716-446655440000",
    delivery_pin_hash: true,
    delivery_qr_hash: true,
    delivery_confirmation_token: true,
    server_secret: true,
  };

  const available = availableRiderOrderResponse(databaseOrder);
  assert.deepEqual(Object.keys(available).sort(), [
    "city",
    "created_at",
    "delivery_fee",
    "delivery_status",
    "delivery_type",
    "id",
    "payment_method",
    "product_name",
    "shop_id",
    "status",
    "total_price",
  ]);
  assert.equal(available.address, undefined);
  assert.equal(available.lat, undefined);
  assert.equal(available.lng, undefined);
  assert.equal(available.phone, undefined);
  assert.equal(available.email, undefined);
  assert.equal(available.customer_name, undefined);

  const assigned = assignedRiderOrderResponse(databaseOrder);
  assert.equal(assigned.address, databaseOrder.address);
  assert.equal(assigned.lat, databaseOrder.lat);
  assert.equal(assigned.lng, databaseOrder.lng);
  assert.equal(assigned.phone, databaseOrder.phone);

  for (const field of [
    "email",
    "user_id",
    "customer_firebase_uid",
    "idempotency_key",
    "delivery_pin_hash",
    "delivery_qr_hash",
    "delivery_confirmation_token",
    "server_secret",
  ]) {
    assert.equal(field in available, false, `${field} leaked before claim`);
    assert.equal(field in assigned, false, `${field} leaked after assignment`);
  }
});

test("claim, pickup, delivering, and delivered responses retain the assigned-rider privacy contract", () => {
  const forbiddenFields = [
    "email",
    "user_id",
    "customer_firebase_uid",
    "idempotency_key",
    "delivery_pin_hash",
    "delivery_qr_hash",
    "delivery_confirmation_token",
    "server_secret",
  ];

  for (const { action, deliveryStatus } of [
    { action: "claim", deliveryStatus: "rider_assigned" },
    { action: "pickup", deliveryStatus: "picked_up" },
    { action: "delivering", deliveryStatus: "delivering" },
    { action: "delivered", deliveryStatus: "delivered" },
  ]) {
    const response = assignedRiderOrderResponse({
      id: `order-${action}`,
      delivery_status: deliveryStatus,
      address: "10 Private Street",
      phone: "0712345678",
      email: "customer@example.com",
      user_id: "firebase-customer-1",
      customer_firebase_uid: "firebase-customer-1",
      idempotency_key: "550e8400-e29b-41d4-a716-446655440000",
      delivery_pin_hash: true,
      delivery_qr_hash: true,
      delivery_confirmation_token: true,
      server_secret: true,
    });

    assert.equal(response.delivery_status, deliveryStatus);
    assert.equal(response.address, "10 Private Street");
    assert.equal(response.phone, "0712345678");
    for (const field of forbiddenFields) {
      assert.equal(field in response, false, `${field} leaked from ${action} response`);
    }
  }
});

test("pending riders and non-approved merchant connections cannot authorize delivery access", () => {
  assert.equal(isApprovedRiderProfile({ verification_status: "pending" }), false);
  assert.equal(isApprovedRiderProfile({ verification_status: "rejected" }), false);
  assert.equal(isApprovedRiderProfile({ verification_status: "approved" }), true);

  assert.equal(APPROVED_RIDER_CONNECTION_STATUS, "approved");
  assert.equal(isApprovedRiderConnection({ status: "pending" }), false);
  assert.equal(isApprovedRiderConnection({ status: "active" }), false);
  assert.equal(isApprovedRiderConnection({ status: "approved" }), true);
  assert.match(
    riderRouteSource,
    /\.eq\("status", APPROVED_RIDER_CONNECTION_STATUS\)/,
  );
  assert.doesNotMatch(riderRouteSource, /\.in\("status", \["active", "approved"\]\)/);
});

test("rider reads and assigned lifecycle writes require canonical persisted pairs", () => {
  assert.ok(
    compactRiderRouteSource.includes(
      '.eq("status", "delivered").eq("delivery_status", "delivered")',
    ),
  );
  assert.ok(
    compactRiderRouteSource.includes(
      '.eq("status", "ready_for_pickup") .in("delivery_status", ["rider_assigned", "picked_up", "delivering"])',
    ),
  );
  assert.ok(
    compactRiderRouteSource.includes(
      '.eq("status", "ready_for_pickup") .eq("delivery_status", "finding_rider") .is("rider_id", null)',
    ),
  );
  assert.ok(
    compactRiderRouteSource.includes(
      '.select("status,delivery_status") .eq("id", orderId) .eq("rider_id", rider.id) .maybeSingle()',
    ),
  );
  assert.ok(
    compactRiderRouteSource.includes(
      '.eq("rider_id", rider.id) .eq("status", "ready_for_pickup") .eq("delivery_status", expected)',
    ),
  );
  assert.match(riderRouteSource, /lifecycleStateFromOrder\(data as unknown as StoredOrder\)/);
});

test("staged claim RPC uses a NULL-safe pair guard and full compare-and-set", () => {
  assert.ok(
    compactClaimFunctionSql.includes(
      "if v_order.status is distinct from 'ready_for_pickup' or v_order.delivery_status is distinct from 'finding_rider' or v_order.rider_id is not null then",
    ),
  );
  assert.ok(
    compactClaimFunctionSql.includes(
      "where id = p_order_id and status = 'ready_for_pickup' and rider_id is null and delivery_status = 'finding_rider' returning *",
    ),
  );
  assert.match(claimFunctionSql, /verification_status = 'approved'/);
  assert.match(claimFunctionSql, /and is_online is true/);
  assert.match(claimFunctionSql, /and status = 'approved'/);
  assert.match(claimFunctionSql, /expires_at is null or expires_at > now\(\)/);
  assert.doesNotMatch(claimFunctionSql, /v_order\.(?:status|delivery_status)\s*<>/);
});

test("staged completion RPC rejects NULL or contradictory pairs before proof mutation", () => {
  assert.ok(
    compactCompletionFunctionSql.includes(
      "if v_order.status = 'delivered' and v_order.delivery_status = 'delivered' then",
    ),
  );
  assert.ok(
    compactCompletionFunctionSql.includes(
      "if v_order.status is distinct from 'ready_for_pickup' or v_order.delivery_status is distinct from 'delivering' then",
    ),
  );
  assert.ok(
    compactCompletionFunctionSql.includes(
      "where id = p_order_id and rider_id = v_rider.id and status = 'ready_for_pickup' and delivery_status = 'delivering' returning * into v_order; if not found then return jsonb_build_object( 'success', false, 'error_code', 'INVALID_ORDER_STATE', 'replayed', false",
    ),
  );

  const invalidPairGuard = completionFunctionSql.indexOf(
    "if v_order.status is distinct from 'ready_for_pickup'",
  );
  const proofValidation = completionFunctionSql.indexOf("if p_delivery_proof_kind = 'pin'");
  const proofMutation = completionFunctionSql.indexOf("set delivery_pin_failed_attempts = v_failed_attempts");
  const riderStatsMutation = completionFunctionSql.indexOf(
    "set total_deliveries = coalesce(total_deliveries, 0) + 1",
  );
  const guardedUpdateFailure = completionFunctionSql.lastIndexOf("if not found then");
  assert.ok(invalidPairGuard >= 0 && invalidPairGuard < proofValidation);
  assert.ok(invalidPairGuard < proofMutation);
  assert.ok(guardedUpdateFailure >= 0 && guardedUpdateFailure < riderStatsMutation);
  assert.doesNotMatch(completionFunctionSql, /v_order\.(?:status|delivery_status)\s*<>/);
});

test("delivery proof input distinguishes a PIN from a high-entropy QR token", () => {
  assert.deepEqual(parseRiderDeliveryProof("1234"), { kind: "pin", value: "1234" });
  const qr = `le_${"a".repeat(64)}`;
  assert.deepEqual(parseRiderDeliveryProof(qr), { kind: "qr", value: qr });
  assert.throws(
    () => parseRiderDeliveryProof("12345"),
    (error: unknown) =>
      error instanceof OrderContractError && error.code === "INVALID_DELIVERY_CONFIRMATION",
  );
});

test("structured completion failures map invalid and locked PIN outcomes safely", () => {
  const invalidState = interpretDeliveryCompletion({
    success: false,
    error_code: "INVALID_ORDER_STATE",
    replayed: false,
  });
  assert.deepEqual(invalidState, {
    ok: false,
    status: 409,
    code: "INVALID_ORDER_STATE",
    message: "This order is not ready to be completed.",
  });

  const invalid = interpretDeliveryCompletion({
    success: false,
    error_code: "INVALID_DELIVERY_PROOF",
    replayed: false,
  });
  assert.deepEqual(invalid, {
    ok: false,
    status: 409,
    code: "INVALID_DELIVERY_CONFIRMATION",
    message: "The delivery PIN or QR code is incorrect.",
  });

  const locked = interpretDeliveryCompletion({
    success: false,
    error_code: "PIN_LOCKED",
    retry_after: 900,
    replayed: false,
  });
  assert.deepEqual(locked, {
    ok: false,
    status: 429,
    code: "DELIVERY_PIN_LOCKED",
    message: "Too many incorrect PIN attempts. Try again later or scan the delivery QR code.",
    retryAfter: 900,
  });
});

test("completion responses do not expose proof hashes or invent rider earnings", () => {
  const outcome = interpretDeliveryCompletion({
    success: true,
    replayed: false,
    earnings_awarded: 10,
    order: {
      id: "order-complete",
      delivery_status: "delivered",
      delivery_pin_hash: true,
      delivery_qr_hash: true,
    },
  });
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;

  const response = assignedRiderOrderResponse(outcome.order);
  assert.equal("delivery_pin_hash" in response, false);
  assert.equal("delivery_qr_hash" in response, false);
  assert.equal("earnings_awarded" in outcome, false);
  assert.equal("earnings_awarded" in response, false);
});

test("delivered, collected, and cancelled customer orders do not return active confirmation proof", () => {
  const baseOrder = {
    id: "order-final",
    shop_id: "shop-1",
    user_id: "firebase-customer-1",
    rider_id: "00000000-0000-4000-8000-000000000001",
    status: "delivered",
    delivery_status: "delivered",
    payment_method: "cash_on_arrival",
    price: 25,
    total_price: 37.5,
    delivery_fee: 10,
    service_fee: 2.5,
    discount_amount: 0,
    tip_amount: 0,
    items: [],
    lat: -25.983,
    lng: 28.208,
    delivery_type: "delivery",
    idempotency_key: "550e8400-e29b-41d4-a716-446655440000",
    delivery_pin_hash: "stored-test-value",
    delivery_qr_hash: "stored-test-value",
    delivery_pin_failed_attempts: 4,
    delivery_pin_locked_until: "2026-09-07T12:00:00.000Z",
  } satisfies StoredOrder;

  const completed = customerOrderResponse(baseOrder);
  const cancelled = customerOrderResponse({
    ...baseOrder,
    status: "cancelled",
    delivery_status: "none",
  });
  const collected = customerOrderResponse({
    ...baseOrder,
    status: "collected",
    delivery_status: "none",
  });
  assert.equal("delivery_confirmation" in completed, false);
  assert.equal("delivery_confirmation" in collected, false);
  assert.equal("delivery_confirmation" in cancelled, false);
  for (const field of [
    "delivery_pin_hash",
    "delivery_qr_hash",
    "delivery_pin_failed_attempts",
    "delivery_pin_locked_until",
  ]) {
    assert.equal(field in completed, false);
    assert.equal(field in collected, false);
    assert.equal(field in cancelled, false);
  }
});

test("staged migration persists PIN lockout, preserves replay idempotency, and removes invented rewards", () => {
  assert.match(migrationSql, /delivery_pin_failed_attempts integer/);
  assert.match(migrationSql, /delivery_pin_locked_until timestamptz/);
  assert.match(migrationSql, /v_failed_attempts >= 5 then v_now \+ interval '15 minutes'/);
  assert.match(migrationSql, /set delivery_pin_failed_attempts = v_failed_attempts,/);
  assert.match(migrationSql, /p_delivery_proof_kind = 'pin'/);
  assert.match(migrationSql, /p_delivery_proof_kind = 'qr'/);
  assert.match(migrationSql, /p_delivery_proof_hash <> v_order\.delivery_pin_hash/);
  assert.match(migrationSql, /p_delivery_proof_hash <> v_order\.delivery_qr_hash/);
  assert.match(migrationSql, /delivery_pin_hash = null,/);
  assert.match(migrationSql, /delivery_qr_hash = null,/);
  assert.doesNotMatch(migrationSql, /total_earnings\s*=/);
  assert.doesNotMatch(migrationSql, /active_points\s*=/);

  const replayGuard = migrationSql.indexOf("if v_order.status = 'delivered'");
  const deliveriesIncrement = migrationSql.indexOf("set total_deliveries = coalesce(total_deliveries, 0) + 1");
  assert.ok(replayGuard >= 0 && deliveriesIncrement > replayGuard);
  assert.equal(
    migrationSql.match(/set total_deliveries = coalesce\(total_deliveries, 0\) \+ 1/g)?.length,
    1,
  );
});

test("staged migration locks tables and RPCs to server authority without row deletion", () => {
  assert.match(migrationSql, /alter column shop_id set not null/);
  assert.match(migrationSql, /foreign key \(shop_id\) references public\.shops\(id\) on delete restrict/);
  assert.match(migrationSql, /foreign key \(shop_id\) references public\.shops\(id\) on delete cascade/);
  assert.match(migrationSql, /foreign key \(rider_id\) references public\.rider_profiles\(id\) on delete cascade/);
  assert.match(migrationSql, /alter column id set default gen_random_uuid\(\)/);
  assert.match(migrationSql, /constraint_def\.confrelid = 'auth\.users'::regclass/);
  assert.match(migrationSql, /alter column firebase_uid set not null/);
  assert.match(migrationSql, /alter column verification_status set default 'pending'/);
  assert.match(migrationSql, /alter column status set default 'pending'/);
  assert.match(migrationSql, /and status = 'approved'/);
  assert.doesNotMatch(migrationSql, /and status in \('active', 'approved'\)/);
  assert.match(migrationSql, /security invoker\s+set search_path = ''/);
  assert.match(migrationSql, /from public, anon, authenticated/);
  assert.match(migrationSql, /to service_role/);
  assert.doesNotMatch(migrationSql, /^\s*(delete|truncate)\s+/im);
});
