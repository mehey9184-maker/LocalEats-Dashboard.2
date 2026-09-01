import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";

import healthRoutes from "./routes/health.js";
import merchantRoutes from "./routes/merchant.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// CORS configuration
const allowedOrigins = process.env.MERCHANT_DASHBOARD_ORIGIN 
  ? [process.env.MERCHANT_DASHBOARD_ORIGIN] 
  : [];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
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

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, error: "Not Found" });
});

// Generic Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, error: "Internal Server Error" });
});

app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`LocalEats API listening on port ${PORT}`);
});
