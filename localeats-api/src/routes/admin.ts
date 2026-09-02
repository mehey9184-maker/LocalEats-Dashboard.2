import { Router, Response } from "express";
import { authenticateAdminFirebase } from "../middleware/authenticateAdminFirebase.js";
import {
  authorizeSuperAdmin,
  SuperAdminRequest,
} from "../middleware/authorizeSuperAdmin.js";

const router = Router();

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

export default router;
