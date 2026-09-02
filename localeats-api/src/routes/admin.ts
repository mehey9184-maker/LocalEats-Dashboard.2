import { Router, Response } from "express";
import { authenticateAdminFirebase } from "../middleware/authenticateAdminFirebase.js";
import {
  authorizeSuperAdmin,
  SuperAdminRequest,
} from "../middleware/authorizeSuperAdmin.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const router = Router();

const ADMIN_SHOP_LIST_FIELDS = [
  "id",
  "owner_id",
  "name",
  "category",
  "phone",
  "location",
  "logo_url",
  "approval_status",
  "approval_reason",
  "is_active",
  "created_at",
].join(",");

const ADMIN_SHOP_DETAIL_FIELDS = [
  "id",
  "owner_id",
  "name",
  "category",
  "description",
  "phone",
  "location",
  "latitude",
  "longitude",
  "opening_time",
  "closing_time",
  "logo_url",
  "story",
  "approval_status",
  "approval_reason",
  "is_active",
  "archived_at",
  "created_at",
].join(",");

type ApprovalStatusFilter =
  | "pending"
  | "approved"
  | "rejected"
  | "suspended"
  | "all";

const APPROVAL_STATUS_FILTERS: readonly ApprovalStatusFilter[] = [
  "pending",
  "approved",
  "rejected",
  "suspended",
  "all",
];

const isApprovalStatusFilter = (
  value: string
): value is ApprovalStatusFilter =>
  APPROVAL_STATUS_FILTERS.some((allowedValue) => allowedValue === value);

const parseApprovalStatus = (value: unknown): ApprovalStatusFilter | null => {
  if (value === undefined) return "pending";
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  return isApprovalStatusFilter(normalized) ? normalized : null;
};

const parseBoundedInteger = (
  value: unknown,
  defaultValue: number,
  minimum: number,
  maximum?: number
): number | null => {
  if (value === undefined) return defaultValue;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;

  const parsed = Number(value);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < minimum ||
    (maximum !== undefined && parsed > maximum)
  ) {
    return null;
  }

  return parsed;
};

router.get(
  "/me",
  authenticateAdminFirebase,
  authorizeSuperAdmin,
  (req: SuperAdminRequest, res: Response): void => {
    if (!req.authUser || !req.adminUser) {
      res.status(500).json({
        success: false,
        error: "Internal Server Error",
      });
      return;
    }

    res.status(200).json({
      success: true,
      admin: {
        uid: req.authUser.uid,
        email: req.authUser.email,
        role: req.adminUser.role,
      },
    });
  }
);

router.get(
  "/shops",
  authenticateAdminFirebase,
  authorizeSuperAdmin,
  async (req: SuperAdminRequest, res: Response): Promise<void> => {
    res.setHeader("Cache-Control", "no-store");

    const approvalStatus = parseApprovalStatus(req.query.approval_status);
    if (approvalStatus === null) {
      res.status(400).json({
        success: false,
        error: "Invalid approval_status",
      });
      return;
    }

    const limit = parseBoundedInteger(req.query.limit, 25, 1, 50);
    if (limit === null) {
      res.status(400).json({ success: false, error: "Invalid limit" });
      return;
    }

    const offset = parseBoundedInteger(req.query.offset, 0, 0);
    if (
      offset === null ||
      offset > Number.MAX_SAFE_INTEGER - limit + 1
    ) {
      res.status(400).json({ success: false, error: "Invalid offset" });
      return;
    }

    try {
      let query = supabaseAdmin
        .from("shops")
        .select(ADMIN_SHOP_LIST_FIELDS)
        .is("archived_at", null);

      if (approvalStatus !== "all") {
        query = query.eq("approval_status", approvalStatus);
      }

      const { data: shops, error } = await query
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(offset, offset + limit - 1);

      if (error || shops === null) {
        console.error("Supabase admin shop list query failed:", error);
        res.status(500).json({
          success: false,
          error: "Internal Server Error",
        });
        return;
      }

      res.status(200).json({
        success: true,
        shops,
        pagination: {
          limit,
          offset,
          returned: shops.length,
        },
      });
    } catch (error) {
      console.error("Unexpected admin shop list error:", error);
      res.status(500).json({
        success: false,
        error: "Internal Server Error",
      });
    }
  }
);

router.get(
  "/shops/:shopId",
  authenticateAdminFirebase,
  authorizeSuperAdmin,
  async (req: SuperAdminRequest, res: Response): Promise<void> => {
    res.setHeader("Cache-Control", "no-store");

    const rawShopId: unknown = req.params.shopId;
    if (typeof rawShopId !== "string" || rawShopId.trim() === "") {
      res.status(400).json({ success: false, error: "Invalid shopId" });
      return;
    }

    const shopId = rawShopId.trim();

    try {
      const { data: shop, error } = await supabaseAdmin
        .from("shops")
        .select(ADMIN_SHOP_DETAIL_FIELDS)
        .eq("id", shopId)
        .is("archived_at", null)
        .maybeSingle();

      if (error) {
        console.error("Supabase admin shop detail query failed:", error);
        res.status(500).json({
          success: false,
          error: "Internal Server Error",
        });
        return;
      }

      if (!shop) {
        res.status(404).json({
          success: false,
          error: "Shop not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        shop,
      });
    } catch (error) {
      console.error("Unexpected admin shop detail error:", error);
      res.status(500).json({
        success: false,
        error: "Internal Server Error",
      });
    }
  }
);

export default router;
