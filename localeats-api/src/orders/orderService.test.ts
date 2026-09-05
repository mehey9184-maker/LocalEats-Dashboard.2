import test from "node:test";
import assert from "node:assert/strict";
import { createOrder, lifecycleUpdateFor, type NewOrderRecord, type OrderRepository, type StoredOrder } from "./orderService.js";
import { OrderContractError, parseCreateOrderInput, type MenuItemForOrder, type ShopForOrder } from "./orderContract.js";

const TEST_DELIVERY_PROOF_SECRET = "test-only-delivery-proof-secret-32-chars";

const input = () =>
  parseCreateOrderInput({
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

class MemoryRepository implements OrderRepository {
  existing: StoredOrder | null = null;
  insertError: { code?: string; message: string } | null = null;
  insertedRecord: NewOrderRecord | null = null;
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
    return this.existing;
  }
  async findShop(): Promise<ShopForOrder | null> {
    return this.shop;
  }
  async findMenuItems(): Promise<MenuItemForOrder[]> {
    return this.menu;
  }
  async insertOrder(record: NewOrderRecord) {
    this.insertedRecord = record;
    if (this.insertError) return { order: null, error: this.insertError };
    const order = { id: "order-1", rider_id: null, ...record } as StoredOrder;
    this.existing = order;
    return { order, error: null };
  }
}

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
