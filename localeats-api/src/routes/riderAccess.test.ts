import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import express, { type RequestHandler } from "express";
import {
  PairingCodeCollisionError,
  createRiderAccessRouters,
  generateSixDigitPairingCode,
  nextConnectionStatus,
  parseAvailabilityBody,
  parseMerchantDecision,
  parsePairingCodeBody,
  parseRiderProfileBody,
  type RiderAccessRepository,
} from "./riderAccess.js";
import type { AuthenticatedRequest } from "../middleware/authenticateFirebase.js";

type Row = Record<string, unknown>;
const NOW = new Date("2026-09-19T12:00:00.000Z");

class MemoryRepository implements RiderAccessRepository {
  profiles: Row[] = [
    { id: "rider-1", firebase_uid: "rider", full_name: "Ready Rider", name: "Ready Rider", phone: "0712345678", vehicle_type: "Road", verification_status: "approved", is_online: false, status: "offline" },
    { id: "rider-2", firebase_uid: "legacy", full_name: "Legacy Rider", name: "Legacy Rider", phone: "0712345679", vehicle_type: "MTB", verification_status: "pending", is_online: false, status: "offline" },
  ];
  shops: Row[] = [
    { id: "shop-1", name: "Owned Shop", owner_id: "merchant", approval_status: "approved", archived_at: null, is_active: false },
    { id: "shop-2", name: "Other Shop", owner_id: "other-merchant", approval_status: "approved", archived_at: null },
    { id: "shop-pending", name: "Pending Shop", owner_id: "pending-merchant", approval_status: "pending", archived_at: null },
  ];
  codes: Row[] = [
    { id: "code-valid", shop_id: "shop-1", code: "123456", expires_at: "2026-09-20T12:00:00.000Z", revoked_at: null, created_at: "2026-09-19T11:00:00.000Z" },
    { id: "code-expired", shop_id: "shop-1", code: "222222", expires_at: "2026-09-18T12:00:00.000Z", revoked_at: null, created_at: "2026-09-17T11:00:00.000Z" },
    { id: "code-revoked", shop_id: "shop-1", code: "333333", expires_at: "2026-09-20T12:00:00.000Z", revoked_at: "2026-09-19T10:00:00.000Z", created_at: "2026-09-18T11:00:00.000Z" },
  ];
  connections: Row[] = [];
  calls: Array<{ operation: string; input?: Row }> = [];
  collisionCount = 0;

  async findRiderByFirebaseUid(uid: string) { return this.profiles.find((row) => row.firebase_uid === uid) ?? null; }
  async createRider(input: Row) {
    this.calls.push({ operation: "createRider", input });
    const row = { id: `rider-${this.profiles.length + 1}`, ...input };
    this.profiles.push(row); return row;
  }
  async updateRiderProfile(id: string, input: Row) {
    this.calls.push({ operation: "updateRiderProfile", input });
    return this.updateRow(this.profiles, id, input);
  }
  async updateRiderAvailability(id: string, isOnline: boolean) {
    this.calls.push({ operation: "updateRiderAvailability", input: { is_online: isOnline } });
    return this.updateRow(this.profiles, id, { is_online: isOnline, status: isOnline ? "online" : "offline" });
  }
  async listRiderConnections(riderId: string) { return this.connections.filter((row) => row.rider_id === riderId); }
  async findPairingCode(code: string) { return this.codes.find((row) => row.code === code) ?? null; }
  async findShopById(id: string) { return this.shops.find((row) => row.id === id) ?? null; }
  async findConnection(shopId: string, riderId: string) { return this.connections.find((row) => row.shop_id === shopId && row.rider_id === riderId) ?? null; }
  async createConnection(input: Row) {
    this.calls.push({ operation: "createConnection", input });
    const row = { id: `connection-${this.connections.length + 1}`, created_at: NOW.toISOString(), ...input };
    this.connections.push(row); return row;
  }
  async updateConnectionRequest(id: string, code: string) {
    this.calls.push({ operation: "updateConnectionRequest", input: { code } });
    return this.updateRow(this.connections, id, { status: "pending", connection_code: code, expires_at: null });
  }
  async findMerchantShops(uid: string) { return this.shops.filter((row) => row.owner_id === uid && row.archived_at == null); }
  async issuePairingCode(shopId: string, code: string, uid: string, expiresAt: string) {
    this.calls.push({ operation: "issuePairingCode", input: { shop_id: shopId, code, uid, expires_at: expiresAt } });
    if (this.collisionCount > 0) { this.collisionCount -= 1; throw new PairingCodeCollisionError(); }
    const revokedAt = NOW.toISOString();
    this.codes = this.codes.map((row) => row.shop_id === shopId && row.revoked_at == null ? { ...row, revoked_at: revokedAt } : row);
    const row = { id: `code-${code}`, shop_id: shopId, code, expires_at: expiresAt, revoked_at: null, created_at: NOW.toISOString() };
    this.codes.push(row); return row;
  }
  async getCurrentPairingCode(shopId: string, nowIso: string) {
    return this.codes.filter((row) => row.shop_id === shopId && row.revoked_at == null && String(row.expires_at) > nowIso)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0] ?? null;
  }
  async listMerchantConnections(shopId: string) { return this.connections.filter((row) => row.shop_id === shopId); }
  async findRidersByIds(ids: string[]) { return this.profiles.filter((row) => ids.includes(String(row.id))); }
  async findConnectionById(id: string) { return this.connections.find((row) => row.id === id) ?? null; }
  async updateMerchantDecision(id: string, shopId: string, status: "approved" | "rejected") {
    const row = this.connections.find((candidate) => candidate.id === id && candidate.shop_id === shopId);
    if (!row) throw new Error("not found");
    Object.assign(row, { status });
    this.calls.push({ operation: "updateMerchantDecision", input: { id, shop_id: shopId, status } });
    return row;
  }
  private updateRow(rows: Row[], id: string, input: Row) {
    const row = rows.find((candidate) => candidate.id === id);
    if (!row) throw new Error("not found");
    Object.assign(row, input); return row;
  }
}

const fakeAuth: RequestHandler = (request, _response, next) => {
  const req = request as AuthenticatedRequest;
  const header = req.headers["x-test-uid"];
  req.authUser = { uid: typeof header === "string" ? header : "rider", email: null };
  next();
};

async function apiRequest(
  method: string,
  path: string,
  body?: unknown,
  configure?: (repo: MemoryRepository) => void,
  uid?: string,
) {
  const repo = new MemoryRepository();
  configure?.(repo);
  const routers = createRiderAccessRouters(repo, fakeAuth, {
    now: () => new Date(NOW),
    generateCode: () => "000007",
  });
  const app = express();
  app.use(express.json());
  app.use("/api/v1/rider", routers.riderRouter);
  app.use("/api/v1/merchant/riders", routers.merchantRiderRouter);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-test-uid": uid ?? (path.includes("/merchant/") ? "merchant" : "rider"),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json(), repo };
  } finally {
    const closed = once(server, "close"); server.close(); await closed;
  }
}

const profileInput = { full_name: " New Rider ", phone: "071 234 5678", vehicle_type: "Road" };

test("new profile derives Firebase UID and is pilot-approved", async () => {
  const r = await apiRequest("POST", "/api/v1/rider/profile", profileInput, (repo) => { repo.profiles = []; });
  assert.equal(r.status, 201);
  assert.equal(r.repo.calls[0].input?.firebase_uid, "rider");
  assert.equal(r.repo.calls[0].input?.verification_status, "approved");
  assert.equal(r.repo.calls[0].input?.is_online, false);
  assert.equal(r.body.profile.firebase_uid, undefined);
});

for (const field of ["id", "rider_id", "firebase_uid", "verification_status", "is_online", "status", "rating", "total_deliveries", "total_earnings", "active_points", "created_at", "updated_at"]) {
  test(`profile rejects privileged field ${field}`, () => {
    assert.throws(() => parseRiderProfileBody({ ...profileInput, [field]: "forbidden" }), /unsupported fields/);
  });
}

test("existing non-approved rider cannot self-upgrade", async () => {
  const r = await apiRequest("POST", "/api/v1/rider/profile", profileInput, (repo) => {
    repo.profiles = repo.profiles.filter((row) => row.firebase_uid === "legacy");
    repo.profiles[0].firebase_uid = "rider";
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.profile.verification_status, "pending");
  assert.equal(r.repo.calls[0].input?.verification_status, undefined);
});

test("profile GET is self-scoped and missing mapping fails closed", async () => {
  assert.equal((await apiRequest("GET", "/api/v1/rider/profile")).body.profile.id, "rider-1");
  const missing = await apiRequest("GET", "/api/v1/rider/profile", undefined, (repo) => { repo.profiles = []; });
  assert.equal(missing.status, 404); assert.equal(missing.body.code, "RIDER_PROFILE_NOT_FOUND");
});

test("availability accepts only boolean and derives status", async () => {
  assert.equal(parseAvailabilityBody({ is_online: false }), false);
  assert.throws(() => parseAvailabilityBody({ is_online: "true" }));
  assert.throws(() => parseAvailabilityBody({ is_online: true, rider_id: "x" }));
  const online = await apiRequest("PATCH", "/api/v1/rider/availability", { is_online: true });
  assert.equal(online.status, 200); assert.equal(online.body.profile.status, "online");
});

test("non-approved rider cannot change availability", async () => {
  const r = await apiRequest("PATCH", "/api/v1/rider/availability", { is_online: true }, (repo) => {
    repo.profiles[0].verification_status = "pending";
  });
  assert.equal(r.status, 403); assert.equal(r.body.code, "RIDER_NOT_APPROVED");
});

for (const value of ["12345", "1234567", "abcdef", " 12 345 ", 123456]) {
  test(`pairing request rejects malformed code ${String(value)}`, () => {
    assert.throws(() => parsePairingCodeBody({ connection_code: value }));
  });
}

test("expired and revoked codes fail identically", async () => {
  for (const code of ["222222", "333333", "999999"]) {
    const r = await apiRequest("POST", "/api/v1/rider/connections/request", { connection_code: code });
    assert.equal(r.status, 400); assert.equal(r.body.code, "PAIRING_CODE_INVALID");
  }
});

test("valid code creates pending relationship without relationship expiry", async () => {
  const r = await apiRequest("POST", "/api/v1/rider/connections/request", { connection_code: "123456" });
  assert.equal(r.status, 201); assert.equal(r.body.connection.status, "pending");
  assert.equal(r.repo.calls.at(-1)?.input?.status, "pending");
  assert.equal(r.repo.calls.at(-1)?.input?.expires_at, null);
});

test("rider cannot supply shop, rider, or status in pairing request", async () => {
  for (const field of ["shop_id", "rider_id", "status"]) {
    const r = await apiRequest("POST", "/api/v1/rider/connections/request", { connection_code: "123456", [field]: "approved" });
    assert.equal(r.status, 400); assert.equal(r.repo.connections.length, 0);
  }
});

for (const status of ["pending", "approved"] as const) {
  test(`existing ${status} connection is idempotent and unchanged`, async () => {
    const r = await apiRequest("POST", "/api/v1/rider/connections/request", { connection_code: "123456" }, (repo) => {
      repo.connections.push({ id: "connection", shop_id: "shop-1", rider_id: "rider-1", status, created_at: NOW.toISOString() });
    });
    assert.equal(r.status, 200); assert.equal(r.body.connection.status, status);
    assert.equal(r.repo.calls.some((call) => call.operation.includes("Connection")), false);
  });
}

test("rejected connection may request again only to pending", async () => {
  const r = await apiRequest("POST", "/api/v1/rider/connections/request", { connection_code: "123456" }, (repo) => {
    repo.connections.push({ id: "connection", shop_id: "shop-1", rider_id: "rider-1", status: "rejected", created_at: NOW.toISOString() });
  });
  assert.equal(r.body.connection.status, "pending");
  assert.equal(r.repo.connections[0].status, "pending");
});

test("unexpected legacy connection state fails closed", () => {
  assert.throws(() => nextConnectionStatus("active"), /unsupported state/);
});

test("merchant code is six digits and expires in exactly 24 hours", async () => {
  for (let index = 0; index < 100; index += 1) assert.match(generateSixDigitPairingCode(), /^\d{6}$/);
  const r = await apiRequest("POST", "/api/v1/merchant/riders/pairing-code", {});
  assert.equal(r.status, 201); assert.equal(r.body.pairing_code.code, "000007");
  assert.equal(r.body.pairing_code.expires_at, "2026-09-20T12:00:00.000Z");
  assert.equal(r.body.pairing_code.created_by_firebase_uid, undefined);
});

test("pairing code collision retries are bounded", async () => {
  const r = await apiRequest("POST", "/api/v1/merchant/riders/pairing-code", {}, (repo) => { repo.collisionCount = 2; });
  assert.equal(r.status, 201);
  assert.equal(r.repo.calls.filter((call) => call.operation === "issuePairingCode").length, 3);
});

test("merchant connection listing is shop-scoped and safe", async () => {
  const r = await apiRequest("GET", "/api/v1/merchant/riders/connections", undefined, (repo) => {
    repo.connections.push(
      { id: "owned", shop_id: "shop-1", rider_id: "rider-1", status: "pending", created_at: NOW.toISOString() },
      { id: "foreign", shop_id: "shop-2", rider_id: "rider-2", status: "pending", created_at: NOW.toISOString() },
    );
  });
  assert.equal(r.body.connections.length, 1);
  assert.equal(r.body.connections[0].connection.id, "owned");
  assert.equal(JSON.stringify(r.body).includes("firebase_uid"), false);
});

test("merchant cannot decide another shop connection", async () => {
  const r = await apiRequest("PATCH", "/api/v1/merchant/riders/connections/foreign", { decision: "approve" }, (repo) => {
    repo.connections.push({ id: "foreign", shop_id: "shop-2", rider_id: "rider-1", status: "pending" });
  });
  assert.equal(r.status, 404); assert.equal(r.body.code, "RIDER_CONNECTION_NOT_FOUND");
});

test("merchant mutations reject browser-supplied shop authority", async () => {
  const code = await apiRequest("POST", "/api/v1/merchant/riders/pairing-code", { shop_id: "shop-2" });
  assert.equal(code.status, 400);
  assert.equal(code.repo.calls.some((call) => call.operation === "issuePairingCode"), false);
  const decision = await apiRequest("PATCH", "/api/v1/merchant/riders/connections/owned", {
    decision: "approve",
    shop_id: "shop-2",
  });
  assert.equal(decision.status, 400);
});

for (const [decision, status] of [["approve", "approved"], ["reject", "rejected"]] as const) {
  test(`${decision} maps only to ${status}`, async () => {
    assert.equal(parseMerchantDecision({ decision }), decision);
    const r = await apiRequest("PATCH", "/api/v1/merchant/riders/connections/owned", { decision }, (repo) => {
      repo.connections.push({ id: "owned", shop_id: "shop-1", rider_id: "rider-1", status: "pending", created_at: NOW.toISOString() });
    });
    assert.equal(r.status, 200); assert.equal(r.body.connection.status, status);
  });
}

test("unapproved merchant shop cannot issue code or decide", async () => {
  for (const [method, path, body] of [
    ["POST", "/api/v1/merchant/riders/pairing-code", {}],
    ["PATCH", "/api/v1/merchant/riders/connections/owned", { decision: "approve" }],
  ] as const) {
    const response = await apiRequest(method, path, body, (repo) => {
      repo.shops[0].approval_status = "pending";
    });
    assert.equal(response.status, 403);
    assert.equal(response.body.code, "MERCHANT_SHOP_NOT_APPROVED");
  }
});

test("pairing code never grants authority and rider-order approved guard is unchanged", () => {
  const accessSource = readFileSync("src/routes/riderAccess.ts", "utf8");
  const orderSource = readFileSync("src/routes/riderOrders.ts", "utf8");
  assert.doesNotMatch(accessSource.slice(accessSource.indexOf('riderRouter.post("/connections/request"'), accessSource.indexOf('merchantRiderRouter.post')), /status:\s*["']approved["']/);
  assert.match(orderSource, /APPROVED_RIDER_CONNECTION_STATUS = "approved"/);
  assert.match(orderSource, /\.eq\("status", APPROVED_RIDER_CONNECTION_STATUS\)/);
});

test("server mounts new access routers without changing rider order route", () => {
  const source = readFileSync("src/server.ts", "utf8");
  assert.match(source, /app\.use\("\/api\/v1\/rider\/orders", riderOrderRoutes\)/);
  assert.match(source, /app\.use\("\/api\/v1\/rider", riderRouter\)/);
  assert.match(source, /app\.use\("\/api\/v1\/merchant\/riders", merchantRiderRouter\)/);
});

test("staged migration locks pairing authority to service_role", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/20260919000000_rider_onboarding_pairing_authority.sql", import.meta.url), "utf8");
  assert.match(sql, /shop_id text not null references public\.shops\(id\) on delete cascade/i);
  assert.match(sql, /check \(code ~ '\^\[0-9\]\{6\}\$'\)/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all privileges[\s\S]*from public, anon, authenticated, service_role/i);
  assert.match(sql, /grant select, insert, update on table public\.rider_profiles to service_role/i);
  assert.match(sql, /grant select, insert, update on table public\.rider_connections to service_role/i);
  assert.doesNotMatch(sql, /grant[^;]+to (?:anon|authenticated)/i);
});
