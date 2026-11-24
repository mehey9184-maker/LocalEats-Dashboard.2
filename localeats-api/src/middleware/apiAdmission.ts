import type {Request,Response,RequestHandler,ErrorRequestHandler} from "express";
type Bucket={count:number;until:number};
type Decision={allowed:boolean;retryAfter:number};
export type AdmissionLimits={all:number;auth:number;read:number;write:number;quote:number;notifications:number;pushTest:number;maxKeys:number;windowMs:number};
export const DEFAULT_LIMITS:Readonly<AdmissionLimits>=Object.freeze({all:1200,auth:600,read:240,write:60,quote:60,notifications:30,pushTest:5,maxKeys:4096,windowMs:60000});
// Deliberately per warm process; no forwarded IP/header, no token-derived keys,
// no durable quota claims. Bounded storage, never evict a live budget to admit a new actor.
export function createWindowBudget(maxKeys:number,windowMs:number,now=Date.now){
 const buckets=new Map<string,Bucket>();let sweepAt=0;
 return {take(key:string,limit:number):Decision{
  const t=now();
  if(t>=sweepAt){for(const [k,b] of buckets)if(b.until<=t)buckets.delete(k);sweepAt=t+windowMs;}
  let b=buckets.get(key);
  if(b && b.until<=t){buckets.delete(key);b=undefined;}
  if(!b){
   if(buckets.size>=maxKeys){for(const [k,v] of buckets)if(v.until<=t)buckets.delete(k);}
   if(buckets.size>=maxKeys)return {allowed:false,retryAfter:Math.ceil(windowMs/1000)};
   b={count:0,until:t+windowMs};buckets.set(key,b);
  }
  if(b.count>=limit)return {allowed:false,retryAfter:Math.max(1,Math.ceil((b.until-t)/1000))};
  b.count++;return {allowed:true,retryAfter:0};
 },size:()=>buckets.size};
}
type Admission={beforeVerify:()=>boolean;afterVerify:(uid:string)=>boolean};
const deny=(res:Response,d:Decision):boolean=>{
 if(d.allowed)return true;
 res.set("Cache-Control","no-store").set("Retry-After",String(d.retryAfter)).status(429).json({success:false,code:"RATE_LIMITED",error:"Too many requests. Please try again later."});return false;
};
function category(req:Request):"read"|"write"|"quote"|"notifications"|"pushTest"{
 const path=req.originalUrl.split("?")[0].toLowerCase().replace(/\/+$/,"");
 if(path==="/api/v1/notifications")return "notifications";
 if(/^\/api\/v1\/push-subscriptions\/[^/]+\/test$/.test(path))return "pushTest";
 if(path==="/api/v1/orders/quote" && req.method==="POST")return "quote";
 return ["GET","HEAD"].includes(req.method)?"read":"write";
}
export function createApiAdmission(limits:AdmissionLimits={...DEFAULT_LIMITS},now=Date.now):RequestHandler{
 const shared=createWindowBudget(2,limits.windowMs,now),actors=createWindowBudget(limits.maxKeys,limits.windowMs,now);
 return (req,res,next)=>{
  if(req.method==="OPTIONS"){next();return;}
  if(!deny(res,shared.take("all",limits.all)))return;
  const admission:Admission={
   beforeVerify:()=>deny(res,shared.take("auth",limits.auth)),
   afterVerify:uid=>{
    if(typeof uid!=="string" || uid.length===0 || uid.length>128){res.status(401).json({success:false,error:"Unauthorized"});return false;}
    const kind=category(req);return deny(res,actors.take(kind+":"+uid,limits[kind]));
   }
  };
  res.locals.apiAdmission=admission;next();
 };
}
export function beforeFirebaseVerification(res:Response):boolean{
 return (res.locals.apiAdmission as Admission|undefined)?.beforeVerify()??true;
}
export function afterFirebaseVerification(res:Response,uid:string):boolean{
 return (res.locals.apiAdmission as Admission|undefined)?.afterVerify(uid)??true;
}
// Never echo body-parser errors, request contents, stack traces or provider payloads.
export const safeApiError:ErrorRequestHandler=(err,req,res,next)=>{
 void req;
 if(res.headersSent){next(new Error("API response interrupted"));return;}
 const type=typeof err==="object" && err!==null ? (err as {type?:unknown}).type:undefined;
 if(type==="entity.too.large"){res.status(413).json({success:false,code:"PAYLOAD_TOO_LARGE",error:"Request body too large."});return;}
 if(type==="entity.parse.failed" || type==="request.size.invalid" || type==="request.aborted"){res.status(400).json({success:false,code:"INVALID_JSON",error:"Invalid request body."});return;}
 if(type==="encoding.unsupported" || type==="charset.unsupported"){res.status(415).json({success:false,code:"UNSUPPORTED_ENCODING",error:"Unsupported request encoding."});return;}
 console.error("Unhandled API failure");
 res.status(500).json({success:false,error:"Internal Server Error"});
};
