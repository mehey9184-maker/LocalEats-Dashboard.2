import { Router, Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const PUBLIC_SHOP_FIELDS = "id,name,description,location,category,logo_url,rating,opening_time,closing_time,is_active,latitude,longitude,lat,lng,story";
const PUBLIC_MENU_FIELDS = "id,shop_id,name,price,description,image_url,category,is_available,popularity_score,customizations,created_at";

export interface CatalogRepository {
  getApprovedShops(): Promise<any[]>;
  getApprovedShopById(shopId: string): Promise<any | null>;
  getMenuByShopId(shopId: string): Promise<any[]>;
}

export class SupabaseCatalogRepository implements CatalogRepository {
  private supabase: any;
  constructor(supabase: any) {
    this.supabase = supabase;
  }
  async getApprovedShops(): Promise<any[]> {
    const { data, error } = await this.supabase
      .from("shops")
      .select(PUBLIC_SHOP_FIELDS)
      .eq("approval_status", "approved")
      .is("archived_at", null);
    if (error) throw error;
    return data || [];
  }
  async getApprovedShopById(shopId: string): Promise<any | null> {
    const { data, error } = await this.supabase
      .from("shops")
      .select(PUBLIC_SHOP_FIELDS)
      .eq("id", shopId)
      .eq("approval_status", "approved")
      .is("archived_at", null)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }
  async getMenuByShopId(shopId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from("menu_items")
      .select(PUBLIC_MENU_FIELDS)
      .eq("shop_id", shopId);
    if (error) throw error;
    return data || [];
  }
}

export const makeCatalogRouter = (repository: CatalogRepository): Router => {
  const router = Router();

  router.get("/shops", async (req: Request, res: Response): Promise<void> => {
    try {
      const shops = await repository.getApprovedShops();
      res.status(200).json({
        success: true,
        shops,
      });
    } catch (err) {
      console.error("Error fetching catalog shops:", err);
      res.status(500).json({
        success: false,
        error: "Internal Server Error",
      });
    }
  });

  router.get("/shops/:shopId", async (req: Request, res: Response): Promise<void> => {
    try {
      const shopId = req.params.shopId;
      if (typeof shopId !== "string" || !shopId.trim()) {
        res.status(404).json({ success: false, error: "Shop not found" });
        return;
      }

      const shop = await repository.getApprovedShopById(shopId.trim());

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
    } catch (err) {
      console.error("Error fetching catalog shop detail:", err);
      res.status(500).json({
        success: false,
        error: "Internal Server Error",
      });
    }
  });

  router.get("/shops/:shopId/menu", async (req: Request, res: Response): Promise<void> => {
    try {
      const shopId = req.params.shopId;
      if (typeof shopId !== "string" || !shopId.trim()) {
        res.status(404).json({ success: false, error: "Shop not found" });
        return;
      }

      // First, verify the shop exists and is public
      const shop = await repository.getApprovedShopById(shopId.trim());

      if (!shop) {
        res.status(404).json({
          success: false,
          error: "Shop not found",
        });
        return;
      }

      const menuItems = await repository.getMenuByShopId(shopId.trim());

      res.status(200).json({
        success: true,
        menu_items: menuItems,
      });
    } catch (err) {
      console.error("Error fetching catalog menu items:", err);
      res.status(500).json({
        success: false,
        error: "Internal Server Error",
      });
    }
  });

  return router;
};

export default makeCatalogRouter(new SupabaseCatalogRepository(supabaseAdmin));
