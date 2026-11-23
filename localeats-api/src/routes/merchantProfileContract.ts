/**
 * L4-R1E: Only these fields may be persisted by a verified merchant.
 * Availability, approval, roles, locations, payouts, and rider settings are never profile fields.
 */
export type MerchantAccountFields={
  full_name:string;phone:string;avatar_url:string;marketing_opt_in:boolean;dark_mode:boolean;
};
export type MerchantShopFields={
  name:string;description:string;category:string;phone:string;logo_url:string;
  opening_time:string;closing_time:string;
};
export type MerchantPatch<T>={expected_revision:number;changes:Partial<T>};
export class MerchantProfileInputError extends Error {constructor(public readonly code:string){super(code);}}
const invalid=(code:string):never=>{throw new MerchantProfileInputError(code);};
const record=(body:unknown):Record<string,unknown>=>{
  if(!body || typeof body!=="object" || Array.isArray(body))return invalid("INVALID_PROFILE_REQUEST");
  return body as Record<string,unknown>;
};
const revision=(input:Record<string,unknown>):number=>{
  const value=input.expected_revision;
  if(typeof value!=="number" || !Number.isSafeInteger(value) || value<0 || value>=Number.MAX_SAFE_INTEGER)
    return invalid("INVALID_PROFILE_REVISION");
  return value;
};
const nonControl=(input:string):boolean=>![...input].some(c=>{const n=c.charCodeAt(0);return n<32 || n===127;});
const text=(value:unknown,limit:number,required=false):string=>{
  if(typeof value!=="string")return invalid("INVALID_PROFILE_TEXT");
  const cleaned=value.trim();
  if(cleaned.length>limit || !nonControl(cleaned) || (required && !cleaned))return invalid("INVALID_PROFILE_TEXT");
  return cleaned;
};
const phone=(v:unknown):string=>{
 const value=text(v,24).replace(/[\s-]/g,"");
 if(value && !/^(?:\+27|0)[0-9]{9}$/.test(value))return invalid("INVALID_PROFILE_PHONE");
 return value;
};
const imageUrl=(v:unknown):string=>{
 const value=text(v,600);
 if(!value)return "";
 let url:URL;
 try{url=new URL(value);}catch{return invalid("INVALID_PROFILE_IMAGE_URL");}
 if(url.protocol!=="https:" || !!url.username || !!url.password || url.hash || value!==url.href)
  return invalid("INVALID_PROFILE_IMAGE_URL");
 return value;
};
const time=(v:unknown):string=>{
 const value=text(v,5,true);
 if(!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value))return invalid("INVALID_PROFILE_TIME");
 return value;
};
export function parseMerchantAccountPatch(body:unknown):MerchantPatch<MerchantAccountFields>{
 const input=record(body),fields=["full_name","phone","avatar_url","marketing_opt_in","dark_mode"];
 if(Object.keys(input).some(k=>k!=="expected_revision" && !fields.includes(k)) ||
    !fields.some(k=>Object.hasOwn(input,k)))return invalid("FORBIDDEN_PROFILE_FIELD");
 const changes:Partial<MerchantAccountFields>={};
 if(Object.hasOwn(input,"full_name"))changes.full_name=text(input.full_name,120);
 if(Object.hasOwn(input,"phone"))changes.phone=phone(input.phone);
 if(Object.hasOwn(input,"avatar_url"))changes.avatar_url=imageUrl(input.avatar_url);
 if(Object.hasOwn(input,"marketing_opt_in")){if(typeof input.marketing_opt_in!=="boolean")return invalid("INVALID_PROFILE_FLAG");changes.marketing_opt_in=input.marketing_opt_in;}
 if(Object.hasOwn(input,"dark_mode")){if(typeof input.dark_mode!=="boolean")return invalid("INVALID_PROFILE_FLAG");changes.dark_mode=input.dark_mode;}
 return {expected_revision:revision(input),changes};
}
export function parseMerchantShopPatch(body:unknown):MerchantPatch<MerchantShopFields> & {shop_id:string}{
 const input=record(body),fields=["name","description","category","phone","logo_url","opening_time","closing_time"];
 if(Object.keys(input).some(k=>!["shop_id","expected_revision",...fields].includes(k)) ||
    !fields.some(k=>Object.hasOwn(input,k)))return invalid("FORBIDDEN_PROFILE_FIELD");
 if(typeof input.shop_id!=="string" || !/^[A-Za-z0-9_-]{1,128}$/.test(input.shop_id))return invalid("INVALID_SHOP_ID");
 const changes:Partial<MerchantShopFields>={};
 if(Object.hasOwn(input,"name"))changes.name=text(input.name,100,true);
 if(Object.hasOwn(input,"description"))changes.description=text(input.description,500);
 if(Object.hasOwn(input,"category"))changes.category=text(input.category,100,true);
 if(Object.hasOwn(input,"phone"))changes.phone=phone(input.phone);
 if(Object.hasOwn(input,"logo_url"))changes.logo_url=imageUrl(input.logo_url);
 if(Object.hasOwn(input,"opening_time"))changes.opening_time=time(input.opening_time);
 if(Object.hasOwn(input,"closing_time"))changes.closing_time=time(input.closing_time);
 return {shop_id:input.shop_id,expected_revision:revision(input),changes};
}
export function profileRevision(value:unknown):value is number{
 return typeof value==="number" && Number.isSafeInteger(value) && value>=0 && value<Number.MAX_SAFE_INTEGER;
}
