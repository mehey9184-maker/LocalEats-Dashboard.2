import type {RequestHandler} from "express";
export const legacyOrderGuard:RequestHandler=(req,res,next)=>{
 const mutation=["POST","PUT","PATCH","DELETE"].includes(req.method);
 const oldAlias=/^\/api\/orders(?:\/|$)/i.test(req.path);
 const generic=/^\/api\/v1\/(?:merchant\/)?orders\/[^/]+\/?$/i.test(req.path) && ["PUT","PATCH","DELETE"].includes(req.method);
 const oldAccept=req.method==="POST" && /^\/api\/v1\/orders\/[^/]+\/accept\/?$/i.test(req.path);
 if(mutation && (oldAlias || generic || oldAccept)){
  res.status(426).set("Cache-Control","no-store").json({success:false,code:"PICKUP_CONTRACT_REQUIRED",
   error:"Update required. Use the pickup ordering app."});return;
 }
 next();
};
