import { randomInt } from "node:crypto";
import { Router, type RequestHandler, type Response } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import {
  authenticateFirebase,
  type AuthenticatedRequest,
} from "../middleware/authenticateFirebase.js";

type Row = Record<string, unknown>;

export const RIDER_VEHICLE_TYPES = ["Road", "MTB", "E-Bike", "Motor"] as const;
export type RiderVehicleType = (typeof RIDER_VEHICLE_TYPES)[number];

const PROFILE_FIELDS = [
  "id", "full_name", "phone", "vehicle_type", "verification_status", "is_online", "status",
] as const;

export class RiderAccessError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RiderAccessError";
  }
}

export class PairingCodeCollisionError extends Error {}

const databaseError = (message: string): RiderAccessError =>
  new RiderAccessError(503, "DATABASE_UNAVAILABLE", message);

const isRecord = (value: unknown): value is Row =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const assertExactFields = (body: unknown, allowed: readonly string[]): Row => {
  if (!isRecord(body)) {
    throw new RiderAccessError(400, "INVALID_REQUEST", "Invalid request body.");
  }
  if (Object.keys(body).some((field) => !allowed.includes(field))) {
    throw new RiderAccessError(400, "INVALID_REQUEST", "Request contains unsupported fields.");
  }
  return body;
};

const requiredTrimmedString = (
  value: unknown,
  label: string,
  minLength: number,
  maxLength: number,
): string => {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (normalized.length < minLength || normalized.length > maxLength) {
    throw new RiderAccessError(400, "INVALID_REQUEST", `Invalid ${label}.`);
  }
  return normalized;
};

export interface RiderProfileInput {
  full_name: string;
  phone: string;
  vehicle_type: RiderVehicleType;
}

export const parseRiderProfileBody = (body: unknown): RiderProfileInput => {
  const value = assertExactFields(body, ["full_name", "phone", "vehicle_type"]);
  const fullName = requiredTrimmedString(value.full_name, "full_name", 2, 100);
  const phone = requiredTrimmedString(value.phone, "phone", 8, 20);
  if (!/^\+?[0-9][0-9\s()-]{7,19}$/.test(phone)) {
    throw new RiderAccessError(400, "INVALID_REQUEST", "Invalid phone.");
  }
  if (typeof value.vehicle_type !== "string" ||
      !(RIDER_VEHICLE_TYPES as readonly string[]).includes(value.vehicle_type)) {
    throw new RiderAccessError(400, "INVALID_REQUEST", "Invalid vehicle_type.");
  }
  return { full_name: fullName, phone, vehicle_type: value.vehicle_type as RiderVehicleType };
};

export const parseAvailabilityBody = (body: unknown): boolean => {
  const value = assertExactFields(body, ["is_online"]);
  if (typeof value.is_online !== "boolean") {
    throw new RiderAccessError(400, "INVALID_REQUEST", "is_online must be a boolean.");
  }
  return value.is_online;
};

export const parsePairingCodeBody = (body: unknown): string => {
  const value = assertExactFields(body, ["connection_code"]);
  const code = typeof value.connection_code === "string" ? value.connection_code.trim() : "";
  if (!/^\d{6}$/.test(code)) {
    throw new RiderAccessError(400, "PAIRING_CODE_INVALID", "Pairing code is invalid.");
  }
  return code;
};

export type MerchantDecision = "approve" | "reject";
export const parseMerchantDecision = (body: unknown): MerchantDecision => {
  const value = assertExactFields(body, ["decision"]);
  if (value.decision !== "approve" && value.decision !== "reject") {
    throw new RiderAccessError(400, "INVALID_REQUEST", "Decision must be approve or reject.");
  }
  return value.decision;
};

export const nextConnectionStatus = (
  existingStatus: unknown,
): "pending" | "approved" => {
  if (existingStatus === undefined || existingStatus === null || existingStatus === "rejected") return "pending";
  if (existingStatus === "pending") return "pending";
  if (existingStatus === "approved") return "approved";
  throw new RiderAccessError(
    409,
    "INVALID_RIDER_CONNECTION_STATE",
    "Rider connection is in an unsupported state.",
  );
};

export const generateSixDigitPairingCode = (): string =>
  randomInt(0, 1_000_000).toString().padStart(6, "0");

export const isUsablePairingCode = (row: Row | null, now: Date): row is Row =>
  Boolean(
    row &&
    row.revoked_at == null &&
    typeof row.expires_at === "string" &&
    Number.isFinite(Date.parse(row.expires_at)) &&
    Date.parse(row.expires_at) > now.getTime(),
  );

export interface RiderAccessRepository {
  findRiderByFirebaseUid(firebaseUid: string): Promise<Row | null>;
  createRider(input: Row): Promise<Row>;
  updateRiderProfile(riderId: string, input: Row): Promise<Row>;
  updateRiderAvailability(riderId: string, isOnline: boolean): Promise<Row>;
  listRiderConnections(riderId: string): Promise<Row[]>;
  findPairingCode(code: string): Promise<Row | null>;
  findShopById(shopId: string): Promise<Row | null>;
  findConnection(shopId: string, riderId: string): Promise<Row | null>;
  createConnection(input: Row): Promise<Row>;
  updateConnectionRequest(connectionId: string, code: string): Promise<Row>;
  findMerchantShops(firebaseUid: string): Promise<Row[]>;
  issuePairingCode(shopId: string, code: string, firebaseUid: string, expiresAt: string): Promise<Row>;
  getCurrentPairingCode(shopId: string, nowIso: string): Promise<Row | null>;
  listMerchantConnections(shopId: string): Promise<Row[]>;
  findRidersByIds(riderIds: string[]): Promise<Row[]>;
  findConnectionById(connectionId: string): Promise<Row | null>;
  updateMerchantDecision(connectionId: string, shopId: string, status: "approved" | "rejected"): Promise<Row>;
}

const ensureData = <T>(data: T | null, error: { message?: string } | null, message: string): T => {
  if (error || data === null) throw databaseError(message);
  return data;
};

export const supabaseRiderAccessRepository: RiderAccessRepository = {
  async findRiderByFirebaseUid(firebaseUid) {
    const { data, error } = await supabaseAdmin.from("rider_profiles")
      .select(PROFILE_FIELDS.join(","))
      .eq("firebase_uid", firebaseUid).maybeSingle();
    if (error) throw databaseError("Rider profile could not be loaded.");
    return data as Row | null;
  },
  async createRider(input) {
    const { data, error } = await supabaseAdmin.from("rider_profiles")
      .insert(input).select(PROFILE_FIELDS.join(",")).single();
    return ensureData(data as Row | null, error, "Rider profile could not be created.");
  },
  async updateRiderProfile(riderId, input) {
    const { data, error } = await supabaseAdmin.from("rider_profiles")
      .update(input).eq("id", riderId).select(PROFILE_FIELDS.join(",")).maybeSingle();
    return ensureData(data as Row | null, error, "Rider profile could not be updated.");
  },
  async updateRiderAvailability(riderId, isOnline) {
    const { data, error } = await supabaseAdmin.from("rider_profiles")
      .update({ is_online: isOnline, status: isOnline ? "online" : "offline" })
      .eq("id", riderId).select(PROFILE_FIELDS.join(",")).maybeSingle();
    return ensureData(data as Row | null, error, "Rider availability could not be updated.");
  },
  async listRiderConnections(riderId) {
    const { data, error } = await supabaseAdmin.from("rider_connections")
      .select("id,shop_id,rider_id,status,created_at")
      .eq("rider_id", riderId).order("created_at", { ascending: false });
    if (error) throw databaseError("Rider connections could not be loaded.");
    return (data ?? []) as Row[];
  },
  async findPairingCode(code) {
    const { data, error } = await supabaseAdmin.from("rider_pairing_codes")
      .select("id,shop_id,code,expires_at,revoked_at")
      .eq("code", code).maybeSingle();
    if (error) throw databaseError("Pairing code could not be checked.");
    return data as Row | null;
  },
  async findShopById(shopId) {
    const { data, error } = await supabaseAdmin.from("shops")
      .select("id,name,approval_status,archived_at")
      .eq("id", shopId).maybeSingle();
    if (error) throw databaseError("Shop could not be checked.");
    return data as Row | null;
  },
  async findConnection(shopId, riderId) {
    const { data, error } = await supabaseAdmin.from("rider_connections")
      .select("id,shop_id,rider_id,status,created_at")
      .eq("shop_id", shopId).eq("rider_id", riderId).maybeSingle();
    if (error) throw databaseError("Rider connection could not be checked.");
    return data as Row | null;
  },
  async createConnection(input) {
    const { data, error } = await supabaseAdmin.from("rider_connections")
      .insert(input).select("id,shop_id,rider_id,status,created_at").single();
    return ensureData(data as Row | null, error, "Rider connection could not be created.");
  },
  async updateConnectionRequest(connectionId, code) {
    const { data, error } = await supabaseAdmin.from("rider_connections")
      .update({ status: "pending", connection_code: code, expires_at: null })
      .eq("id", connectionId).eq("status", "rejected")
      .select("id,shop_id,rider_id,status,created_at").maybeSingle();
    return ensureData(data as Row | null, error, "Rider connection could not be requested.");
  },
  async findMerchantShops(firebaseUid) {
    const { data, error } = await supabaseAdmin.from("shops")
      .select("id,name,approval_status,archived_at")
      .eq("owner_id", firebaseUid).is("archived_at", null);
    if (error) throw databaseError("Merchant shop could not be loaded.");
    return (data ?? []) as Row[];
  },
  async issuePairingCode(shopId, code, firebaseUid, expiresAt) {
    const { data, error } = await supabaseAdmin.rpc("issue_rider_pairing_code", {
      p_shop_id: shopId,
      p_code: code,
      p_created_by_firebase_uid: firebaseUid,
      p_expires_at: expiresAt,
    });
    if (error?.code === "23505") throw new PairingCodeCollisionError();
    if (error) throw databaseError("Pairing code could not be issued.");
    const row = Array.isArray(data) ? data[0] : data;
    return ensureData(row as Row | null, null, "Pairing code could not be issued.");
  },
  async getCurrentPairingCode(shopId, nowIso) {
    const { data, error } = await supabaseAdmin.from("rider_pairing_codes")
      .select("id,shop_id,code,expires_at,revoked_at,created_at")
      .eq("shop_id", shopId).is("revoked_at", null).gt("expires_at", nowIso)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw databaseError("Pairing code could not be loaded.");
    return data as Row | null;
  },
  async listMerchantConnections(shopId) {
    const { data, error } = await supabaseAdmin.from("rider_connections")
      .select("id,shop_id,rider_id,status,created_at")
      .eq("shop_id", shopId).order("created_at", { ascending: false });
    if (error) throw databaseError("Rider connections could not be loaded.");
    return (data ?? []) as Row[];
  },
  async findRidersByIds(riderIds) {
    if (riderIds.length === 0) return [];
    const { data, error } = await supabaseAdmin.from("rider_profiles")
      .select("id,full_name,name,phone,vehicle_type,is_online,rating,total_deliveries")
      .in("id", riderIds);
    if (error) throw databaseError("Rider profiles could not be loaded.");
    return (data ?? []) as Row[];
  },
  async findConnectionById(connectionId) {
    const { data, error } = await supabaseAdmin.from("rider_connections")
      .select("id,shop_id,rider_id,status,created_at")
      .eq("id", connectionId).maybeSingle();
    if (error) throw databaseError("Rider connection could not be loaded.");
    return data as Row | null;
  },
  async updateMerchantDecision(connectionId, shopId, status) {
    const { data, error } = await supabaseAdmin.from("rider_connections")
      .update({ status }).eq("id", connectionId).eq("shop_id", shopId)
      .select("id,shop_id,rider_id,status,created_at").maybeSingle();
    return ensureData(data as Row | null, error, "Rider connection decision could not be saved.");
  },
};

const safeProfile = (profile: Row): Row => Object.fromEntries(
  PROFILE_FIELDS.map((field) => [field, profile[field]]),
);

const safeConnection = (connection: Row): Row => ({
  id: connection.id,
  status: connection.status,
  created_at: connection.created_at,
});

const requireUid = (request: AuthenticatedRequest): string => {
  const uid = request.authUser?.uid;
  if (!uid) throw new RiderAccessError(401, "UNAUTHORIZED", "Authentication is required.");
  return uid;
};

const requireRider = async (repository: RiderAccessRepository, uid: string): Promise<Row> => {
  const rider = await repository.findRiderByFirebaseUid(uid);
  if (!rider) throw new RiderAccessError(404, "RIDER_PROFILE_NOT_FOUND", "Rider profile was not found.");
  return rider;
};

const requireApprovedRider = async (repository: RiderAccessRepository, uid: string): Promise<Row> => {
  const rider = await requireRider(repository, uid);
  if (rider.verification_status !== "approved") {
    throw new RiderAccessError(403, "RIDER_NOT_APPROVED", "Rider is not approved.");
  }
  return rider;
};

const requireMerchantShop = async (
  repository: RiderAccessRepository,
  uid: string,
  requireApproval: boolean,
): Promise<Row> => {
  const shops = await repository.findMerchantShops(uid);
  if (shops.length === 0) {
    throw new RiderAccessError(404, "MERCHANT_SHOP_NOT_MAPPED", "Merchant shop is not mapped.");
  }
  if (shops.length !== 1) {
    throw new RiderAccessError(409, "MERCHANT_SHOP_NOT_MAPPED", "Merchant shop mapping is ambiguous.");
  }
  const shop = shops[0];
  if (requireApproval && shop.approval_status !== "approved") {
    throw new RiderAccessError(403, "MERCHANT_SHOP_NOT_APPROVED", "Merchant shop is not approved.");
  }
  return shop;
};

const sendError = (res: Response, error: unknown): void => {
  if (error instanceof RiderAccessError) {
    res.status(error.status).json({ success: false, code: error.code, error: error.message });
    return;
  }
  console.error("Rider access API error:", error instanceof Error ? error.message : "unknown error");
  res.status(500).json({ success: false, code: "INTERNAL_ERROR", error: "Internal Server Error" });
};

export interface RiderAccessRouterOptions {
  now?: () => Date;
  generateCode?: () => string;
}

export const createRiderAccessRouters = (
  repository: RiderAccessRepository = supabaseRiderAccessRepository,
  authenticate: RequestHandler = authenticateFirebase,
  options: RiderAccessRouterOptions = {},
): { riderRouter: ReturnType<typeof Router>; merchantRiderRouter: ReturnType<typeof Router> } => {
  const riderRouter = Router();
  const merchantRiderRouter = Router();
  const now = options.now ?? (() => new Date());
  const generateCode = options.generateCode ?? generateSixDigitPairingCode;

  riderRouter.post("/profile", authenticate, async (request, res) => {
    try {
      const req = request as AuthenticatedRequest;
      const uid = requireUid(req);
      const input = parseRiderProfileBody(req.body);
      const existing = await repository.findRiderByFirebaseUid(uid);
      const profile = existing
        ? await repository.updateRiderProfile(String(existing.id), {
            full_name: input.full_name,
            name: input.full_name,
            phone: input.phone,
            vehicle_type: input.vehicle_type,
          })
        : await repository.createRider({
            firebase_uid: uid,
            full_name: input.full_name,
            name: input.full_name,
            phone: input.phone,
            vehicle_type: input.vehicle_type,
            verification_status: "approved",
            is_online: false,
            status: "offline",
          });
      res.status(existing ? 200 : 201).json({ success: true, profile: safeProfile(profile) });
    } catch (error) { sendError(res, error); }
  });

  riderRouter.get("/profile", authenticate, async (request, res) => {
    try {
      const profile = await requireRider(repository, requireUid(request as AuthenticatedRequest));
      res.status(200).json({ success: true, profile: safeProfile(profile) });
    } catch (error) { sendError(res, error); }
  });

  riderRouter.patch("/availability", authenticate, async (request, res) => {
    try {
      const uid = requireUid(request as AuthenticatedRequest);
      const isOnline = parseAvailabilityBody(request.body);
      const rider = await requireApprovedRider(repository, uid);
      const profile = await repository.updateRiderAvailability(String(rider.id), isOnline);
      res.status(200).json({ success: true, profile: safeProfile(profile) });
    } catch (error) { sendError(res, error); }
  });

  riderRouter.get("/connections", authenticate, async (request, res) => {
    try {
      const rider = await requireRider(repository, requireUid(request as AuthenticatedRequest));
      const connections = await repository.listRiderConnections(String(rider.id));
      const shopIds = [...new Set(connections.map((row) => String(row.shop_id)))];
      const shops = await Promise.all(shopIds.map((shopId) => repository.findShopById(shopId)));
      const shopById = new Map(shops.filter(Boolean).map((shop) => [String(shop!.id), shop!]));
      res.status(200).json({
        success: true,
        connections: connections.map((connection) => ({
          ...safeConnection(connection),
          shop: {
            id: connection.shop_id,
            name: shopById.get(String(connection.shop_id))?.name ?? null,
          },
        })),
      });
    } catch (error) { sendError(res, error); }
  });

  riderRouter.post("/connections/request", authenticate, async (request, res) => {
    try {
      const uid = requireUid(request as AuthenticatedRequest);
      const code = parsePairingCodeBody(request.body);
      const rider = await requireApprovedRider(repository, uid);
      const pairing = await repository.findPairingCode(code);
      if (!isUsablePairingCode(pairing, now())) {
        throw new RiderAccessError(400, "PAIRING_CODE_INVALID", "Pairing code is invalid.");
      }
      const shop = await repository.findShopById(String(pairing.shop_id));
      if (!shop || shop.archived_at != null || shop.approval_status !== "approved") {
        throw new RiderAccessError(404, "SHOP_UNAVAILABLE", "Shop is unavailable for pairing.");
      }
      const existing = await repository.findConnection(String(shop.id), String(rider.id));
      const targetStatus = nextConnectionStatus(existing?.status);
      const connection = existing
        ? targetStatus === existing.status
          ? existing
          : await repository.updateConnectionRequest(String(existing.id), code)
        : await repository.createConnection({
            shop_id: String(shop.id), rider_id: String(rider.id), status: "pending",
            connection_code: code, expires_at: null,
          });
      res.status(existing ? 200 : 201).json({
        success: true,
        connection: { ...safeConnection(connection), shop: { id: shop.id, name: shop.name ?? null } },
      });
    } catch (error) { sendError(res, error); }
  });

  merchantRiderRouter.post("/pairing-code", authenticate, async (request, res) => {
    try {
      const req = request as AuthenticatedRequest;
      const uid = requireUid(req);
      assertExactFields(req.body ?? {}, []);
      const shop = await requireMerchantShop(repository, uid, true);
      const issuedAt = now();
      const expiresAt = new Date(issuedAt.getTime() + 24 * 60 * 60 * 1000).toISOString();
      let pairing: Row | null = null;
      for (let attempt = 0; attempt < 5 && !pairing; attempt += 1) {
        try {
          pairing = await repository.issuePairingCode(String(shop.id), generateCode(), uid, expiresAt);
        } catch (error) {
          if (!(error instanceof PairingCodeCollisionError) || attempt === 4) throw error;
        }
      }
      if (!pairing) throw databaseError("Pairing code could not be issued.");
      res.status(201).json({
        success: true,
        pairing_code: { code: pairing.code, expires_at: pairing.expires_at },
      });
    } catch (error) { sendError(res, error); }
  });

  merchantRiderRouter.get("/pairing-code", authenticate, async (request, res) => {
    try {
      const shop = await requireMerchantShop(repository, requireUid(request as AuthenticatedRequest), false);
      const pairing = await repository.getCurrentPairingCode(String(shop.id), now().toISOString());
      res.status(200).json({
        success: true,
        pairing_code: pairing ? { code: pairing.code, expires_at: pairing.expires_at } : null,
      });
    } catch (error) { sendError(res, error); }
  });

  merchantRiderRouter.get("/connections", authenticate, async (request, res) => {
    try {
      const shop = await requireMerchantShop(repository, requireUid(request as AuthenticatedRequest), false);
      const connections = await repository.listMerchantConnections(String(shop.id));
      const riderIds = [...new Set(connections.map((row) => String(row.rider_id)))];
      const riders = await repository.findRidersByIds(riderIds);
      const riderById = new Map(riders.map((rider) => [String(rider.id), rider]));
      res.status(200).json({
        success: true,
        connections: connections.map((connection) => {
          const rider = riderById.get(String(connection.rider_id));
          return {
            connection: safeConnection(connection),
            rider: rider ? {
              id: rider.id,
              full_name: rider.full_name ?? rider.name ?? null,
              phone: rider.phone ?? null,
              vehicle_type: rider.vehicle_type ?? null,
              is_online: rider.is_online === true,
              rating: rider.rating ?? null,
              total_deliveries: rider.total_deliveries ?? 0,
            } : null,
          };
        }),
      });
    } catch (error) { sendError(res, error); }
  });

  merchantRiderRouter.patch("/connections/:id", authenticate, async (request, res) => {
    try {
      const shop = await requireMerchantShop(
        repository,
        requireUid(request as AuthenticatedRequest),
        true,
      );
      const decision = parseMerchantDecision(request.body);
      const connectionId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
      const existing = await repository.findConnectionById(connectionId);
      if (!existing || String(existing.shop_id) !== String(shop.id)) {
        throw new RiderAccessError(404, "RIDER_CONNECTION_NOT_FOUND", "Rider connection was not found.");
      }
      const status = decision === "approve" ? "approved" : "rejected";
      const connection = existing.status === status
        ? existing
        : await repository.updateMerchantDecision(connectionId, String(shop.id), status);
      res.status(200).json({ success: true, connection: safeConnection(connection) });
    } catch (error) { sendError(res, error); }
  });

  return { riderRouter, merchantRiderRouter };
};

export const { riderRouter, merchantRiderRouter } = createRiderAccessRouters();
