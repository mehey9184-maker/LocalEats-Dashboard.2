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

type ApprovalAction = "approve" | "reject" | "suspend" | "reinstate";
type ExpectedApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "suspended";

const APPROVAL_ACTIONS: readonly ApprovalAction[] = [
  "approve",
  "reject",
  "suspend",
  "reinstate",
];

const EXPECTED_APPROVAL_STATUSES: readonly ExpectedApprovalStatus[] = [
  "pending",
  "approved",
  "rejected",
  "suspended",
];

const APPROVAL_BODY_FIELDS = new Set([
  "action",
  "expected_status",
  "reason",
]);

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isApprovalAction = (value: string): value is ApprovalAction =>
  APPROVAL_ACTIONS.some((allowedValue) => allowedValue === value);

const isExpectedApprovalStatus = (
  value: string
): value is ExpectedApprovalStatus =>
  EXPECTED_APPROVAL_STATUSES.some(
    (allowedValue) => allowedValue === value
  );

const normalizeApprovalAction = (value: unknown): ApprovalAction | null => {
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  return isApprovalAction(normalized) ? normalized : null;
};

const normalizeExpectedApprovalStatus = (
  value: unknown
): ExpectedApprovalStatus | null => {
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  return isExpectedApprovalStatus(normalized) ? normalized : null;
};

const normalizeRpcShop = (value: unknown): Record<string, unknown> | null => {
  if (isObjectRecord(value)) return value;

  if (
    Array.isArray(value) &&
    value.length === 1 &&
    isObjectRecord(value[0])
  ) {
    return value[0];
  }

  return null;
};

const projectAdminShopDetail = (shop: Record<string, unknown>) => ({
  id: shop.id,
  owner_id: shop.owner_id,
  name: shop.name,
  category: shop.category,
  description: shop.description,
  phone: shop.phone,
  location: shop.location,
  latitude: shop.latitude,
  longitude: shop.longitude,
  opening_time: shop.opening_time,
  closing_time: shop.closing_time,
  logo_url: shop.logo_url,
  story: shop.story,
  approval_status: shop.approval_status,
  approval_reason: shop.approval_reason,
  is_active: shop.is_active,
  archived_at: shop.archived_at,
  created_at: shop.created_at,
});

const sendApprovalRpcError = (
  res: Response,
  error: { code: string; message: string }
): void => {
  console.error("Supabase shop approval RPC failed:", {
    code: error.code,
    message: error.message,
  });

  if (error.code === "LE403") {
    res.status(403).json({ success: false, error: "Forbidden" });
    return;
  }

  if (error.code === "LE404") {
    res.status(404).json({ success: false, error: "Shop not found" });
    return;
  }

  if (error.code === "LE409") {
    res.status(409).json({
      success: false,
      error: "Shop approval state conflict",
    });
    return;
  }

  if (
    error.code === "LE422" &&
    error.message === "SHOP_APPROVAL_REASON_REQUIRED"
  ) {
    res.status(422).json({
      success: false,
      error: "Approval reason required",
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: "Internal Server Error",
  });
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

router.post(
  "/shops/:shopId/approval",
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
    const body: unknown = req.body;

    if (!isObjectRecord(body)) {
      res.status(400).json({
        success: false,
        error: "Invalid request body",
      });
      return;
    }

    if (Object.keys(body).some((key) => !APPROVAL_BODY_FIELDS.has(key))) {
      res.status(400).json({
        success: false,
        error: "Invalid request body",
      });
      return;
    }

    const action = normalizeApprovalAction(body.action);
    if (action === null) {
      res.status(400).json({ success: false, error: "Invalid action" });
      return;
    }

    const expectedStatus = normalizeExpectedApprovalStatus(
      body.expected_status
    );
    if (expectedStatus === null) {
      res.status(400).json({
        success: false,
        error: "Invalid expected_status",
      });
      return;
    }

    if (
      body.reason !== undefined &&
      body.reason !== null &&
      typeof body.reason !== "string"
    ) {
      res.status(400).json({ success: false, error: "Invalid reason" });
      return;
    }

    let normalizedReason: string | null = null;
    if (action === "reject" || action === "suspend") {
      if (typeof body.reason !== "string" || body.reason.trim() === "") {
        res.status(422).json({
          success: false,
          error: "Approval reason required",
        });
        return;
      }

      normalizedReason = body.reason.trim();
    }

    const actedBy = req.adminUser?.firebase_uid;
    if (!actedBy) {
      res.status(500).json({
        success: false,
        error: "Internal Server Error",
      });
      return;
    }

    try {
      const { data, error } = await supabaseAdmin.rpc(
        "transition_shop_approval",
        {
          p_shop_id: shopId,
          p_action: action,
          p_expected_status: expectedStatus,
          p_acted_by: actedBy,
          p_reason: normalizedReason,
        }
      );

      if (error) {
        sendApprovalRpcError(res, error);
        return;
      }

      const updatedShop = normalizeRpcShop(data);
      if (!updatedShop) {
        console.error("Shop approval RPC returned an invalid result shape");
        res.status(500).json({
          success: false,
          error: "Internal Server Error",
        });
        return;
      }

      res.status(200).json({
        success: true,
        shop: projectAdminShopDetail(updatedShop),
      });
    } catch (error) {
      console.error("Unexpected shop approval transition error:", error);
      res.status(500).json({
        success: false,
        error: "Internal Server Error",
      });
    }
  }
);

export default router;
