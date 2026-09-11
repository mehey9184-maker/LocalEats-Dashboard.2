import { Router, type RequestHandler } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { authenticateFirebase, type AuthenticatedRequest } from "../middleware/authenticateFirebase.js";

export const MERCHANT_MENU_FIELDS = [
  "id", "shop_id", "name", "price", "description", "image_url", "category",
  "is_available", "popularity_score", "customizations", "created_at",
] as const;
const mutableFields = ["name", "price", "description", "image_url", "category", "is_available"];
type Row = Record<string, unknown>;
const project = (row: Row) => Object.fromEntries(
  MERCHANT_MENU_FIELDS.filter((field) => Object.hasOwn(row, field)).map((field) => [field, row[field]]),
);
const validId = (value: unknown): value is string | number =>
  (typeof value === "string" && value.trim().length > 0 && value.length <= 200) ||
  (typeof value === "number" && Number.isSafeInteger(value) && value >= 0);

function validImage(value: unknown) {
  if (value === null) return true;
  if (typeof value !== "string" || value.length > 2048 || value !== value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !!url.hostname && !url.username && !url.password;
  } catch { return false; }
}

function validate(body: unknown, create: boolean): Row | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const input = body as Row;
  const allowed = create ? [...mutableFields, "shop_id"] : mutableFields;
  if (!Object.keys(input).length || Object.keys(input).some((key) => !allowed.includes(key))) return null;
  if (create && (!validId(input.shop_id) || !Object.hasOwn(input, "name") || !Object.hasOwn(input, "price"))) return null;
  if (Object.hasOwn(input, "name") && (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 200)) return null;
  if (Object.hasOwn(input, "price") && (typeof input.price !== "number" || !Number.isFinite(input.price) || input.price < 0)) return null;
  if (Object.hasOwn(input, "category") && (typeof input.category !== "string" || !input.category.trim() || input.category.trim().length > 100)) return null;
  if (Object.hasOwn(input, "description") && input.description !== null && typeof input.description !== "string") return null;
  if (Object.hasOwn(input, "is_available") && typeof input.is_available !== "boolean") return null;
  if (Object.hasOwn(input, "image_url") && !validImage(input.image_url)) return null;
  return {
    ...input,
    ...(typeof input.name === "string" ? { name: input.name.trim() } : {}),
    ...(typeof input.category === "string" ? { category: input.category.trim() } : {}),
  };
}

// Dependencies are injectable for isolated HTTP tests; production always uses Firebase auth.
export function createMerchantMenuRouter(
  db: Pick<SupabaseClient, "from"> = supabaseAdmin,
  authenticate: RequestHandler = authenticateFirebase,
) {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
  router.use(authenticate);
  router.use((req: AuthenticatedRequest, res, next) => {
    if (!req.authUser?.uid) { res.status(401).json({ success: false, error: "Unauthorized" }); return; }
    next();
  });

  async function ownedShop(shopId: string | number, uid: string) {
    const { data, error } = await db.from("shops").select("id")
      .eq("id", shopId).eq("owner_id", uid).is("archived_at", null).maybeSingle();
    if (error) throw error;
    return data;
  }

  router.get("/", async (req: AuthenticatedRequest, res) => {
    if (!validId(req.query.shop_id)) { res.status(400).json({ success: false, error: "Invalid shop_id" }); return; }
    try {
      const shop = await ownedShop(req.query.shop_id, req.authUser!.uid);
      if (!shop) { res.status(404).json({ success: false, error: "Shop not found" }); return; }
      const { data, error } = await db.from("menu_items").select(MERCHANT_MENU_FIELDS.join(","))
        .eq("shop_id", shop.id).returns<Row[]>();
      if (error) throw error;
      res.json({ success: true, menu: (data ?? []).map(project) });
    } catch { res.status(500).json({ success: false, error: "Internal Server Error" }); }
  });

  router.post("/", async (req: AuthenticatedRequest, res) => {
    const input = validate(req.body, true);
    if (!input) { res.status(400).json({ success: false, error: "Invalid menu item" }); return; }
    try {
      const shop = await ownedShop(input.shop_id as string | number, req.authUser!.uid);
      if (!shop) { res.status(404).json({ success: false, error: "Shop not found" }); return; }
      const { data, error } = await db.from("menu_items").insert({ ...input, shop_id: shop.id })
        .select(MERCHANT_MENU_FIELDS.join(",")).returns<Row[]>().single();
      if (error || !data) throw error ?? new Error("No inserted row");
      res.status(201).json({ success: true, item: project(data) });
    } catch { res.status(500).json({ success: false, error: "Internal Server Error" }); }
  });

  router.patch("/:itemId", async (req: AuthenticatedRequest, res) => {
    const input = validate(req.body, false);
    if (!input) { res.status(400).json({ success: false, error: "Invalid menu item" }); return; }
    try {
      const { data: item, error: lookupError } = await db.from("menu_items").select("id,shop_id")
        .eq("id", req.params.itemId).maybeSingle();
      if (lookupError) throw lookupError;
      if (!item || !await ownedShop(item.shop_id, req.authUser!.uid)) {
        res.status(404).json({ success: false, error: "Menu item not found" }); return;
      }
      const { data, error } = await db.from("menu_items").update(input)
        .eq("id", item.id).eq("shop_id", item.shop_id)
        .select(MERCHANT_MENU_FIELDS.join(",")).returns<Row[]>().maybeSingle();
      if (error) throw error;
      if (!data) { res.status(404).json({ success: false, error: "Menu item not found" }); return; }
      res.json({ success: true, item: project(data) });
    } catch { res.status(500).json({ success: false, error: "Internal Server Error" }); }
  });
  return router;
}

export default createMerchantMenuRouter();
