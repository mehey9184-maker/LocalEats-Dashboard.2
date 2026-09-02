import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";

import healthRoutes from "./routes/health.js";
import merchantRoutes from "./routes/merchant.js";
import adminRoutes from "./routes/admin.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// CORS configuration
const isAllowedOrigin = (origin?: string): boolean => {
  if (origin === undefined) return true;

  const productionOrigin = process.env.MERCHANT_DASHBOARD_ORIGIN;
  if (productionOrigin && origin === productionOrigin) return true;

  const previewHostPrefix = process.env.MERCHANT_DASHBOARD_PREVIEW_HOST_PREFIX;
  const previewHostSuffix = process.env.MERCHANT_DASHBOARD_PREVIEW_HOST_SUFFIX;
  if (!previewHostPrefix || !previewHostSuffix) return false;

  try {
    const parsedOrigin = new URL(origin);
    return parsedOrigin.origin === origin
      && parsedOrigin.protocol === "https:"
      && parsedOrigin.hostname.startsWith(previewHostPrefix)
      && parsedOrigin.hostname.endsWith(previewHostSuffix);
  } catch {
    return false;
  }
};

app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Routes
app.use("/health", healthRoutes);
app.use("/api/v1/merchant", merchantRoutes);
app.use("/api/v1/admin", adminRoutes);

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, error: "Not Found" });
});

// Generic Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, error: "Internal Server Error" });
});

export default app;
