import test from "node:test";
import assert from "node:assert/strict";
import {
  createOrder,
  lifecycleStateFromOrder,
  lifecycleUpdateFor,
  orderRequiresDeliveryProof,
  quoteOrder,
  type NewOrderRecord,
  type OrderRepository,
  type StoredOrder,
} from "./orderService.js";
import { OrderContractError, parseCreateOrderInput, type MenuItemForOrder, type ShopForOrder } from "./orderContract.js";
import type { OrderLifecycleState } from "./orderContract.js";

const TEST_DELIVERY_PROOF_SECRET = "test-only-delivery-proof-secret-32-chars";

const lifecycleOrder = (status: string | null, delivery_status: string | null): StoredOrder => ({
  id: "order-1", shop_id: "shop-1", user_id: "customer-1", rider_id: null,
  status, delivery_status, payment_method: "cash", price: 25, total_price: 37.5,
  delivery_fee: 10, service_fee: 2.5, discount_amount: 0, tip_amount: 0,
  items: [], lat: -25.983, lng: 28.208,
});

const validLifecyclePairs: [string, string, OrderLifecycleState][] = [
  ["pending", "none", "pending"],
  ["preparing", "none", "preparing"],
  ["ready_for_pickup", "none", "ready_for_pickup"],
  ["ready_for_pickup", "finding_rider", "finding_rider"],
  ["ready_for_pickup", "rider_assigned", "rider_assigned"],
  ["ready_for_pickup", "picked_up", "picked_up"],
  ["ready_for_pickup", "delivering", "delivering"],
  ["collected", "none", "collected"],
  ["delivered", "delivered", "delivered"],
  ["cancelled", "none", "cancelled"],
];

for (const [status, deliveryStatus, expected] of validLifecyclePairs) {
  test(`lifecycle recognizes ${status} + ${deliveryStatus} as ${expected}`, () => {
    assert.equal(lifecycleStateFromOrder(lifecycleOrder(status, deliveryStatus)), expected);
  });
}

test("lifecycle rejects every noncanonical pair, including terminal, unknown and null states", () => {
  const statuses = ["pending", "preparing", "ready_for_pickup", "delivered", "cancelled", "collected", "unknown", "", null];
  const deliveryStatuses = ["none", "pending", "finding_rider", "rider_assigned", "picked_up", "delivering", "delivered", "cancelled", "unknown", "", null];
  let rejected = 0;
  for (const status of statuses) {
    for (const deliveryStatus of deliveryStatuses) {
      if (validLifecyclePairs.some(([s, d]) => s === status && d === deliveryStatus)) continue;
      const order = lifecycleOrder(status, deliveryStatus);
      const before = structuredClone(order);
      const invalidState = (error: unknown): boolean =>
        error instanceof OrderContractError && error.status === 409 &&
        error.code === "INVALID_ORDER_STATE" &&
        error.message === "Order state does not permit this operation.";
      assert.throws(() => lifecycleStateFromOrder(order), invalidState);
      for (const [, , target] of validLifecyclePairs) {
        assert.throws(() => lifecycleUpdateFor(order, target), invalidState);
      }
      assert.deepEqual(order, before);
      rejected++;
    }
  }
  assert.equal(rejected, 89);
});

test("canonical lifecycle updates preserve the full forward journey and delivered is terminal", () => {
  let order = lifecycleOrder("pending", "none");
  for (const target of [
    "preparing",
    "ready_for_pickup",
    "finding_rider",
    "rider_assigned",
    "picked_up",
    "delivering",
    "delivered",
  ] as const) {
    order = { ...order, ...lifecycleUpdateFor(order, target) };
    assert.equal(lifecycleStateFromOrder(order), target);
  }
  for (const [, , target] of validLifecyclePairs) {
    assert.throws(() => lifecycleUpdateFor(order, target), (error: unknown) =>
      error instanceof OrderContractError && error.status === 409 && error.code === "INVALID_ORDER_TRANSITION");
  }
});

test("merchant terminal transitions are canonical and terminal", () => {
  const pending = lifecycleOrder("pending", "none");
  const rejected = { ...pending, ...lifecycleUpdateFor(pending, "cancelled") };
  assert.deepEqual(
    { status: rejected.status, delivery_status: rejected.delivery_status },
    { status: "cancelled", delivery_status: "none" },
  );

  const preparing = { ...pending, ...lifecycleUpdateFor(pending, "preparing") } as StoredOrder;
  const cancelled = { ...preparing, ...lifecycleUpdateFor(preparing, "cancelled") };
  assert.equal(lifecycleStateFromOrder(cancelled), "cancelled");

  const collectionReady = {
    ...preparing,
    ...lifecycleUpdateFor(preparing, "ready_for_pickup"),
    delivery_type: "collection" as const,
  } as StoredOrder;
  const collected = { ...collectionReady, ...lifecycleUpdateFor(collectionReady, "collected") };
  assert.deepEqual(
    { status: collected.status, delivery_status: collected.delivery_status },
    { status: "collected", delivery_status: "none" },
  );

  for (const terminal of [rejected, cancelled, collected]) {
    for (const [, , target] of validLifecyclePairs) {
      assert.throws(
        () => lifecycleUpdateFor(terminal, target),
        (error: unknown) =>
          error instanceof OrderContractError && error.code === "INVALID_ORDER_TRANSITION",
      );
    }
  }
});

test("collected and cancelled orders never require active delivery proof", () => {
  for (const status of ["collected", "cancelled"] as const) {
    const order = {
      ...lifecycleOrder(status, "none"),
      delivery_type: "delivery" as const,
    };
    assert.equal(orderRequiresDeliveryProof(order), false);
  }
});

const validRequest = (): Record<string, unknown> => ({
  idempotency_key: "550e8400-e29b-41d4-a716-446655440000",
  shop_id: "shop-1",
  items: [{ menu_item_id: "menu-1", quantity: 2 }],
  delivery_type: "delivery",
  delivery_schedule_mode: "standard",
  delivery_coordinates: { lat: -25.983, lng: 28.208 },
  tip_amount: 0,
  payment_method: "cash_on_arrival",
  customer_details: {
    name: "Customer",
    phone: "0712345678",
    email: "customer@example.com",
    address: "Ivory Park",
    city: "Tembisa",
  },
});

const input = () => parseCreateOrderInput(validRequest());
const createInput = (acceptedTotalPrice = 62.5) => parseCreateOrderInput({
  ...validRequest(),
  accepted_total_price: acceptedTotalPrice,
});

class MemoryRepository implements OrderRepository {
  existing: StoredOrder | null = null;
  insertError: { code?: string; message: string } | null = null;
  insertedRecord: NewOrderRecord | null = null;
  idempotencyLookups = 0;
  insertCalls = 0;
  shop: ShopForOrder = {
    id: "shop-1",
    name: "Shop",
    is_active: true,
    approval_status: "approved",
    archived_at: null,
    latitude: -25.983,
    longitude: 28.208,
    lat: null,
    lng: null,
  };
  menu: MenuItemForOrder[] = [
    { id: "menu-1", shop_id: "shop-1", name: "Kota", price: 25, is_available: true },
  ];

  async findOrderByIdempotencyKey(): Promise<StoredOrder | null> {
    this.idempotencyLookups += 1;
    return this.existing;
  }
  async findShop(): Promise<ShopForOrder | null> {
    return this.shop;
  }
  async findMenuItems(): Promise<MenuItemForOrder[]> {
    return this.menu;
  }
  async insertOrder(record: NewOrderRecord) {
    this.insertCalls += 1;
    this.insertedRecord = record;
    if (this.insertError) return { order: null, error: this.insertError };
    const order = { id: "order-1", rider_id: null, ...record } as StoredOrder;
    this.existing = order;
    return { order, error: null };
  }
}

test("an authenticated quote returns authoritative pricing and performs zero writes", async () => {
  const repository = new MemoryRepository();
  const request = input();
  assert.equal(request.accepted_total_price, undefined);
  const quote = await quoteOrder(repository, "firebase-customer-1", request);

  assert.deepEqual(quote, {
    subtotal: 50,
    delivery_fee: 10,
    service_fee: 2.5,
    discount_amount: 0,
    tip_amount: 0,
    total_price: 62.5,
    delivery_type: "delivery",
    payment_method: "cash_on_arrival",
  });
  assert.equal(repository.idempotencyLookups, 0);
  assert.equal(repository.insertCalls, 0);
  assert.equal(repository.insertedRecord, null);
});

test("accepted total consent cannot influence the authoritative quote", async () => {
  const repository = new MemoryRepository();
  const quote = await quoteOrder(repository, "firebase-customer-1", createInput(1));
  assert.equal(quote.total_price, 62.5);
  assert.equal(repository.insertCalls, 0);
  assert.equal(repository.insertedRecord, null);
});

test("new order creation requires customer consent to the authoritative total", async () => {
  const repository = new MemoryRepository();
  await assert.rejects(
    () => createOrder(repository, "firebase-customer-1", input(), TEST_DELIVERY_PROOF_SECRET),
    (error: unknown) =>
      error instanceof OrderContractError && error.status === 409 && error.code === "PRICE_CONSENT_REQUIRED",
  );
  assert.equal(repository.insertCalls, 0);
  assert.equal(repository.insertedRecord, null);
});

test("new order creation rejects changed price consent without inserting", async () => {
  const repository = new MemoryRepository();
  await assert.rejects(
    () => createOrder(repository, "firebase-customer-1", createInput(62.51), TEST_DELIVERY_PROOF_SECRET),
    (error: unknown) =>
      error instanceof OrderContractError && error.status === 409 && error.code === "PRICE_CHANGED",
  );
  assert.equal(repository.insertCalls, 0);
  assert.equal(repository.insertedRecord, null);
});

test("a menu price change after quote requires renewed customer consent", async () => {
  const repository = new MemoryRepository();
  const request = input();
  const quote = await quoteOrder(repository, "firebase-customer-1", request);
  assert.equal(quote.total_price, 62.5);

  repository.menu[0].price = 30;
  await assert.rejects(
    () => createOrder(
      repository,
      "firebase-customer-1",
      { ...request, accepted_total_price: quote.total_price },
      TEST_DELIVERY_PROOF_SECRET,
    ),
    (error: unknown) =>
      error instanceof OrderContractError && error.status === 409 && error.code === "PRICE_CHANGED",
  );
  assert.equal(repository.insertCalls, 0);
  assert.equal(repository.insertedRecord, null);
});

test("an unauthenticated quote is rejected before persistence", async () => {
  const repository = new MemoryRepository();
  await assert.rejects(
    () => quoteOrder(repository, "", input()),
    (error: unknown) => error instanceof OrderContractError && error.code === "UNAUTHORIZED",
  );
  assert.equal(repository.insertCalls, 0);
});

test("client totals cannot override an authoritative quote", async () => {
  const repository = new MemoryRepository();
  const request = input();
  const quote = await quoteOrder(repository, "firebase-customer-1", request);
  assert.equal(quote.subtotal, 50);
  assert.equal(quote.total_price, 62.5);
  assert.throws(
    () => parseCreateOrderInput({ ...validRequest(), subtotal: 0.01, total_price: 0.01 }),
    (error: unknown) => error instanceof OrderContractError && error.code === "CLIENT_PRICING_REJECTED",
  );
  assert.throws(
    () => parseCreateOrderInput({ ...validRequest(), _clientPricing: { total_price: 0.01 } }),
    (error: unknown) => error instanceof OrderContractError && error.code === "CLIENT_PRICING_REJECTED",
  );
});

test("quote fails closed for unavailable and foreign menu items", async () => {
  const unavailable = new MemoryRepository();
  unavailable.menu = [
    { id: "menu-1", shop_id: "shop-1", name: "Kota", price: 25, is_available: false },
  ];
  await assert.rejects(
    () => quoteOrder(unavailable, "firebase-customer-1", input()),
    (error: unknown) => error instanceof OrderContractError && error.code === "MENU_ITEM_UNAVAILABLE",
  );

  const foreign = new MemoryRepository();
  foreign.menu = [
    { id: "menu-1", shop_id: "another-shop", name: "Kota", price: 25, is_available: true },
  ];
  await assert.rejects(
    () => quoteOrder(foreign, "firebase-customer-1", input()),
    (error: unknown) => error instanceof OrderContractError && error.code === "INVALID_MENU_ITEM",
  );
});

test("quote rejects inactive, archived, and non-approved shops", async () => {
  const inactive = new MemoryRepository();
  inactive.shop.is_active = false;
  await assert.rejects(
    () => quoteOrder(inactive, "firebase-customer-1", input()),
    (error: unknown) => error instanceof OrderContractError && error.code === "SHOP_UNAVAILABLE",
  );

  const archived = new MemoryRepository();
  archived.shop.archived_at = "2026-09-01T00:00:00.000Z";
  for (const request of [
    input(),
    parseCreateOrderInput({
      ...validRequest(),
      delivery_type: "collection",
      delivery_coordinates: undefined,
    }),
  ]) {
    await assert.rejects(
      () => quoteOrder(archived, "firebase-customer-1", request),
      (error: unknown) => error instanceof OrderContractError && error.code === "SHOP_UNAVAILABLE",
    );
  }

  for (const status of ["pending", "rejected", "suspended"]) {
    const unapproved = new MemoryRepository();
    unapproved.shop.approval_status = status;
    await assert.rejects(
      () => quoteOrder(unapproved, "firebase-customer-1", input()),
      (error: unknown) => error instanceof OrderContractError && error.code === "SHOP_UNAVAILABLE",
    );
  }
});

test("create rejects an archived shop before idempotency lookup or insert", async () => {
  const repository = new MemoryRepository();
  repository.shop.archived_at = "2026-09-01T00:00:00.000Z";

  await assert.rejects(
    () => createOrder(repository, "firebase-customer-1", createInput(), TEST_DELIVERY_PROOF_SECRET),
    (error: unknown) => error instanceof OrderContractError && error.code === "SHOP_UNAVAILABLE",
  );
  assert.equal(repository.idempotencyLookups, 0);
  assert.equal(repository.insertCalls, 0);
  assert.equal(repository.insertedRecord, null);
});

test("quote rejects delivery outside the pilot radius", async () => {
  const repository = new MemoryRepository();
  const request = parseCreateOrderInput({
    ...validRequest(),
    delivery_coordinates: { lat: -25.9, lng: 28.208 },
  });
  await assert.rejects(
    () => quoteOrder(repository, "firebase-customer-1", request),
    (error: unknown) => error instanceof OrderContractError && error.code === "OUTSIDE_DELIVERY_RADIUS",
  );
});

test("quote keeps payment, promo, express, and schedule pilot restrictions", () => {
  assert.throws(
    () => parseCreateOrderInput({ ...validRequest(), payment_method: "card_machine" }),
    (error: unknown) => error instanceof OrderContractError && error.code === "INVALID_PAYMENT_METHOD",
  );
  assert.throws(
    () => parseCreateOrderInput({ ...validRequest(), promo_code: "FREE100" }),
    (error: unknown) => error instanceof OrderContractError && error.code === "PROMO_NOT_SUPPORTED",
  );
  assert.throws(
    () => parseCreateOrderInput({ ...validRequest(), delivery_schedule_mode: "express" }),
    (error: unknown) => error instanceof OrderContractError && error.code === "UNSUPPORTED_DELIVERY_SCHEDULE",
  );
  assert.throws(
    () => parseCreateOrderInput({ ...validRequest(), delivery_schedule_mode: "scheduled" }),
    (error: unknown) => error instanceof OrderContractError && error.code === "UNSUPPORTED_DELIVERY_SCHEDULE",
  );
});

test("quote and create order share the same authoritative pricing result", async () => {
  const repository = new MemoryRepository();
  const request = input();
  const quote = await quoteOrder(repository, "firebase-customer-1", request);
  const created = await createOrder(
    repository,
    "firebase-customer-1",
    { ...request, accepted_total_price: quote.total_price },
    TEST_DELIVERY_PROOF_SECRET,
  );

  assert.deepEqual(
    {
      subtotal: Number(created.order.price),
      delivery_fee: Number(created.order.delivery_fee),
      service_fee: Number(created.order.service_fee),
      discount_amount: Number(created.order.discount_amount),
      tip_amount: Number(created.order.tip_amount),
      total_price: Number(created.order.total_price),
      delivery_type: created.order.delivery_type,
      payment_method: created.order.payment_method,
    },
    quote,
  );
});

test("a cash delivery is persisted pending with no rider search at checkout", async () => {
  const repository = new MemoryRepository();
  const result = await createOrder(repository, "firebase-customer-1", createInput(), TEST_DELIVERY_PROOF_SECRET);
  assert.equal(result.replayed, false);
  assert.equal(result.order.status, "pending");
  assert.equal(result.order.delivery_status, "none");
  assert.equal(result.order.payment_method, "cash_on_arrival");
  assert.equal(repository.insertedRecord?.user_id, "firebase-customer-1");
  assert.equal(repository.insertedRecord?.price, 50);
  assert.equal(repository.insertedRecord?.delivery_fee, 10);
  assert.equal(repository.insertedRecord?.service_fee, 2.5);
  assert.equal(repository.insertedRecord?.total_price, 62.5);
  assert.equal("accepted_total_price" in (repository.insertedRecord ?? {}), false);
  assert.match(result.deliveryProof?.pin ?? "", /^\d{4}$/);
  assert.match(result.deliveryProof?.qr_token ?? "", /^le_[0-9a-f]{64}$/);
  assert.notEqual(repository.insertedRecord?.delivery_pin_hash, result.deliveryProof?.pin);
});

test("a database failure is a real failure and never fabricates an order", async () => {
  const repository = new MemoryRepository();
  repository.insertError = { code: "08006", message: "connection failed" };
  await assert.rejects(
    () => createOrder(repository, "firebase-customer-1", createInput(), TEST_DELIVERY_PROOF_SECRET),
    (error: unknown) => error instanceof OrderContractError && error.code === "ORDER_PERSISTENCE_FAILED",
  );
});

test("idempotent retry returns the confirmed database order", async () => {
  const repository = new MemoryRepository();
  const first = await createOrder(repository, "firebase-customer-1", createInput(), TEST_DELIVERY_PROOF_SECRET);
  const retry = await createOrder(repository, "firebase-customer-1", input(), TEST_DELIVERY_PROOF_SECRET);
  assert.equal(first.order.id, retry.order.id);
  assert.equal(retry.replayed, true);
  assert.deepEqual(retry.deliveryProof, first.deliveryProof);
});

test("completed order replay does not regenerate an active delivery proof", async () => {
  const repository = new MemoryRepository();
  const first = await createOrder(repository, "firebase-customer-1", createInput(), TEST_DELIVERY_PROOF_SECRET);
  repository.existing = {
    ...first.order,
    status: "delivered",
    delivery_status: "delivered",
    delivery_pin_hash: null,
    delivery_qr_hash: null,
  };

  const replay = await createOrder(repository, "firebase-customer-1", input());
  assert.equal(replay.replayed, true);
  assert.equal(replay.deliveryProof, undefined);
});

test("reusing an idempotency key for changed intent is rejected", async () => {
  const repository = new MemoryRepository();
  await createOrder(repository, "firebase-customer-1", createInput(), TEST_DELIVERY_PROOF_SECRET);
  const changed = input();
  changed.tip_amount = 5;
  await assert.rejects(
    () => createOrder(repository, "firebase-customer-1", changed, TEST_DELIVERY_PROOF_SECRET),
    (error: unknown) => error instanceof OrderContractError && error.code === "IDEMPOTENCY_CONFLICT",
  );
});

test("delivery checkout fails closed when delivery proof verification is not configured", async () => {
  const repository = new MemoryRepository();
  await assert.rejects(
    () => createOrder(repository, "firebase-customer-1", createInput()),
    (error: unknown) =>
      error instanceof OrderContractError && error.code === "DELIVERY_CONFIRMATION_NOT_CONFIGURED",
  );
  assert.equal(repository.insertedRecord, null);
});

test("merchant ready action starts rider search only after preparation", () => {
  const pending = {
    id: "order-1",
    shop_id: "shop-1",
    user_id: "customer-1",
    rider_id: null,
    status: "pending",
    delivery_status: "none",
    payment_method: "cash",
    price: 25,
    total_price: 37.5,
    delivery_fee: 10,
    service_fee: 2.5,
    discount_amount: 0,
    tip_amount: 0,
    items: [],
    lat: -25.983,
    lng: 28.208,
  } satisfies StoredOrder;
  const preparing = { ...pending, ...lifecycleUpdateFor(pending, "preparing") } as StoredOrder;
  const ready = { ...preparing, ...lifecycleUpdateFor(preparing, "ready_for_pickup") } as StoredOrder;
  const searching = lifecycleUpdateFor(ready, "finding_rider");
  assert.equal(preparing.delivery_status, "none");
  assert.equal(ready.delivery_status, "none");
  assert.equal(searching.delivery_status, "finding_rider");
});
