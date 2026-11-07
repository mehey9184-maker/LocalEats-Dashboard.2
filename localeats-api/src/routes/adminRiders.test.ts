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
  reads = 0;
  failRead = false;
  failUpdate = false;
  returnZeroRows = false;
  returnInvalidState = false;

  async list(status: "pending" | "approved" | "rejected" | "suspended" | null, limit: number, offset: number) {
    this.reads++;
    if (this.failRead) throw new Error("database unavailable");
    return this.riders
      .filter((rider) => status === null || rider.verification_status === status)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .slice(offset, offset + limit);
  }
  async findById(riderId: string) {
    this.reads++;
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
  writesEnabled = true,
) {
  const repository = new MemoryRepository();
  configure?.(repository);
  const app = express();
  app.use(express.json());
  app.use("/api/v1/admin/riders", createAdminRiderRouter(repository, fakeAuthenticate, fakeAuthorize, () => writesEnabled));
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

test("pickup-only Rider verification API is disabled before any database reads or writes", async () => {
  const path = `/api/v1/admin/riders/${RIDER_ID}/verification`;
  const requestBody = { verification_status: "approved" };
  const disabled = await apiRequest("PATCH", path, requestBody, undefined, "active-super-admin", false);
  assert.equal(disabled.status, 503);
  assert.equal(disabled.body.success, false);
  assert.equal(disabled.body.code, "RIDER_VERIFICATION_COMING_SOON");
  assert.equal(disabled.headers.get("cache-control"), "no-store");
  assert.equal(disabled.repository.reads, 0);
  assert.equal(disabled.repository.updates.length, 0);

  // Missing Firebase authentication and non-admin callers still fail auth
  // before this feature gate reveals any admin-only information.
  assert.equal((await apiRequest("PATCH", path, requestBody, undefined, null, false)).status, 401);
  assert.equal((await apiRequest("PATCH", path, requestBody, undefined, "ordinary-user", false)).status, 403);

  // Disabled state is a hard gate even if a client submits unexpected fields.
  const invalid = await apiRequest("PATCH", path, { verification_status:"approved", role:"super_admin" }, undefined, "active-super-admin", false);
  assert.equal(invalid.status, 503);
  assert.equal(invalid.repository.reads, 0);
  assert.equal(invalid.repository.updates.length, 0);
});

test("mounted Rider router uses strict default-off server flag", async () => {
  const before = process.env.ADMIN_RIDER_VERIFICATION_WRITES_ENABLED;
  try {
    delete process.env.ADMIN_RIDER_VERIFICATION_WRITES_ENABLED;
    const repository = new MemoryRepository();
    const app=express();
    app.use(express.json());
    app.use("/api/v1/admin/riders",createAdminRiderRouter(repository,fakeAuthenticate,fakeAuthorize));
    const server=app.listen(0,"127.0.0.1");
    await once(server,"listening");
    try {
      const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/admin/riders/${RIDER_ID}/verification`;
      const call = async () => {
        const response=await fetch(url,{method:"PATCH",headers:{"Content-Type":"application/json","x-test-uid":"active-super-admin"},
          body:JSON.stringify({verification_status:"approved"})});
        return {status:response.status,body:await response.json() as {code?:string}};
      };
      assert.deepEqual(await call(),{status:503,body:{success:false,code:"RIDER_VERIFICATION_COMING_SOON",
        error:"Rider verification is not available during the pickup-only pilot."}});
      process.env.ADMIN_RIDER_VERIFICATION_WRITES_ENABLED="TRUE";
      assert.equal((await call()).status,503);
      assert.equal(repository.reads,0);
      assert.equal(repository.updates.length,0);
    }finally{
      const closed=once(server,"close");server.close();await closed;
    }
  }finally{
    if(before===undefined)delete process.env.ADMIN_RIDER_VERIFICATION_WRITES_ENABLED;
    else process.env.ADMIN_RIDER_VERIFICATION_WRITES_ENABLED=before;
  }
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
  assert.match(source, /ADMIN_RIDER_VERIFICATION_WRITES_ENABLED === "true"/);
  assert.match(source, /RIDER_VERIFICATION_COMING_SOON/);
  assert.doesNotMatch(source, /localStorage|mock[_-]?admin|admin_users.*update/i);
});
