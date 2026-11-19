import {legacyOrderGuard} from "./legacyOrderGuard.js";
import {pickupNotificationRoutes} from "./routes/pickupNotifications.js";
import {pickupWriteGate} from "./middleware/pickupWriteGate.js";
import { previewReadOnlyGate } from "./middleware/previewReadOnlyGate.js";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";

import healthRoutes from "./routes/health.js";
import merchantRoutes from "./routes/merchant.js";
import adminRoutes from "./routes/admin.js";
import catalogRoutes from "./routes/catalog.js";
import privateMyKotaTestRoutes from "./routes/privateMyKotaTest.js";
import { customerOrderRoutes, merchantOrderRoutes } from "./routes/orders.js";
import riderOrderRoutes from "./routes/riderOrders.js";
import { riderRouter, merchantRiderRouter } from "./routes/riderAccess.js";
import { isAllowedOrigin } from "./corsOrigins.js";
import { customerProfilesRouter } from "./routes/customerProfiles.js";
import { configureApiCacheSafety } from "./middleware/apiCacheSafety.js";

dotenv.config();

const app = express();

configureApiCacheSafety(app);

app.use((req,res,next)=>{
  if(!isAllowedOrigin(req.headers.origin)) {
    res.status(403).json({success:false,code:"CORS_ORIGIN_DENIED",error:"Origin is not allowed."});return;
  }
  next();
});
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  // The authenticated FCM browser installation endpoint requires PUT.
  // CORS only permits the preflight; Firebase auth and shop ownership still
  // authorize the actual write on the API.
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(previewReadOnlyGate);
app.use(legacyOrderGuard);
app.use(pickupWriteGate);
app.use(express.json());

// Routes
app.use("/health", healthRoutes);
app.use("/api/v1/merchant", merchantRoutes);
app.use("/api/v1/orders", customerOrderRoutes);
app.use("/api/v1/merchant/orders", merchantOrderRoutes);
app.use("/api/v1/rider/orders", riderOrderRoutes);
app.use("/api/v1/rider", riderRouter);
app.use("/api/v1/merchant/riders", merchantRiderRouter);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/catalog", catalogRoutes);
// Isolated authenticated test fixture; never part of public catalog or orders.
app.use("/api/v1/private-test/my-kota", privateMyKotaTestRoutes);
app.use("/api/v1/profiles", customerProfilesRouter);
app.use("/api/v1", pickupNotificationRoutes);

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, error: "Not Found" });
});

// Generic Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  // Express requires the four-argument error middleware signature.
  void req; void next;
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, error: "Internal Server Error" });
});

export default app;
