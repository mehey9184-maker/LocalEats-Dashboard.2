import test from "node:test";
import assert from "node:assert/strict";
import {
  assertLifecycleTransition,
  assertShopCanAcceptOrder,
  calculateAuthoritativePrice,
  OrderContractError,
  parseCreateOrderInput,
} from "./orderContract.js";

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
