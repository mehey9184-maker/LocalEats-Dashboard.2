import type {RequestHandler} from "express";

/**
 * A Preview deployment can share read credentials with the live database.
 * It MUST NOT become an accidental write-capable API.
 *
 * VERCEL_ENV is set by Vercel. Production and local development are
 * deliberately unchanged; Preview blocks *all* mutation verbs before routes.
 * Do not rely on this guard as a substitute for isolated staging credentials.
 */
export const previewReadOnlyGate:RequestHandler=(req,res,next)=>{
  if(process.env.VERCEL_ENV !== "preview" && process.env.LOCALEATS_PREVIEW_READ_ONLY !== "true") { next(); return; }
  const method=req.method.toUpperCase();
  if(!["POST","PUT","PATCH","DELETE"].includes(method)) {next();return;}
  res.status(503).set("Cache-Control","no-store").json({
    success:false,
    code:"PREVIEW_READ_ONLY",
    error:"This LocalEats API Preview is read-only. No changes or payments were saved."
  });
};
