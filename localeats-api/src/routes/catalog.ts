import {effectiveShop} from "../orders/shopAvailability.js";
import { Router, Request, Response } from "express";
import {calculateDistanceKm} from "../orders/orderContract.js";

import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const PUBLIC_SHOP_FIELDS = "effective_is_active,availability_revision,availability_override_until,id,name,description,location,category,logo_url,rating,opening_time,closing_time,is_active,latitude,longitude,lat,lng,story";
const PUBLIC_MENU_FIELDS = "id,shop_id,name,price,description,image_url,category,is_available,popularity_score,customizations,created_at";

type CatalogRow = Record<string, unknown>;
type CatalogResult = {data: unknown; error: unknown};
type CatalogQuery = PromiseLike<CatalogResult> & {
  select(columns: string): CatalogQuery;
  eq(field: string, value: unknown): CatalogQuery;
  is(field: string, value: null): CatalogQuery;
  maybeSingle(): PromiseLike<CatalogResult>;
};
type CatalogDatabase = { from(table: string): unknown };
const catalogRows = (value: unknown): CatalogRow[] => {
  if (!Array.isArray(value)) throw new Error("CATALOG_ROWS_INVALID");
  return value.map(row => {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("CATALOG_ROW_INVALID");
    return row as CatalogRow;
  });
};
const catalogRow = (value: unknown): CatalogRow | null => {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("CATALOG_ROW_INVALID");
  return value as CatalogRow;
};
export interface CatalogRepository {
  getApprovedShops(): Promise<CatalogRow[]>;
  getApprovedShopById(shopId: string): Promise<CatalogRow | null>;
  getMenuByShopId(shopId: string): Promise<CatalogRow[]>;
}

export class SupabaseCatalogRepository implements CatalogRepository {
  constructor(private readonly supabase: CatalogDatabase) {}
  private from(table: string): CatalogQuery {
    return this.supabase.from(table) as CatalogQuery;
  }
  async getApprovedShops(): Promise<CatalogRow[]> {
    const { data, error } = await this.from("shops_with_availability")
      .select(PUBLIC_SHOP_FIELDS).eq("approval_status", "approved").is("archived_at", null);
    if (error) throw error;
    return catalogRows(data ?? []).map(effectiveShop);
  }
  async getApprovedShopById(shopId: string): Promise<CatalogRow | null> {
    const { data, error } = await this.from("shops_with_availability")
      .select(PUBLIC_SHOP_FIELDS).eq("id", shopId).eq("approval_status", "approved")
      .is("archived_at", null).maybeSingle();
    if (error) throw error;
    const shop = catalogRow(data);
    return shop ? effectiveShop(shop) : null;
  }
  async getMenuByShopId(shopId: string): Promise<CatalogRow[]> {
    const { data, error } = await this.from("menu_items")
      .select(PUBLIC_MENU_FIELDS).eq("shop_id", shopId);
    if (error) throw error;
    return catalogRows(data ?? []);
  }
}

/**
 * Optional PUBLIC_CATALOG_PILOT_SHOP_IDS (comma separated IDs).
 * Absent: existing approved/nonarchived catalog behavior.
 * Present but empty/invalid: publish no shops (fail closed, never all shops).
 * This controls public discovery only; it is NOT an order-admission gate.
 */
export function parsePublicCatalogPilotIds(value:string|undefined):ReadonlySet<string>|null {
  if(value===undefined)return null;
  return new Set(value.split(",").map(id=>id.trim())
    .filter(id=>/^[A-Za-z0-9_-]{1,128}$/.test(id)));
}

export const makeCatalogRouter = (
  repository: CatalogRepository,
  pilotIds:ReadonlySet<string>|null=parsePublicCatalogPilotIds(process.env.PUBLIC_CATALOG_PILOT_SHOP_IDS)
): Router => {
  const router = Router();
  const isPublished = (id:unknown):boolean =>
    typeof id==="string" && (pilotIds===null || pilotIds.has(id));

  router.get("/pickup-shops", async (req:Request,res:Response):Promise<void>=>{
    const rawLat=req.query.lat,rawLng=req.query.lng;
    const numberText=/^-?\d+(?:\.\d+)?$/;
    if(typeof rawLat!=="string" || typeof rawLng!=="string" || !numberText.test(rawLat) || !numberText.test(rawLng) ||
      !Number.isFinite(Number(rawLat)) || Math.abs(Number(rawLat))>90 || !Number.isFinite(Number(rawLng)) || Math.abs(Number(rawLng))>180) {
      res.status(400).json({success:false,code:"INVALID_COORDINATES",error:"Your real location is required."});return;
    }
    try {
      const shops=(await repository.getApprovedShops()).flatMap(shop=>{
        if(!isPublished(shop.id))return [];
        const lat=shop.lat ?? shop.latitude,lng=shop.lng ?? shop.longitude;
        // Approved closed shops remain discoverable for menu browsing, but
        // pickup quote/create still require the authoritative open state.
        if(typeof shop.is_active!=="boolean" || typeof lat!=="number" ||
          !Number.isFinite(lat) || Math.abs(lat)>90 || typeof lng!=="number" || !Number.isFinite(lng) || Math.abs(lng)>180)return [];
        const distance_km=calculateDistanceKm(Number(rawLat),Number(rawLng),lat,lng);
        return distance_km<=4 ? [{...shop,distance_km}] : [];
      }).sort((a,b)=>a.distance_km-b.distance_km);
      res.json({success:true,shops});
    }catch {res.status(503).json({success:false,error:"Pickup shops could not be loaded."});}
  });

  router.get("/shops", async (req: Request, res: Response): Promise<void> => {
    try {
      const shops = (await repository.getApprovedShops()).filter(shop=>isPublished(shop.id));
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

      const shop = isPublished(shopId.trim()) ? await repository.getApprovedShopById(shopId.trim()) : null;

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
      const shop = isPublished(shopId.trim()) ? await repository.getApprovedShopById(shopId.trim()) : null;

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
