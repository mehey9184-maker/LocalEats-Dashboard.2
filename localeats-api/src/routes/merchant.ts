import { Router, Response } from "express";
import { AuthenticatedRequest, authenticateFirebase } from "../middleware/authenticateFirebase.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const router = Router();

const ALLOWED_CREATE_FIELDS = new Set([
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
]);

const isValidTime = (value: unknown): value is string =>
  typeof value === "string" && /^([01]\d|2[0-3]):([0-5]\d)$/.test(value.trim());

type MerchantShopRecord = Record<string, unknown> & {
  id: string | number;
  approval_status?: unknown;
};

type MerchantAvailabilityRepositoryError = {
  message: string;
  code?: string;
};

interface MerchantAvailabilityRepository {
  findCurrentShops: (ownerId: string) => Promise<{
    data: MerchantShopRecord[];
    error: MerchantAvailabilityRepositoryError | null;
  }>;
  updateAvailability: (input: {
    shopId: string | number;
    ownerId: string;
    isActive: boolean;
  }) => Promise<{
    data: MerchantShopRecord | null;
    error: MerchantAvailabilityRepositoryError | null;
  }>;
}

const merchantAvailabilityRepository: MerchantAvailabilityRepository = {
  async findCurrentShops(ownerId) {
    const { data, error } = await supabaseAdmin
      .from("shops")
      .select("*")
      .eq("owner_id", ownerId)
      .is("archived_at", null);

    return {
      data: (data ?? []) as MerchantShopRecord[],
      error,
    };
  },

  async updateAvailability({ shopId, ownerId, isActive }) {
    let updateQuery = supabaseAdmin
      .from("shops")
      .update({ is_active: isActive })
      .eq("id", shopId)
      .eq("owner_id", ownerId)
      .is("archived_at", null);

    if (isActive) {
      updateQuery = updateQuery.eq("approval_status", "approved");
    }

    const { data, error } = await updateQuery
      .select("*")
      .maybeSingle();

    return {
      data: data as MerchantShopRecord | null,
      error,
    };
  },
};

interface MerchantAvailabilityRouterDependencies {
  authenticate: typeof authenticateFirebase;
  repository: MerchantAvailabilityRepository;
}

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const createMerchantAvailabilityRouter = (
  dependencies: Partial<MerchantAvailabilityRouterDependencies> = {}
): Router => {
  const availabilityRouter = Router();
  const authenticate = dependencies.authenticate ?? authenticateFirebase;
  const repository =
    dependencies.repository ?? merchantAvailabilityRepository;

  availabilityRouter.patch(
    "/shop/availability",
    authenticate,
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const uid = req.authUser?.uid;

      if (!uid) {
        res.status(401).json({ success: false, error: "Unauthorized" });
        return;
      }

      const body: unknown = req.body;
      if (
        !isObjectRecord(body) ||
        Object.keys(body).length !== 1 ||
        typeof body.is_active !== "boolean"
      ) {
        res.status(400).json({
          success: false,
          error: "Invalid availability request",
        });
        return;
      }

      try {
        const { data: shops, error: lookupError } =
          await repository.findCurrentShops(uid);

        if (lookupError) {
          console.error(
            "Supabase merchant availability shop lookup error:",
            lookupError
          );
          res.status(500).json({
            success: false,
            error: "Internal Server Error",
          });
          return;
        }

        if (shops.length === 0) {
          res.status(404).json({
            success: false,
            error: "Merchant shop not mapped",
          });
          return;
        }

        if (shops.length > 1) {
          res.status(409).json({
            success: false,
            error: "Multiple current shops mapped to merchant",
          });
          return;
        }

        const currentShop = shops[0];
        if (
          body.is_active &&
          currentShop.approval_status !== "approved"
        ) {
          res.status(409).json({
            success: false,
            error: "Shop must be approved before going online",
          });
          return;
        }

        const { data: updatedShop, error: updateError } =
          await repository.updateAvailability({
            shopId: currentShop.id,
            ownerId: uid,
            isActive: body.is_active,
          });

        if (updateError) {
          console.error(
            "Supabase merchant availability update error:",
            updateError
          );
          res.status(500).json({
            success: false,
            error: "Internal Server Error",
          });
          return;
        }

        if (!updatedShop) {
          res.status(409).json({
            success: false,
            error: "Shop availability state changed; retry",
          });
          return;
        }

        res.status(200).json({
          success: true,
          shop: updatedShop,
        });
      } catch (error) {
        console.error(
          "Unexpected merchant availability update error:",
          error
        );
        res.status(500).json({
          success: false,
          error: "Internal Server Error",
        });
      }
    }
  );

  return availabilityRouter;
};

router.use(createMerchantAvailabilityRouter());

router.get("/shop", authenticateFirebase, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const uid = req.authUser?.uid;

    if (!uid) {
      res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
      return;
    }

    const { data: shops, error } = await supabaseAdmin
      .from("shops")
      .select("*")
      .eq("owner_id", uid)
      .is("archived_at", null);

    if (error) {
      console.error("Supabase merchant shop query error:", error);

      res.status(500).json({
        success: false,
        error: "Internal Server Error",
      });
      return;
    }

    if (!shops || shops.length === 0) {
      res.status(404).json({
        success: false,
        error: "Merchant shop not mapped",
      });
      return;
    }

    if (shops.length > 1) {
      res.status(409).json({
        success: false,
        error: "Multiple current shops mapped to merchant",
      });
      return;
    }

    res.status(200).json({
      success: true,
      shop: shops[0],
    });
  } catch (err) {
    console.error("Error fetching merchant shop:", err);

    res.status(500).json({
      success: false,
      error: "Internal Server Error",
    });
  }
});

router.post("/shop", authenticateFirebase, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const uid = req.authUser?.uid;

    if (!uid) {
      res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
      return;
    }

    const body = req.body;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      res.status(400).json({
        success: false,
        error: "Invalid request body",
      });
      return;
    }

    for (const field of Object.keys(body)) {
      if (!ALLOWED_CREATE_FIELDS.has(field)) {
        res.status(400).json({
          success: false,
          error: `Field '${field}' is not allowed in request body`,
        });
        return;
      }
    }

    const name =
      typeof body.name === "string" ? body.name.trim() : "";

    const category =
      typeof body.category === "string" ? body.category.trim() : "";

    const description =
      typeof body.description === "string" ? body.description.trim() : "";

    const phone =
      typeof body.phone === "string" ? body.phone.trim() : "";

    const location =
      typeof body.location === "string" ? body.location.trim() : "";

    const story =
      typeof body.story === "string" ? body.story.trim() : "";

    const logoUrl =
      typeof body.logo_url === "string" ? body.logo_url.trim() : "";

    if (!name || name.length > 100) {
      res.status(400).json({
        success: false,
        error: "Invalid name",
      });
      return;
    }

    if (!category || category.length > 100) {
      res.status(400).json({
        success: false,
        error: "Invalid category",
      });
      return;
    }

    if (description.length > 500) {
      res.status(400).json({
        success: false,
        error: "Description too long",
      });
      return;
    }

    if (story.length > 1000) {
      res.status(400).json({
        success: false,
        error: "Story too long",
      });
      return;
    }

    if (!phone || phone.length > 20) {
      res.status(400).json({
        success: false,
        error: "Invalid phone",
      });
      return;
    }

    if (!location || location.length > 300) {
      res.status(400).json({
        success: false,
        error: "Invalid location",
      });
      return;
    }

    if (
      typeof body.latitude !== "number" ||
      !Number.isFinite(body.latitude) ||
      body.latitude < -90 ||
      body.latitude > 90
    ) {
      res.status(400).json({
        success: false,
        error: "Invalid latitude",
      });
      return;
    }

    if (
      typeof body.longitude !== "number" ||
      !Number.isFinite(body.longitude) ||
      body.longitude < -180 ||
      body.longitude > 180
    ) {
      res.status(400).json({
        success: false,
        error: "Invalid longitude",
      });
      return;
    }

    if (!isValidTime(body.opening_time)) {
      res.status(400).json({
        success: false,
        error: "Invalid opening_time (must be HH:MM)",
      });
      return;
    }

    if (!isValidTime(body.closing_time)) {
      res.status(400).json({
        success: false,
        error: "Invalid closing_time (must be HH:MM)",
      });
      return;
    }

    let parsedLogoUrl: URL;

    try {
      parsedLogoUrl = new URL(logoUrl);
    } catch {
      res.status(400).json({
        success: false,
        error: "Invalid logo_url",
      });
      return;
    }

    if (
      parsedLogoUrl.protocol !== "https:" ||
      parsedLogoUrl.hostname !== "res.cloudinary.com"
    ) {
      res.status(400).json({
        success: false,
        error: "logo_url must be a valid Cloudinary HTTPS URL",
      });
      return;
    }

    const {
      data: existingShops,
      error: existingError,
    } = await supabaseAdmin
      .from("shops")
      .select("id")
      .eq("owner_id", uid)
      .is("archived_at", null)
      .limit(1);

    if (existingError) {
      console.error(
        "Supabase merchant shop pre-check error:",
        existingError,
      );

      res.status(500).json({
        success: false,
        error: "Internal Server Error",
      });
      return;
    }

    if (existingShops && existingShops.length > 0) {
      res.status(409).json({
        success: false,
        error: "Merchant already has a current shop",
      });
      return;
    }

    const {
      data: newShop,
      error: insertError,
    } = await supabaseAdmin
      .from("shops")
      .insert({
        name,
        category,
        description,
        phone,
        location,

        latitude: body.latitude,
        longitude: body.longitude,

        lat: body.latitude,
        lng: body.longitude,

        opening_time: body.opening_time.trim(),
        closing_time: body.closing_time.trim(),

        logo_url: parsedLogoUrl.toString(),
        story,

        owner_id: uid,

        approval_status: "pending",
        approval_reason: null,

        archived_at: null,

        is_active: false,
      })
      .select("*")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        res.status(409).json({
          success: false,
          error: "Merchant already has a current shop",
        });
        return;
      }

      console.error(
        "Supabase merchant shop insert error:",
        insertError,
      );

      res.status(500).json({
        success: false,
        error: "Internal Server Error",
      });
      return;
    }

    res.status(201).json({
      success: true,
      shop: newShop,
    });
  } catch (err) {
    console.error(
      "Error creating merchant shop:",
      err,
    );

    res.status(500).json({
      success: false,
      error: "Internal Server Error",
    });
  }
});

export default router;
