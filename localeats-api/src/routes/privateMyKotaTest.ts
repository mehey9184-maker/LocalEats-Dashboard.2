import {Router, type Request, type Response} from "express";
import {authAdmin} from "../lib/firebaseAdmin.js";
import {getFirebaseBearerToken} from "../middleware/authenticateFirebase.js";
import {calculateDistanceKm} from "../orders/orderContract.js";

/** Preview-only virtual shop. Never insert into Production/staging shops,
 * expose via public catalog routes, or allow its ID to reach real checkout.
 */
export const PRIVATE_MY_KOTA_SHOP_ID="private-test-my-kota-preview";
const MY_KOTA_POINT={lat:-25.9830322643032,lng:28.2074831464466};
const DEMO_SHOP={
  id:PRIVATE_MY_KOTA_SHOP_ID,name:"My-Kota — PRIVATE TEST",
  description:"SAMPLE LISTING · No real orders or payments. Sample prices and menu only.",
  location:"TEST PREVIEW — near My-Kota, Ivory Park",
  category:"Kota",logo_url:"",rating:null,
  opening_time:null,closing_time:null,
  is_active:true,lat:MY_KOTA_POINT.lat,lng:MY_KOTA_POINT.lng,
  latitude:MY_KOTA_POINT.lat,longitude:MY_KOTA_POINT.lng,
  test_only:true
};
const DEMO_MENU=[
  {id:"private-mykota-demo-kota",shop_id:PRIVATE_MY_KOTA_SHOP_ID,
   name:"SAMPLE Kota (test only)",price:25,description:"Sample item, not for sale.",
   image_url:"",category:"Kota",is_available:true,test_only:true},
  {id:"private-mykota-demo-chips",shop_id:PRIVATE_MY_KOTA_SHOP_ID,
   name:"SAMPLE Chips (test only)",price:15,description:"Sample item, not for sale.",
   image_url:"",category:"Sides",is_available:true,test_only:true}
];

export type PrivateMyKotaEnv={
  VERCEL_ENV?:string;LOCALEATS_STAGING_ONLY?:string;PICKUP_WRITES_ENABLED?:string;
  SUPABASE_URL?:string;FIREBASE_PROJECT_ID?:string;PRIVATE_MYKOTA_TEST_ENABLED?:string;
  PRIVATE_MYKOTA_TEST_UID?:string;PRIVATE_MYKOTA_TEST_ORIGIN?:string;
  PRIVATE_MYKOTA_TEST_EXPIRES_AT?:string;
};
export function privateMyKotaConfig(env:PrivateMyKotaEnv=process.env,now=Date.now()){
  const origin=env.PRIVATE_MYKOTA_TEST_ORIGIN||"";
  let allowedOrigin=false;
  try{
    const u=new URL(origin);
    allowedOrigin=u.origin===origin && u.protocol==="https:" &&
      /^localeats-customer-staging-r52d(?:-[a-z0-9-]+)?\.vercel\.app$/.test(u.hostname);
  }catch{/* default denied */}
  const expires=Date.parse(env.PRIVATE_MYKOTA_TEST_EXPIRES_AT||"");
  const validExpiry=Number.isFinite(expires)&&expires>now&&expires<=now+30*86400000;
  const uid=env.PRIVATE_MYKOTA_TEST_UID||"";
  const enabled=env.PRIVATE_MYKOTA_TEST_ENABLED==="true" &&
    env.VERCEL_ENV==="preview" && env.LOCALEATS_STAGING_ONLY==="true" &&
    env.PICKUP_WRITES_ENABLED==="false" &&
    env.SUPABASE_URL==="https://rgpbdajhlrwfmhopzgzk.supabase.co" &&
    env.FIREBASE_PROJECT_ID==="localeats-staging" &&
    /^[A-Za-z0-9_-]{20,128}$/.test(uid) && allowedOrigin && validExpiry;
  return {enabled,uid,origin,expires};
}
export function privateMyKotaCorsAllowed(origin:string|undefined,env:PrivateMyKotaEnv=process.env){
  const config=privateMyKotaConfig(env);
  return config.enabled && typeof origin==="string" && origin===config.origin;
}

function coordinates(req:Request){
  if(req.query.mode==="simulated")return {...MY_KOTA_POINT,simulated:true};
  if(req.query.mode!=="real")return null;
  const lat=req.query.lat,lng=req.query.lng;
  const numeric=/^-?(?:\d+)(?:\.\d+)?$/;
  if(typeof lat!=="string"||typeof lng!=="string"||!numeric.test(lat)||!numeric.test(lng))return null;
  const a=Number(lat),b=Number(lng);
  if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a)>90||Math.abs(b)>180)return null;
  return {lat:a,lng:b,simulated:false};
}
type VerifyUid=(token:string)=>Promise<{uid:string;firebase?:{sign_in_provider?:string}}>;
export function makePrivateMyKotaRouter(verify:VerifyUid=token=>authAdmin.verifyIdToken(token,true),
  env:PrivateMyKotaEnv=process.env,now:()=>number=Date.now){
  const router=Router();
  router.use(async(req:Request,res:Response,next)=>{
    res.set("Cache-Control","private, no-store, max-age=0");
    res.set("Vary","Authorization, Origin");
    const config=privateMyKotaConfig(env,now());
    if(!config.enabled || req.headers.origin!==config.origin){
      res.status(404).json({success:false,code:"NOT_FOUND"});return;
    }
    const token=getFirebaseBearerToken(req.headers.authorization);
    if(!token){res.status(404).json({success:false,code:"NOT_FOUND"});return;}
    try{
      const user=await verify(token);
      if(user.uid!==config.uid||user.firebase?.sign_in_provider==="anonymous"){
        res.status(404).json({success:false,code:"NOT_FOUND"});return;
      }
      next();
    }catch{res.status(404).json({success:false,code:"NOT_FOUND"});}
  });
  router.get("/status",(_req,res)=>res.json({success:true,eligible:true,
    mode:"PRIVATE_TEST_ONLY",maximum_distance_km:4}));
  router.get("/shop",(req,res)=>{
    const point=coordinates(req);
    if(!point){res.status(400).json({success:false,code:"INVALID_TEST_LOCATION"});return;}
    const distance=calculateDistanceKm(point.lat,point.lng,MY_KOTA_POINT.lat,MY_KOTA_POINT.lng);
    if(distance>4){res.status(422).json({success:false,code:"OUTSIDE_PICKUP_RADIUS"});return;}
    res.json({success:true,shop:{...DEMO_SHOP,distance_km:distance},
      menu_items:DEMO_MENU.map(item=>({...item})),
      simulated_location:point.simulated,preview_only:true,can_submit:false});
  });
  return router;
}

export default makePrivateMyKotaRouter();
