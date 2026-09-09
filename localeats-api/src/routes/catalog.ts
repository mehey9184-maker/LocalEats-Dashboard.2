import { Router } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

export const PUBLIC_SHOP_FIELDS = [
  "id", "name", "description", "location", "category", "logo_url", "rating",
  "opening_time", "closing_time", "is_active", "latitude", "longitude", "lat", "lng", "story",
] as const;
export const PUBLIC_MENU_FIELDS = [
  "id", "shop_id", "name", "price", "description", "image_url", "category",
  "is_available", "popularity_score", "customizations", "created_at",
] as const;

const project = (row: Record<string, unknown>, fields: readonly string[]) =>
  Object.fromEntries(fields.filter((field) => Object.hasOwn(row, field)).map((field) => [field, row[field]]));

// Injection keeps HTTP tests independent of live database credentials or data.
export function createCatalogRouter(db: Pick<SupabaseClient, "from"> = supabaseAdmin) {
  const router = Router();
  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  const publicShops = () => db.from("shops")
    .select(PUBLIC_SHOP_FIELDS.join(","))
    .eq("approval_status", "approved")
    .is("archived_at", null);

  router.get("/shops", async (_req, res) => {
    try {
      const { data, error } = await publicShops().returns<Record<string, unknown>[]>();
      if (error) throw error;
      res.json({ success: true, shops: (data ?? []).map((shop) => project(shop, PUBLIC_SHOP_FIELDS)) });
    } catch {
      res.status(500).json({ success: false, error: "Internal Server Error" });
    }
  });

  router.get("/shops/:shopId", async (req, res) => {
    try {
      const { data, error } = await publicShops().eq("id", req.params.shopId).returns<Record<string, unknown>[]>().maybeSingle();
      if (error) throw error;
      if (!data) {
        res.status(404).json({ success: false, error: "Shop not found" });
        return;
      }
      res.json({ success: true, shop: project(data, PUBLIC_SHOP_FIELDS) });
    } catch {
      res.status(500).json({ success: false, error: "Internal Server Error" });
    }
  });

  router.get("/shops/:shopId/menu", async (req, res) => {
    try {
      const { data: shop, error: shopError } = await publicShops().eq("id", req.params.shopId).returns<Record<string, unknown>[]>().maybeSingle();
      if (shopError) throw shopError;
      if (!shop) {
        res.status(404).json({ success: false, error: "Shop not found" });
        return;
      }
      const { data, error } = await db.from("menu_items")
        .select(PUBLIC_MENU_FIELDS.join(","))
        .eq("shop_id", shop.id)
        .returns<Record<string, unknown>[]>();
      if (error) throw error;
      res.json({ success: true, menu: (data ?? []).map((item) => project(item, PUBLIC_MENU_FIELDS)) });
    } catch {
      res.status(500).json({ success: false, error: "Internal Server Error" });
    }
  });
  return router;
}

export default createCatalogRouter();
