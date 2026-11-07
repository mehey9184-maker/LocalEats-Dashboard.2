import type {RequestHandler} from "express";

/**
 * Preview deployments can share read credentials with live data.
 * They MUST NOT become accidentally write-capable. Preview is not isolation.
 */
export const isReadOnlyPreviewMode=():boolean=>
  process.env.VERCEL_ENV === "preview" || process.env.LOCALEATS_PREVIEW_READ_ONLY === "true";

export const previewReadOnlyGate:RequestHandler=(req,res,next)=>{
  if (!isReadOnlyPreviewMode()) { next(); return; }
  // GET/HEAD /api/v1/notifications now skip outbox claim, completion and FCM
  // in Preview. The persisted, account-scoped inbox is truly read-only there.
  if(!["POST","PUT","PATCH","DELETE"].includes(req.method.toUpperCase())) {
    next();return;
  }
  res.status(503).set("Cache-Control","no-store").json({
    success:false,
    code:"PREVIEW_READ_ONLY",
    error:"This LocalEats API Preview is read-only. No changes or payments were saved."
  });
};
