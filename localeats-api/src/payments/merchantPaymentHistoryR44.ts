/**
 * R4.4 REVIEW-ONLY server contract.
 *
 * No HTTP route imports or registers this module yet. No DB credentials,
 * hosted reads, payment updates, production flags or real Firebase calls.
 * Dependencies must come from server-only adapters after an approved staging
 * schema and authoritative legacy shop mapping exist.
 */
export type VerifiedPaymentPrincipal = {uid:string; isAnonymous?:boolean};
export type OwnedPaymentShop = {
  id:string;owner_id:string;approval_status:string;archived_at:string|null;
};
export type LegacyPaymentMapping = {
  shopId:string; ownerUid:string; legacyShopId:string;
  provenance:"verified_legacy_payment_mapping";
};
export type PaymentRow = {
  id:string;shop_id:string|number|null;amount:string|number;
  status:string;payment_method:string;payment_date:string|null;
  [key:string]:unknown;
};
export type PaymentPage = {
  payments:Array<{id:string;amount:string;status:string;payment_method:string;payment_date:string|null}>;
  next_offset:number|null;
};
export type PaymentHistoryDeps = {
  verifyFirebase:(token:string,checkRevoked:true)=>Promise<VerifiedPaymentPrincipal>;
  findOwnedShops:(verifiedUid:string)=>Promise<OwnedPaymentShop[]>;
  findVerifiedLegacyMapping:(verifiedUid:string,shopId:string)=>Promise<LegacyPaymentMapping|null>;
  readScopedPayments:(legacyShopId:string,offset:number,limit:number)=>Promise<PaymentRow[]>;
};

export class PaymentHistoryDenied extends Error {
  constructor(public readonly status:number,public readonly code:string) {super(code);}
}
const fail=(status:number,code:string):never=>{throw new PaymentHistoryDenied(status,code);};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BIGINT=9223372036854775807n;
export const canonicalLegacyShopId=(raw:unknown):string=>{
  // Keep the bigint as a STRING to avoid JavaScript precision loss.
  if(typeof raw!=="string"|| !/^[1-9][0-9]{0,18}$/.test(raw)) return fail(409,"LEGACY_MAPPING_UNVERIFIED");
  if(BigInt(raw)>MAX_BIGINT) return fail(409,"LEGACY_MAPPING_UNVERIFIED");
  return raw;
};
const authorizedQuery=(query:Record<string,unknown>):number=>{
  const keys=Object.keys(query);
  if(keys.some(key=>key!=="offset")) return fail(400,"UNSUPPORTED_PAYMENT_QUERY");
  if(!keys.length) return 0;
  if(typeof query.offset!=="string"||!/^(0|[1-9][0-9]{0,3})$/.test(query.offset))
    return fail(400,"INVALID_PAYMENT_OFFSET");
  const offset=Number(query.offset);
  if(!Number.isSafeInteger(offset)||offset>5000||offset%50!==0)
    return fail(400,"INVALID_PAYMENT_OFFSET");
  return offset;
};
const safeAmount=(amount:unknown):string=>{
  if(typeof amount==="number" && Number.isFinite(amount) && amount>=0) {
    const formatted=String(amount);
    if(/^(0|[1-9][0-9]{0,13})(\.[0-9]{1,4})?$/.test(formatted))return formatted;
  }
  if(typeof amount==="string" && /^(0|[1-9][0-9]{0,13})(\.[0-9]{1,4})?$/.test(amount))return amount;
  return fail(503,"PAYMENT_HISTORY_INTEGRITY_FAILURE");
};
export const readMerchantPaymentHistory=async(
  authorization:unknown,query:Record<string,unknown>,deps:PaymentHistoryDeps,
):Promise<PaymentPage>=>{
  const offset=authorizedQuery(query);
  if(typeof authorization!=="string" || !authorization.startsWith("Bearer fb-") ||
      authorization.length<"Bearer fb-".length+1) return fail(401,"FIREBASE_AUTH_REQUIRED");
  const token=authorization.slice("Bearer fb-".length);
  let principal:VerifiedPaymentPrincipal;
  try {principal=await deps.verifyFirebase(token,true);}
  catch {return fail(401,"FIREBASE_AUTH_REQUIRED");}
  if(!principal || typeof principal.uid!=="string" || !principal.uid.trim() || principal.isAnonymous)
    return fail(401,"FIREBASE_AUTH_REQUIRED");

  let shops:OwnedPaymentShop[];
  try {shops=await deps.findOwnedShops(principal.uid);}
  catch {return fail(503,"PAYMENT_OWNER_LOOKUP_UNAVAILABLE");}
  if(!Array.isArray(shops)) return fail(503,"PAYMENT_OWNER_LOOKUP_UNAVAILABLE");
  if(shops.length===0) return fail(403,"NO_OWNED_SHOP");
  if(shops.length!==1) return fail(409,"AMBIGUOUS_MERCHANT_SHOP");
  const shop=shops[0];
  if(!shop || typeof shop.id!=="string" || !shop.id || shop.owner_id!==principal.uid ||
     shop.archived_at!==null || shop.approval_status!=="approved")
    return fail(403,"UNVERIFIED_MERCHANT_SHOP");

  let mapping:LegacyPaymentMapping|null;
  try {mapping=await deps.findVerifiedLegacyMapping(principal.uid,shop.id);}
  catch {return fail(503,"LEGACY_MAPPING_UNAVAILABLE");}
  // No implicit numeric cast of current shop IDs. Even "101" requires
  // a separately verified mapping provenance tied to this exact UID and shop.
  if(!mapping || mapping.provenance!=="verified_legacy_payment_mapping" ||
    mapping.shopId!==shop.id || mapping.ownerUid!==principal.uid)
    return fail(409,"LEGACY_MAPPING_UNVERIFIED");
  const legacyId=canonicalLegacyShopId(mapping.legacyShopId);

  let records:PaymentRow[];
  try {records=await deps.readScopedPayments(legacyId,offset,51);}
  catch {return fail(503,"PAYMENT_HISTORY_UNAVAILABLE");}
  if(!Array.isArray(records)||records.length>51) return fail(503,"PAYMENT_HISTORY_INTEGRITY_FAILURE");
  const payments:PaymentPage["payments"]=[];
  // Inspect all 51 rows, including lookahead; leaking rows cannot hide.
  for(const [i,row] of records.entries()) {
    if(!row || String(row.shop_id)!==legacyId || typeof row.id!=="string" || !UUID.test(row.id) ||
       typeof row.status!=="string" || !row.status.trim() || row.status.length>80 ||
       typeof row.payment_method!=="string" || !row.payment_method.trim() || row.payment_method.length>80 ||
       (row.payment_date!==null && (typeof row.payment_date!=="string" ||
         !Number.isFinite(Date.parse(row.payment_date)))))
       return fail(503,"PAYMENT_HISTORY_INTEGRITY_FAILURE");
    const amount=safeAmount(row.amount);
    if(i<50) payments.push({id:row.id,amount,
      status:row.status,payment_method:row.payment_method,payment_date:row.payment_date});
  }
  if(records.length>50 && offset===5000) return fail(503,"PAYMENT_HISTORY_PAGING_LIMIT");
  return {payments,next_offset:records.length>50?offset+50:null};
};
