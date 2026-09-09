import { Response, NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { AuthenticatedRequest } from "./authenticateFirebase.js";

export interface SuperAdminRequest extends AuthenticatedRequest {
  adminUser?: {
    firebase_uid: string;
    role: "super_admin";
  };
}

export const authorizeSuperAdmin = async (
  req: SuperAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const uid = req.authUser?.uid;
  if (!uid) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  try {
    const { data: adminUser, error } = await supabaseAdmin
      .from("admin_users")
      .select("firebase_uid, role")
      .eq("firebase_uid", uid)
      .eq("role", "super_admin")
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("Supabase admin authorization query error:", error);
      res.status(500).json({
        success: false,
        error: "Internal Server Error",
      });
      return;
    }

    if (
      !adminUser ||
      adminUser.firebase_uid !== uid ||
      adminUser.role !== "super_admin"
    ) {
      res.status(403).json({ success: false, error: "Forbidden" });
      return;
    }

    req.adminUser = {
      firebase_uid: adminUser.firebase_uid,
      role: "super_admin",
    };

    next();
  } catch (error) {
    console.error("Unexpected admin authorization error:", error);
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
    });
  }
};
