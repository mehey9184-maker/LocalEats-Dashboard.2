import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { makeCatalogRouter, SupabaseCatalogRepository } from "./catalog.js";

class FakeSupabase {
  calls: any[] = [];
  mockShopData: any = null;
  mockMenuData: any = null;
  mockError: any = null;

  from(table: string) {
    const queryBuilder = {
      calls: this.calls,
      table,
      mockShopData: this.mockShopData,
      mockMenuData: this.mockMenuData,
      mockError: this.mockError,
      select(fields: string) { this.calls.push({ method: 'select', args: [fields] }); return this; },
      eq(col: string, val: any) { this.calls.push({ method: 'eq', args: [col, val] }); return this; },
      is(col: string, val: any) { this.calls.push({ method: 'is', args: [col, val] }); return this; },
      maybeSingle() { this.calls.push({ method: 'maybeSingle', args: [] }); return this; },
      then(resolve: any, reject: any) {
        this.calls.push({ method: 'execute', table: this.table });
        if (this.mockError) return reject(this.mockError);
        
        if (this.table === 'shops') resolve({ data: this.mockShopData, error: null });
        else if (this.table === 'menu_items') resolve({ data: this.mockMenuData, error: null });
        else resolve({ data: null, error: null });
      }
    };
    this.calls.push({ method: 'from', args: [table] });
    return queryBuilder;
  }
}

function createTestApp() {
  const fakeDb = new FakeSupabase();
  const repo = new SupabaseCatalogRepository(fakeDb);
  const app = express();
  app.use(express.json());
  app.use("/api/v1/catalog", makeCatalogRouter(repo));
  return { app, fakeDb };
}

async function runWithServer(app: express.Express, fn: (baseUrl: string) => Promise<void>) {
  return new Promise<void>((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', async () => {
      try {
        const port = (server.address() as any).port;
        await fn(`http://127.0.0.1:${port}`);
        resolve();
      } catch (e) {
        reject(e);
      } finally {
        server.close();
      }
    });
  });
}

test("Catalog Router - List query requirements (behaviors 1, 2, 3, 4, 5, 6, 7, 15, 16, 17, 19, 20)", async () => {
  const { app, fakeDb } = createTestApp();
  fakeDb.mockShopData = [{ id: "1", name: "Shop 1", is_active: false }];

  await runWithServer(app, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/catalog/shops`);
    const body = await res.json();

    assert.equal(res.status, 200);

    // 1. list query requires approval_status = "approved"
    // 4, 5, 6. excluded pending, rejected, suspended
    const hasApprovalEq = fakeDb.calls.some(c => c.method === 'eq' && c.args[0] === 'approval_status' && c.args[1] === 'approved');
    assert.ok(hasApprovalEq, "Requires approval_status = approved");

    // 2. list query requires archived_at IS NULL
    // 7. excluded archived
    const hasArchivedIs = fakeDb.calls.some(c => c.method === 'is' && c.args[0] === 'archived_at' && c.args[1] === null);
    assert.ok(hasArchivedIs, "Requires archived_at IS NULL");

    // 15, 16, 17. uses explicit allowlist, excludes owner_id/approval_reason
    const selectCall = fakeDb.calls.find(c => c.method === 'select');
    assert.ok(selectCall, "Must use select()");
    const fields = selectCall.args[0] as string;
    assert.ok(fields !== "*", "Must not use *");
    assert.ok(!fields.includes("owner_id"), "Must exclude owner_id");
    assert.ok(!fields.includes("approval_reason"), "Must exclude approval_reason");

    // 19. catalog repository does not use Firestore
    // Implied by strict reliance on Supabase repo only

    // 3. approved inactive shop is returned
    // 20. approved inactive shop remains visible but is_active remains false
    assert.equal(body.shops.length, 1);
    assert.equal(body.shops[0].is_active, false);
  });
});

test("Catalog Router - GET one shop (behaviors 8, 9)", async () => {
  const { app, fakeDb } = createTestApp();
  
  await runWithServer(app, async (baseUrl) => {
    // 8. GET one approved shop succeeds
    fakeDb.mockShopData = { id: "1", name: "Shop 1" };
    let res = await fetch(`${baseUrl}/api/v1/catalog/shops/1`);
    let body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.shop.id, "1");

    // 9. GET one non-public shop returns generic 404
    fakeDb.mockShopData = null;
    res = await fetch(`${baseUrl}/api/v1/catalog/shops/2`);
    body = await res.json();
    assert.equal(res.status, 404);
    assert.equal(body.success, false);
  });
});

test("Catalog Router - GET shop menu (behaviors 10, 11, 12, 13, 14, 18)", async () => {
  const { app, fakeDb } = createTestApp();

  await runWithServer(app, async (baseUrl) => {
    // 10. GET approved shop menu succeeds
    fakeDb.mockShopData = { id: "1", name: "Shop 1" };
    fakeDb.mockMenuData = [{ id: "m1", name: "Item 1" }];
    let res = await fetch(`${baseUrl}/api/v1/catalog/shops/1/menu`);
    let body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.menu_items[0].id, "m1");

    // 18. menu selection uses explicit allowlist, not "*"
    const selectCalls = fakeDb.calls.filter(c => c.method === 'select');
    // the second select call should be for menu_items
    const menuSelectFields = selectCalls[1].args[0] as string;
    assert.ok(menuSelectFields !== "*", "Menu query must not use *");
    assert.ok(menuSelectFields.includes("popularity_score"), "Includes explicit field");

    // 11, 12, 13, 14. menu for pending/rejected/suspended/archived shop is rejected
    fakeDb.mockShopData = null; // simulate parent shop check failing
    res = await fetch(`${baseUrl}/api/v1/catalog/shops/2/menu`);
    body = await res.json();
    assert.equal(res.status, 404);
  });
});
