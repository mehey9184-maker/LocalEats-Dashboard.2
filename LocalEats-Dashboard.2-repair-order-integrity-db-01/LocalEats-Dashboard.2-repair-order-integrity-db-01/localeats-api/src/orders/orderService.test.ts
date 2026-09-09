import test from "node:test";
import assert from "node:assert/strict";
import {
  createOrder,
  lifecycleUpdateFor,
  quoteOrder,
  type NewOrderRecord,
  type OrderRepository,
  type StoredOrder,
} from "./orderService.js";
import { OrderContractError, parseCreateOrderInput, type MenuItemForOrder, type ShopForOrder } from "./orderContract.js";

const TEST_DELIVERY_PROOF_SECRET = "test-only-delivery-proof-secret-32-chars";

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
  const quote = await quoteOrder(repository, "firebase-customer-1", input());

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
  const request = parseCreateOrderInput({
    ...validRequest(),
    subtotal: 0.01,
    total_price: 0.01,
  });
  const quote = await quoteOrder(repository, "firebase-customer-1", request);
  assert.equal(quote.subtotal, 50);
  assert.equal(quote.total_price, 62.5);
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

test("quote rejects inactive and unapproved shops", async () => {
  const inactive = new MemoryRepository();
  inactive.shop.is_active = false;
  await assert.rejects(
    () => quoteOrder(inactive, "firebase-customer-1", input()),
    (error: unknown) => error instanceof OrderContractError && error.code === "SHOP_UNAVAILABLE",
  );

  const unapproved = new MemoryRepository();
  unapproved.shop.approval_status = "pending";
  await assert.rejects(
    () => quoteOrder(unapproved, "firebase-customer-1", input()),
    (error: unknown) => error instanceof OrderContractError && error.code === "SHOP_UNAVAILABLE",
  );
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
  const created = await createOrder(repository, "firebase-customer-1", request, TEST_DELIVERY_PROOF_SECRET);

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
  const result = await createOrder(repository, "firebase-customer-1", input(), TEST_DELIVERY_PROOF_SECRET);
  assert.equal(result.replayed, false);
  assert.equal(result.order.status, "pending");
  assert.equal(result.order.delivery_status, "none");
  assert.equal(result.order.payment_method, "cash_on_arrival");
  assert.equal(repository.insertedRecord?.user_id, "firebase-customer-1");
  assert.match(result.deliveryProof?.pin ?? "", /^\d{4}$/);
  assert.match(result.deliveryProof?.qr_token ?? "", /^le_[0-9a-f]{64}$/);
  assert.notEqual(repository.insertedRecord?.delivery_pin_hash, result.deliveryProof?.pin);
});

test("a database failure is a real failure and never fabricates an order", async () => {
  const repository = new MemoryRepository();
  repository.insertError = { code: "08006", message: "connection failed" };
  await assert.rejects(
    () => createOrder(repository, "firebase-customer-1", input(), TEST_DELIVERY_PROOF_SECRET),
    (error: unknown) => error instanceof OrderContractError && error.code === "ORDER_PERSISTENCE_FAILED",
  );
});

test("idempotent retry returns the confirmed database order", async () => {
  const repository = new MemoryRepository();
  const first = await createOrder(repository, "firebase-customer-1", input(), TEST_DELIVERY_PROOF_SECRET);
  const retry = await createOrder(repository, "firebase-customer-1", input(), TEST_DELIVERY_PROOF_SECRET);
  assert.equal(first.order.id, retry.order.id);
  assert.equal(retry.replayed, true);
  assert.deepEqual(retry.deliveryProof, first.deliveryProof);
});

test("completed order replay does not regenerate an active delivery proof", async () => {
  const repository = new MemoryRepository();
  const first = await createOrder(repository, "firebase-customer-1", input(), TEST_DELIVERY_PROOF_SECRET);
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
  await createOrder(repository, "firebase-customer-1", input(), TEST_DELIVERY_PROOF_SECRET);
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
    () => createOrder(repository, "firebase-customer-1", input()),
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
