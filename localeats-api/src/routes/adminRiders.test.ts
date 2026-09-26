import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import express, { type RequestHandler } from "express";
import {
  createAdminRiderRouter,
  type AdminRiderRepository,
} from "./adminRiders.js";
import adminRouter from "./admin.js";
import type { SuperAdminRequest } from "../middleware/authorizeSuperAdmin.js";

type Row = Record<string, unknown>;
const RIDER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";

class MemoryRepository implements AdminRiderRepository {
  riders: Row[] = [{
    id: RIDER_ID, full_name: "Test Rider", phone: "0712345678", vehicle_type: "Road",
    verification_status: "pending", is_online: false, status: "offline",
    firebase_uid: "private-firebase-uid", internal_note: "private",
  }];
  updates: Row[] = [];
  failRead = false;
  failUpdate = false;
  returnZeroRows = false;
  returnInvalidState = false;

  async list(status: "pending" | "approved" | "rejected" | "suspended" | null, limit: number, offset: number) {
    if (this.failRead) throw new Error("database unavailable");
    return this.riders
      .filter((rider) => status === null || rider.verification_status === status)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .slice(offset, offset + limit);
  }
  async findById(riderId: string) {
    if (this.failRead) throw new Error("database unavailable");
    return this.riders.find((rider) => rider.id === riderId) ?? null;
  }
  async updateVerification(riderId: string, expected: string, target: string) {
    this.updates.push({ riderId, expected, verification_status: target, is_online: false, status: "offline" });
    if (this.failUpdate) throw new Error("database unavailable");
    if (this.returnZeroRows) return null;
    if (this.returnInvalidState) return { id: riderId, verification_status: expected, is_online: true, status: "online" };
    const rider = this.riders.find((row) => row.id === riderId && row.verification_status === expected);
    if (!rider) return null;
    Object.assign(rider, { verification_status: target, is_online: false, status: "offline" });
    return rider;
  }
}

const fakeAuthenticate: RequestHandler = (request, response, next) => {
  const uid = request.headers["x-test-uid"];
  if (typeof uid !== "string") {
    response.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }
  (request as SuperAdminRequest).authUser = { uid, email: null };
  next();
};
const fakeAuthorize: RequestHandler = (request, response, next) => {
  const req = request as SuperAdminRequest;
  if (req.authUser?.uid !== "active-super-admin") {
    response.status(403).json({ success: false, error: "Forbidden" });
    return;
  }
  req.adminUser = { firebase_uid: req.authUser.uid, role: "super_admin" };
  next();
};

async function apiRequest(
  method: string,
  path: string,
  body?: unknown,
  configure?: (repository: MemoryRepository) => void,
  uid: string | null = "active-super-admin",
) {
  const repository = new MemoryRepository();
  configure?.(repository);
  const app = express();
  app.use(express.json());
  app.use("/api/v1/admin/riders", createAdminRiderRouter(repository, fakeAuthenticate, fakeAuthorize));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(uid === null ? {} : { "x-test-uid": uid }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json(), repository, headers: response.headers };
  } finally {
    const closed = once(server, "close"); server.close(); await closed;
  }
}

test("Rider admin routes require authentication and active super-admin authorization", async () => {
  const path = "/api/v1/admin/riders";
  assert.equal((await apiRequest("GET", path, undefined, undefined, null)).status, 401);
  assert.equal((await apiRequest("GET", path, undefined, undefined, "ordinary-user")).status, 403);
  assert.equal((await apiRequest("GET", path)).status, 200);
});

test("mounted production admin Rider route rejects a missing Firebase bearer token", async () => {
  const app = express();
  app.use("/api/v1/admin", adminRouter);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/admin/riders`);
    assert.equal(response.status, 401);
  } finally {
    const closed = once(server, "close"); server.close(); await closed;
  }
});

test("Rider list validates filters and returns only allowlisted fields", async () => {
  for (const status of ["pending", "approved", "rejected", "suspended"]) {
    const result = await apiRequest("GET", `/api/v1/admin/riders?verification_status=${status}`, undefined, (repo) => {
      repo.riders[0].verification_status = status;
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.riders.length, 1);
    assert.deepEqual(Object.keys(result.body.riders[0]), [
      "id", "full_name", "phone", "vehicle_type", "verification_status", "is_online", "status",
    ]);
    assert.equal(JSON.stringify(result.body).includes("firebase_uid"), false);
    assert.equal(JSON.stringify(result.body).includes("internal_note"), false);
    assert.equal(result.headers.get("cache-control"), "no-store");
  }
  for (const invalid of ["verified", "all", "invalid"]) {
    assert.equal((await apiRequest("GET", `/api/v1/admin/riders?verification_status=${invalid}`)).status, 400);
  }
});

test("Rider list uses bounded deterministic pagination", async () => {
  const result = await apiRequest("GET", "/api/v1/admin/riders?limit=1&offset=1", undefined, (repo) => {
    repo.riders.push({ ...repo.riders[0], id: OTHER_ID });
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.riders[0].id, OTHER_ID);
  assert.deepEqual(result.body.pagination, { limit: 1, offset: 1, returned: 1 });
  for (const query of ["limit=0", "limit=51", "limit=-1", "offset=-1", "offset=abc"]) {
    assert.equal((await apiRequest("GET", `/api/v1/admin/riders?${query}`)).status, 400);
  }
});

test("Rider detail validates UUID, returns one safe Rider, or 404", async () => {
  const found = await apiRequest("GET", `/api/v1/admin/riders/${RIDER_ID}`);
  assert.equal(found.status, 200);
  assert.equal(found.body.rider.id, RIDER_ID);
  assert.equal(found.body.rider.firebase_uid, undefined);
  assert.equal((await apiRequest("GET", `/api/v1/admin/riders/${OTHER_ID}`)).status, 404);
  assert.equal((await apiRequest("GET", "/api/v1/admin/riders/not-a-uuid")).status, 400);
});

for (const [source, target] of [
  ["pending", "approved"], ["pending", "rejected"], ["rejected", "pending"],
  ["suspended", "approved"],
] as const) {
  test(`${source} -> ${target} is one offline verification update`, async () => {
    const result = await apiRequest("PATCH", `/api/v1/admin/riders/${RIDER_ID}/verification`,
      { verification_status: target }, (repo) => {
        repo.riders[0].verification_status = source;
        repo.riders[0].is_online = false;
        repo.riders[0].status = "offline";
      });
    assert.equal(result.status, 200);
    assert.equal(result.body.rider.verification_status, target);
    assert.equal(result.body.rider.is_online, false);
    assert.equal(result.body.rider.status, "offline");
    assert.equal(result.repository.updates.length, 1);
    assert.deepEqual(result.repository.updates[0], {
      riderId: RIDER_ID, expected: source, verification_status: target, is_online: false, status: "offline",
    });
  });
}

test("all approved-Rider demotions fail closed without a non-atomic order read", async () => {
  for (const target of ["pending", "rejected", "suspended"]) {
    const result = await apiRequest("PATCH", `/api/v1/admin/riders/${RIDER_ID}/verification`,
      { verification_status: target }, (repo) => {
        repo.riders[0].verification_status = "approved";
        repo.riders[0].is_online = true;
        repo.riders[0].status = "online";
      });
    assert.equal(result.status, 409);
    assert.equal(result.body.code, "RIDER_DEMOTION_REQUIRES_ATOMIC_GUARD");
    assert.equal(result.repository.updates.length, 0);
    assert.equal(result.repository.riders[0].verification_status, "approved");
  }
});

test("verification body rejects Rider-controlled fields and unknown states", async () => {
  for (const extra of ["is_online", "status", "firebase_uid"]) {
    const result = await apiRequest("PATCH", `/api/v1/admin/riders/${RIDER_ID}/verification`, {
      verification_status: "approved", [extra]: "untrusted",
    });
    assert.equal(result.status, 400);
    assert.equal(result.repository.updates.length, 0);
  }
  assert.equal((await apiRequest("PATCH", `/api/v1/admin/riders/${RIDER_ID}/verification`,
    { verification_status: "verified" })).status, 400);
  assert.equal((await apiRequest("PATCH", `/api/v1/admin/riders/${RIDER_ID}/verification`,
    { verification_status: "unknown" })).status, 400);
});

test("missing Rider, database failure, and zero-row CAS never succeed", async () => {
  assert.equal((await apiRequest("PATCH", `/api/v1/admin/riders/${OTHER_ID}/verification`,
    { verification_status: "approved" })).status, 404);
  assert.equal((await apiRequest("GET", "/api/v1/admin/riders", undefined,
    (repo) => { repo.failRead = true; })).status, 500);
  assert.equal((await apiRequest("PATCH", `/api/v1/admin/riders/${RIDER_ID}/verification`,
    { verification_status: "approved" }, (repo) => { repo.failUpdate = true; })).status, 500);
  const zero = await apiRequest("PATCH", `/api/v1/admin/riders/${RIDER_ID}/verification`,
    { verification_status: "approved" }, (repo) => { repo.returnZeroRows = true; });
  assert.equal(zero.status, 409);
  assert.equal(zero.body.success, false);
  const invalid = await apiRequest("PATCH", `/api/v1/admin/riders/${RIDER_ID}/verification`,
    { verification_status: "approved" }, (repo) => { repo.returnInvalidState = true; });
  assert.equal(invalid.status, 500);
  assert.equal(invalid.body.success, false);
});

test("production router uses existing admin middleware and one conditional Rider update", () => {
  const source = readFileSync("src/routes/adminRiders.ts", "utf8");
  const adminSource = readFileSync("src/routes/admin.ts", "utf8");
  assert.match(source, /router\.use\(authenticate, authorize\)/);
  assert.match(source, /authenticateAdminFirebase/);
  assert.match(source, /authorizeSuperAdmin/);
  assert.match(source, /\.update\(\{ verification_status: target, is_online: false, status: "offline" \}\)/);
  assert.match(source, /\.eq\("verification_status", expected\)/);
  assert.match(adminSource, /router\.use\("\/riders", adminRiderRouter\)/);
  assert.doesNotMatch(source, /localStorage|mock[_-]?admin|admin_users.*update/i);
});
