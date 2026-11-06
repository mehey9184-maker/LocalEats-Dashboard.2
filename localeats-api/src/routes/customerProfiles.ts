import {Router, type RequestHandler} from "express";
import type {SupabaseClient} from "@supabase/supabase-js";
import {authenticateFirebase, type AuthenticatedRequest} from "../middleware/authenticateFirebase.js";
import {supabaseAdmin} from "../lib/supabaseAdmin.js";

// The only profile columns readable/writable by this route. Role, approval,
// user_id and updated_at are NEVER accepted as client-controlled fields.
export const PROFILE_FIELDS="user_id,fullName,email,phone,city,address,country,role,photo_url,language,latitude,longitude,favorites,updated_at";
const inputFields=new Set(["fullName","phone","city","address","country","photo_url","language","latitude","longitude","favorites"]);
type Profile=Record<string,unknown> & {user_id:string};
type Saved=Record<string,unknown>;

export interface ProfileStore {
  read(uid:string):Promise<Profile|null>;
  write(uid:string,email:string|null,data:Saved):Promise<Profile>;
}
const reject=(code:string):never=>{throw new Error(code);};
const stringField=(value:unknown,key:string,max:number):string|null=>{
  if(value===null)return null;
  if(typeof value!=="string")return reject("INVALID_"+key.toUpperCase());
  const trimmed=value.trim();
  if(trimmed.length>max)return reject("INVALID_"+key.toUpperCase());
  return trimmed||null;
};
export function parseProfileUpdate(body:unknown):Saved {
  if(!body||typeof body!=="object"||Array.isArray(body))return reject("INVALID_PROFILE");
  const input=body as Record<string,unknown>;
  const keys=Object.keys(input);
  if(!keys.length||keys.some(key=>!inputFields.has(key)))return reject("FORBIDDEN_PROFILE_FIELD");
  const out:Saved={};
  for(const key of keys){
    const v=input[key];
    if(["fullName","phone","city","address","country","photo_url","language"].includes(key)){
      out[key]=stringField(v,key,key==="address"?240:key==="photo_url"?400:key==="fullName"?120:100);
    }else if(key==="latitude"||key==="longitude"){
      if(v!==null&&(typeof v!=="number"||!Number.isFinite(v)||Math.abs(v)>(key==="latitude"?90:180)))
        return reject("INVALID_COORDINATES");
      out[key]=v;
    }else if(key==="favorites"){
      if(!Array.isArray(v)||v.length>100||v.some(z=>typeof z!=="string"||!z||z.length>128)||new Set(v).size!==v.length)
        return reject("INVALID_FAVORITES");
      out[key]=v;
    }
  }
  if("fullName" in out && (typeof out.fullName!=="string"||out.fullName.length<2))return reject("INVALID_FULLNAME");
  if("phone" in out && out.phone!==null){
    const v=String(out.phone).replace(/[\s()-]/g,"");
    if(!/^(?:\+27|0)[0-9]{9}$/.test(v))return reject("INVALID_PHONE");
    out.phone=v;
  }
  if("photo_url" in out && out.photo_url!==null){
    try{
      const u=new URL(String(out.photo_url));
      if(u.protocol!=="https:"||(u.hostname!=="res.cloudinary.com"&&!u.hostname.endsWith(".supabase.co")))
        return reject("INVALID_PHOTO_URL");
    }catch{return reject("INVALID_PHOTO_URL");}
  }
  if("latitude" in out || "longitude" in out){
    if(!("latitude" in out)||!("longitude" in out)||((out.latitude===null)!==(out.longitude===null)))
      return reject("INVALID_COORDINATE_PAIR");
  }
  return out;
}

export class SupabaseProfileStore implements ProfileStore {
  constructor(private readonly db:Pick<SupabaseClient,"from">){}
  async read(uid:string):Promise<Profile|null>{
    const {data,error}=await this.db.from("profiles").select(PROFILE_FIELDS).eq("user_id",uid).maybeSingle();
    if(error)throw Error("PROFILE_READ_UNAVAILABLE");
    if(!data)return null;
    if(data.user_id!==uid)throw Error("PROFILE_SCOPE_MISMATCH");
    return data as Profile;
  }
  async write(uid:string,email:string|null,data:Saved):Promise<Profile>{
    const record:Saved={...data,user_id:uid,updated_at:new Date().toISOString()};
    if(email!==null)record.email=email;
    const result=await this.db.from("profiles").upsert(record,{onConflict:"user_id"}).select(PROFILE_FIELDS).single();
    if(result.error||!result.data)throw Error("PROFILE_SAVE_UNAVAILABLE");
    if(result.data.user_id!==uid)throw Error("PROFILE_SCOPE_MISMATCH");
    for(const key of Object.keys(data)){
      if(JSON.stringify(result.data[key])!==JSON.stringify(data[key]))throw Error("PROFILE_SAVE_UNCONFIRMED");
    }
    return result.data as Profile;
  }
}

export const profileWritesEnabled=()=>process.env.PROFILE_WRITES_ENABLED==="true";
type Options={store:ProfileStore; authenticate?:RequestHandler; writesEnabled?:()=>boolean};
export function makeCustomerProfilesRouter(options:Options){
  const router=Router();
  router.use((_req,res,next)=>{res.set("Cache-Control","no-store");next();});
  router.use(options.authenticate??authenticateFirebase);
  router.use((req:AuthenticatedRequest,res,next)=>{
    if(!req.authUser?.uid||req.authUser.isAnonymous===true){
      res.status(401).json({success:false,code:"REGISTERED_ACCOUNT_REQUIRED"});return;
    }
    next();
  });
  router.get("/me",async(req:AuthenticatedRequest,res)=>{
    try{
      const uid=req.authUser!.uid;
      const profile=await options.store.read(uid);
      if(!profile){res.status(404).json({success:false,code:"PROFILE_NOT_FOUND"});return;}
      res.status(200).json({success:true,profile});
    }catch{res.status(503).json({success:false,code:"PROFILE_READ_UNAVAILABLE"});}
  });
  router.post("/me",async(req:AuthenticatedRequest,res)=>{
    if(!(options.writesEnabled??profileWritesEnabled)()){
      res.status(503).json({success:false,code:"PROFILE_WRITES_DISABLED",
        error:"Profile saving is not activated yet. No data was saved."});return;
    }
    let update:Saved;
    try{update=parseProfileUpdate(req.body);}
    catch(e){
      const code=e instanceof Error?e.message:"INVALID_PROFILE";
      res.status(code==="FORBIDDEN_PROFILE_FIELD"?403:400).json({success:false,code});return;
    }
    try{
      const uid=req.authUser!.uid;
      const profile=await options.store.write(uid,req.authUser!.email,update);
      if(!profile||profile.user_id!==uid){
        res.status(503).json({success:false,code:"PROFILE_SAVE_UNCONFIRMED"});return;
      }
      res.status(200).json({success:true,profile});
    }catch{res.status(503).json({success:false,code:"PROFILE_SAVE_UNCONFIRMED"});}
  });
  return router;
}
export const customerProfilesRouter=makeCustomerProfilesRouter({store:new SupabaseProfileStore(supabaseAdmin)});
