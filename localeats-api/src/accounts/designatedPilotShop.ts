/** Server-only, read-only designation for the isolated single-shop pilot. */
type PilotShop = {id?:unknown;owner_id?:unknown;approval_status?:unknown;archived_at?:unknown};
type Resolution<T> = {mode:'off'} | {mode:'selected';shop:T} |
 {mode:'denied';status:403|503;code:'PILOT_SHOP_UNAVAILABLE'|'PILOT_CONFIGURATION_INVALID'};
const identifier=(value:unknown):value is string => typeof value==='string' &&
 value.length>0 && value.length<=128 && value.trim()===value && !/[\x00-\x1f/\\]/.test(value);
export function resolveDesignatedPilotShop<T extends PilotShop>(
 shops:readonly T[],uid:string,env:NodeJS.ProcessEnv=process.env,
):Resolution<T> {
 const flag=env.MERCHANT_DESIGNATED_PILOT_ONLY;
 if(flag===undefined || flag==='false')return {mode:'off'};
 const invalid=():Resolution<T>=>({mode:'denied',status:503,code:'PILOT_CONFIGURATION_INVALID'});
 if(flag!=='true' || env.VERCEL_ENV!=='preview' || env.LOCALEATS_STAGING_ONLY!=='true' ||
    env.FIREBASE_PROJECT_ID!=='localeats-staging' ||
    env.SUPABASE_URL!=='https://rgpbdajhlrwfmhopzgzk.supabase.co' ||
    ['PICKUP_WRITES_ENABLED','PROFILE_WRITES_ENABLED','MERCHANT_AVAILABILITY_WRITES_ENABLED','MERCHANT_ACCOUNT_WRITES_ENABLED']
      .some(key=>env[key]!=='false'))return invalid();
 let map:Record<string,unknown>;
 try {
  const raw=env.MERCHANT_PILOT_DESIGNATIONS;
  if(!raw || raw.length>32768)return invalid();
  const parsed:unknown=JSON.parse(raw);
  if(!parsed || typeof parsed!=='object' || Array.isArray(parsed))return invalid();
  map=parsed as Record<string,unknown>;
  const entries=Object.entries(map);
  if(entries.length>100 || entries.some(([key,value])=>!identifier(key)||!identifier(value)))return invalid();
 }catch{return invalid();}
 const denied:Resolution<T>={mode:'denied',status:403,code:'PILOT_SHOP_UNAVAILABLE'};
 if(!identifier(uid) || !Object.hasOwn(map,uid))return denied;
 const matches=shops.filter(shop=>String(shop.id)===map[uid]);
 if(matches.length!==1)return denied;
 const shop=matches[0];
 if(shop.owner_id!==uid || shop.approval_status!=='approved' || shop.archived_at!==null)return denied;
 return {mode:'selected',shop};
}
