import assert from "node:assert/strict";
import test from "node:test";
import express from "express";

import { createMerchantAvailabilityRouter } from "./dist/routes/merchant.js";

const OWNER_ID = "merchant-owner-1";

const makeShop = (approvalStatus, overrides = {}) => ({
  id: `shop-${approvalStatus}`,
  owner_id: OWNER_ID,
  name: "Food war",
  approval_status: approvalStatus,
  archived_at: null,
  is_active: false,
  ...overrides,
});

const authenticated = (req, _res, next) => {
  req.authUser = { uid: OWNER_ID, email: "merchant@example.test" };
  next();
};

const unauthenticated = (_req, res) => {
  res.status(401).json({ success: false, error: "Unauthorized" });
};

const createRepository = (shops, options = {}) => {
  const currentShops = shops.map((shop) => ({ ...shop }));
  const updateCalls = [];

  return {
    updateCalls,
    repository: {
      async findCurrentShops(ownerId) {
        return {
          data: currentShops.filter(
            (shop) => shop.owner_id === ownerId && shop.archived_at === null,
          ),
          error: null,
        };
      },

      async updateAvailability(input) {
        updateCalls.push(input);

        if (options.returnNullOnUpdate) {
          return { data: null, error: null };
        }

        const shopIndex = currentShops.findIndex(
          (shop) =>
            shop.id === input.shopId &&
            shop.owner_id === input.ownerId &&
            shop.archived_at === null,
        );

        if (shopIndex === -1) {
          return { data: null, error: null };
        }

        const authoritativeShop = options.authoritativeShop ?? {
          ...currentShops[shopIndex],
          is_active: input.isActive,
          authoritative_revision: "server-returned",
        };
        currentShops[shopIndex] = authoritativeShop;
        return { data: authoritativeShop, error: null };
      },
    },
  };
};

const withApi = async ({ authenticate = authenticated, repository }, run) => {
  const app = express();
  app.use(express.json());
  app.use(
    "/api/v1/merchant",
    createMerchantAvailabilityRouter({ authenticate, repository }),
  );

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  try {
    const address = server.address();
    assert.notEqual(address, null);
    assert.equal(typeof address, "object");
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
};

const patchAvailability = (baseUrl, body) =>
  fetch(`${baseUrl}/api/v1/merchant/shop/availability`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

test("unauthenticated availability PATCH returns 401", async () => {
  const { repository } = createRepository([makeShop("approved")]);

  await withApi({ authenticate: unauthenticated, repository }, async (baseUrl) => {
    const response = await patchAvailability(baseUrl, { is_active: true });
    assert.equal(response.status, 401);
  });
});

test("owner can activate their approved shop", async () => {
  const { repository, updateCalls } = createRepository([makeShop("approved")]);

  await withApi({ repository }, async (baseUrl) => {
    const response = await patchAvailability(baseUrl, { is_active: true });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.shop.is_active, true);
    assert.deepEqual(updateCalls, [
      { shopId: "shop-approved", ownerId: OWNER_ID, isActive: true },
    ]);
  });
});

test("owner can deactivate their approved shop", async () => {
  const { repository } = createRepository([
    makeShop("approved", { is_active: true }),
  ]);

  await withApi({ repository }, async (baseUrl) => {
    const response = await patchAvailability(baseUrl, { is_active: false });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.shop.is_active, false);
  });
});

test("merchant cannot specify another shop ID", async () => {
  const { repository, updateCalls } = createRepository([makeShop("approved")]);

  await withApi({ repository }, async (baseUrl) => {
    const response = await patchAvailability(baseUrl, {
      is_active: true,
      shop_id: "another-shop",
    });

    assert.equal(response.status, 400);
    assert.equal(updateCalls.length, 0);
  });
});

for (const approvalStatus of ["pending", "rejected", "suspended"]) {
  test(`${approvalStatus} shop cannot be activated`, async () => {
    const { repository, updateCalls } = createRepository([
      makeShop(approvalStatus),
    ]);

    await withApi({ repository }, async (baseUrl) => {
      const response = await patchAvailability(baseUrl, { is_active: true });
      const body = await response.json();

      assert.equal(response.status, 409);
      assert.equal(body.error, "Shop must be approved before going online");
      assert.equal(updateCalls.length, 0);
    });
  });
}

test("no current shop returns 404", async () => {
  const { repository } = createRepository([]);

  await withApi({ repository }, async (baseUrl) => {
    const response = await patchAvailability(baseUrl, { is_active: false });
    assert.equal(response.status, 404);
  });
});

test("multiple current shops return 409", async () => {
  const { repository } = createRepository([
    makeShop("approved", { id: "shop-1" }),
    makeShop("approved", { id: "shop-2" }),
  ]);

  await withApi({ repository }, async (baseUrl) => {
    const response = await patchAvailability(baseUrl, { is_active: false });
    assert.equal(response.status, 409);
  });
});

test("malformed availability body returns 400", async () => {
  const { repository } = createRepository([makeShop("approved")]);

  await withApi({ repository }, async (baseUrl) => {
    const response = await patchAvailability(baseUrl, { is_active: "true" });
    assert.equal(response.status, 400);
  });
});

test("unknown availability fields return 400", async () => {
  const { repository } = createRepository([makeShop("approved")]);

  await withApi({ repository }, async (baseUrl) => {
    const response = await patchAvailability(baseUrl, {
      is_active: false,
      owner_id: "another-owner",
    });
    assert.equal(response.status, 400);
  });
});

test("successful response returns the authoritative updated shop", async () => {
  const authoritativeShop = makeShop("approved", {
    is_active: true,
    authoritative_revision: "database-row",
  });
  const { repository } = createRepository([makeShop("approved")], {
    authoritativeShop,
  });

  await withApi({ repository }, async (baseUrl) => {
    const response = await patchAvailability(baseUrl, { is_active: true });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body.shop, authoritativeShop);
  });
});

test("non-approved shop can still be safely deactivated", async () => {
  const { repository } = createRepository([
    makeShop("suspended", { is_active: true }),
  ]);

  await withApi({ repository }, async (baseUrl) => {
    const response = await patchAvailability(baseUrl, { is_active: false });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.shop.is_active, false);
  });
});

test("concurrent authority change fails closed", async () => {
  const { repository } = createRepository([makeShop("approved")], {
    returnNullOnUpdate: true,
  });

  await withApi({ repository }, async (baseUrl) => {
    const response = await patchAvailability(baseUrl, { is_active: true });
    assert.equal(response.status, 409);
  });
});
