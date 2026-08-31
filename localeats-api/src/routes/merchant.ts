import { Router, Response } from "express";
import { AuthenticatedRequest, authenticateFirebase } from "../middleware/authenticateFirebase.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const router = Router();

router.get("/shop", authenticateFirebase, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const uid = req.authUser?.uid;
    if (!uid) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const { data: shops, error } = await supabaseAdmin
      .from("shops")
      .select("*")
      .eq("owner_id", uid);

    if (error) {
      console.error("Supabase query error:", error);
      res.status(500).json({ success: false, error: "Internal Server Error" });
      return;
    }

    if (!shops || shops.length === 0) {
      res.status(404).json({ success: false, error: "Merchant shop not mapped" });
      return;
    }

    if (shops.length > 1) {
      res.status(409).json({ success: false, error: "Multiple shops mapped to merchant" });
      return;
    }

    res.status(200).json({ success: true, shop: shops[0] });
  } catch (err) {
    console.error("Error fetching merchant shop:", err);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

export default router;
