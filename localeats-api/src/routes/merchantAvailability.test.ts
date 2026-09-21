import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express, { type RequestHandler } from "express";
import {
  createMerchantAvailabilityRouter,
  type MerchantAvailabilityRepository,
} from "./merchant.js";
import {
  authenticateFirebase,
  type AuthenticatedRequest,
} from "../middleware/authenticateFirebase.js";

type Shop = Record<string, unknown> & {
  id: string | number;
  owner_id: string;
  approval_status: string;
  archived_at: string | null;
  is_active: boolean;
};

const OWNER_ID = "merchant-owner-1";

const makeShop = (overrides: Partial<Shop> = {}): Shop => ({
  id: "owned-shop",
  owner_id: OWNER_ID,
  approval_status: "approved",
  archived_at: null,
  is_active: false,
  name: "LocalEats Shop",
  ...overrides,
});

const authenticated: RequestHandler = (req: AuthenticatedRequest, _res, next) => {
  req.authUser = { uid: OWNER_ID, email: "merchant@example.test" };
  next();
};

const createRepository = (
  shops: Shop[],
  authoritativeShop?: Shop,
): {
  repository: MerchantAvailabilityRepository;
  lookupCalls: string[];
  updateCalls: Array<{ shopId: string | number; ownerId: string; isActive: boolean }>;
} => {
  const currentShops = shops.map((shop) => ({ ...shop }));
  const lookupCalls: string[] = [];
  const updateCalls: Array<{ shopId: string | number; ownerId: string; isActive: boolean }> = [];

  return {
    lookupCalls,
    updateCalls,
    repository: {
      async findCurrentShops(ownerId) {
        lookupCalls.push(ownerId);
        return {
          data: currentShops.filter(
            (shop) => shop.owner_id === ownerId && shop.archived_at === null,
          ),
          error: null,
        };
      },
      async updateAvailability(input) {
        updateCalls.push(input);
        const shop = currentShops.find(
          (candidate) =>
            candidate.id === input.shopId &&
            candidate.owner_id === input.ownerId &&
            candidate.archived_at === null &&
            (!input.isActive || candidate.approval_status === "approved"),
        );
        if (!shop) return { data: null, error: null };
        return {
          data: authoritativeShop ?? { ...shop, is_active: input.isActive },
          error: null,
        };
      },
    },
  };
};

const request = async (
  repository: MerchantAvailabilityRepository,
  body: unknown,
  authenticate: RequestHandler = authenticated,
) => {
  const app = express();
  app.use(express.json());
  app.use(
    "/api/v1/merchant",
    createMerchantAvailabilityRouter({ authenticate, repository }),
  );
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address() as AddressInfo;
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/v1/merchant/shop/availability`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  } finally {
    const closed = once(server, "close");
    server.close();
    await closed;
  }
};

test("unauthenticated availability request is rejected before database access", async () => {
  const fixture = createRepository([makeShop()]);
  const result = await request(fixture.repository, { is_active: true }, authenticateFirebase);
  assert.equal(result.status, 401);
  assert.deepEqual(fixture.lookupCalls, []);
  assert.deepEqual(fixture.updateCalls, []);
});

test("merchant can update only the shop resolved from their Firebase UID", async () => {
  const fixture = createRepository([
    makeShop(),
    makeShop({ id: "foreign-shop", owner_id: "another-merchant" }),
  ]);
  const result = await request(fixture.repository, { is_active: true });
  assert.equal(result.status, 200);
  assert.deepEqual(fixture.lookupCalls, [OWNER_ID]);
  assert.deepEqual(fixture.updateCalls, [
    { shopId: "owned-shop", ownerId: OWNER_ID, isActive: true },
  ]);
});

test("client shop ID authority is rejected", async () => {
  const fixture = createRepository([makeShop()]);
  const result = await request(fixture.repository, {
    is_active: true,
    shop_id: "foreign-shop",
  });
  assert.equal(result.status, 400);
  assert.deepEqual(fixture.lookupCalls, []);
  assert.deepEqual(fixture.updateCalls, []);
});

test("merchant cannot mutate another merchant's shop", async () => {
  const fixture = createRepository([
    makeShop({ id: "foreign-shop", owner_id: "another-merchant" }),
  ]);
  const result = await request(fixture.repository, { is_active: true });
  assert.equal(result.status, 404);
  assert.deepEqual(fixture.updateCalls, []);
});

for (const invalidValue of ["true", 1, null, undefined]) {
  test(`invalid is_active value ${String(invalidValue)} is rejected`, async () => {
    const fixture = createRepository([makeShop()]);
    const result = await request(fixture.repository, { is_active: invalidValue });
    assert.equal(result.status, 400);
    assert.deepEqual(fixture.updateCalls, []);
  });
}

test("successful response returns the authoritative updated shop", async () => {
  const authoritativeShop = makeShop({
    is_active: true,
    name: "Authoritative database row",
  });
  const fixture = createRepository([makeShop()], authoritativeShop);
  const result = await request(fixture.repository, { is_active: true });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { success: true, shop: authoritativeShop });
});

for (const approvalStatus of ["pending", "rejected", "suspended"]) {
  test(`${approvalStatus} shop cannot be activated`, async () => {
    const fixture = createRepository([makeShop({ approval_status: approvalStatus })]);
    const result = await request(fixture.repository, { is_active: true });
    assert.equal(result.status, 409);
    assert.deepEqual(fixture.updateCalls, []);
  });
}

test("non-approved shop may still be safely deactivated", async () => {
  const fixture = createRepository([
    makeShop({ approval_status: "suspended", is_active: true }),
  ]);
  const result = await request(fixture.repository, { is_active: false });
  assert.equal(result.status, 200);
  assert.deepEqual(fixture.updateCalls, [
    { shopId: "owned-shop", ownerId: OWNER_ID, isActive: false },
  ]);
});
