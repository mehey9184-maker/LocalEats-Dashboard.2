import type { Express, NextFunction, Request, Response } from "express";

export const configureApiCacheSafety = (app: Express): void => {
  app.disable("etag");
  app.use("/api/v1", (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
};
