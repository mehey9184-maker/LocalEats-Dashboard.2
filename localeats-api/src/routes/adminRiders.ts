import { Router, type RequestHandler, type Response } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { authenticateAdminFirebase } from "../middleware/authenticateAdminFirebase.js";
import {
  authorizeSuperAdmin,
  type SuperAdminRequest,
} from "../middleware/authorizeSuperAdmin.js";

type RiderRow = Record<string, unknown>;
type VerificationStatus = "pending" | "approved" | "rejected" | "suspended";

const RIDER_FIELDS = [
  "id", "full_name", "phone", "vehicle_type", "verification_status", "is_online", "status",
] as const;
const RIDER_SELECT = RIDER_FIELDS.join(",");
const RIDER_STATUSES: readonly VerificationStatus[] = ["pending", "approved", "rejected", "suspended"];
const RIDER_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isVerificationStatus = (value: unknown): value is VerificationStatus =>
  typeof value === "string" && RIDER_STATUSES.some((status) => status === value);

const boundedInteger = (value: unknown, fallback: number, minimum: number, maximum?: number): number | null => {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && (maximum === undefined || parsed <= maximum)
    ? parsed : null;
};

const projectRider = (row: RiderRow): RiderRow => Object.fromEntries(
  RIDER_FIELDS.map((field) => [field, row[field]]),
);

export interface AdminRiderRepository {
  list(status: VerificationStatus | null, limit: number, offset: number): Promise<RiderRow[]>;
  findById(riderId: string): Promise<RiderRow | null>;
  updateVerification(
    riderId: string,
    expected: VerificationStatus,
    target: VerificationStatus,
  ): Promise<RiderRow | null>;
}

export const supabaseAdminRiderRepository: AdminRiderRepository = {
  async list(status, limit, offset) {
    let query = supabaseAdmin.from("rider_profiles").select(RIDER_SELECT);
    if (status !== null) query = query.eq("verification_status", status);
    const { data, error } = await query.order("id", { ascending: true }).range(offset, offset + limit - 1);
    if (error || data === null) throw new Error("Admin Rider list query failed");
    return data as unknown as RiderRow[];
  },
  async findById(riderId) {
    const { data, error } = await supabaseAdmin.from("rider_profiles")
      .select(RIDER_SELECT).eq("id", riderId).maybeSingle();
    if (error) throw new Error("Admin Rider detail query failed");
    return data as unknown as RiderRow | null;
  },
  async updateVerification(riderId, expected, target) {
    const { data, error } = await supabaseAdmin.from("rider_profiles")
      .update({ verification_status: target, is_online: false, status: "offline" })
      .eq("id", riderId)
      .eq("verification_status", expected)
      .select(RIDER_SELECT).maybeSingle();
    if (error) throw new Error("Admin Rider verification update failed");
    return data as unknown as RiderRow | null;
  },
};

export const createAdminRiderRouter = (
  repository: AdminRiderRepository = supabaseAdminRiderRepository,
  authenticate: RequestHandler = authenticateAdminFirebase as RequestHandler,
  authorize: RequestHandler = authorizeSuperAdmin as RequestHandler,
): ReturnType<typeof Router> => {
  const router = Router();
  router.use(authenticate, authorize);

  router.get("/", async (req: SuperAdminRequest, res: Response): Promise<void> => {
    res.setHeader("Cache-Control", "no-store");
    const rawStatus = req.query.verification_status;
    if (rawStatus !== undefined && !isVerificationStatus(rawStatus)) {
      res.status(400).json({ success: false, error: "Invalid verification_status" });
      return;
    }
    const limit = boundedInteger(req.query.limit, 25, 1, 50);
    const offset = boundedInteger(req.query.offset, 0, 0);
    if (limit === null || offset === null || offset > Number.MAX_SAFE_INTEGER - limit + 1) {
      res.status(400).json({ success: false, error: "Invalid pagination" });
      return;
    }
    try {
      const riders = await repository.list(rawStatus === undefined ? null : rawStatus as VerificationStatus, limit, offset);
      res.status(200).json({
        success: true,
        riders: riders.map(projectRider),
        pagination: { limit, offset, returned: riders.length },
      });
    } catch (error) {
      console.error("Admin Rider list error:", error);
      res.status(500).json({ success: false, error: "Internal Server Error" });
    }
  });

  router.get("/:riderId", async (req: SuperAdminRequest, res: Response): Promise<void> => {
    res.setHeader("Cache-Control", "no-store");
    const riderId = req.params.riderId;
    if (typeof riderId !== "string" || !RIDER_UUID.test(riderId)) {
      res.status(400).json({ success: false, error: "Invalid riderId" });
      return;
    }
    try {
      const rider = await repository.findById(riderId);
      if (!rider) {
        res.status(404).json({ success: false, error: "Rider not found" });
        return;
      }
      res.status(200).json({ success: true, rider: projectRider(rider) });
    } catch (error) {
      console.error("Admin Rider detail error:", error);
      res.status(500).json({ success: false, error: "Internal Server Error" });
    }
  });

  router.patch("/:riderId/verification", async (req: SuperAdminRequest, res: Response): Promise<void> => {
    res.setHeader("Cache-Control", "no-store");
    const riderId = req.params.riderId;
    if (typeof riderId !== "string" || !RIDER_UUID.test(riderId)) {
      res.status(400).json({ success: false, error: "Invalid riderId" });
      return;
    }
    if (!isRecord(req.body) || Object.keys(req.body).length !== 1 ||
        !isVerificationStatus(req.body.verification_status)) {
      res.status(400).json({ success: false, error: "Invalid request body" });
      return;
    }
    const target = req.body.verification_status;
    try {
      const existing = await repository.findById(riderId);
      if (!existing) {
        res.status(404).json({ success: false, error: "Rider not found" });
        return;
      }
      if (!isVerificationStatus(existing.verification_status)) {
        res.status(409).json({ success: false, code: "RIDER_VERIFICATION_STATE_CONFLICT", error: "Rider verification state conflict" });
        return;
      }
      // A separate orders read could race with a claim. Until an atomic
      // assignment guard exists, never demote an approved Rider here.
      if (existing.verification_status === "approved" && target !== "approved") {
        res.status(409).json({ success: false, code: "RIDER_DEMOTION_REQUIRES_ATOMIC_GUARD", error: "Approved Rider cannot be demoted safely yet" });
        return;
      }
      if (existing.verification_status === target) {
        res.status(409).json({ success: false, code: "RIDER_VERIFICATION_STATE_CONFLICT", error: "Rider verification state conflict" });
        return;
      }
      const rider = await repository.updateVerification(riderId, existing.verification_status, target);
      if (!rider) {
        res.status(409).json({ success: false, code: "RIDER_VERIFICATION_STATE_CONFLICT", error: "Rider verification state conflict" });
        return;
      }
      if (rider.id !== riderId || rider.verification_status !== target ||
          rider.is_online !== false || rider.status !== "offline") {
        throw new Error("Admin Rider verification returned an invalid state");
      }
      res.status(200).json({ success: true, rider: projectRider(rider) });
    } catch (error) {
      console.error("Admin Rider verification error:", error);
      res.status(500).json({ success: false, error: "Internal Server Error" });
    }
  });

  return router;
};

export const adminRiderRouter = createAdminRiderRouter();
