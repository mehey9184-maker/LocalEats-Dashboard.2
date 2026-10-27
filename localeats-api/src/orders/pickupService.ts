import type { SupabaseClient } from "@supabase/supabase-js";
import { draftAssertConsent, draftHash, draftReplayCreation, DraftContractError } from "../contracts/pickupDraft.js";
import { assertShopCanAcceptOrder, calculateAuthoritativePrice, calculateDistanceKm, OrderContractError,
  parseCreateOrderInput, type CreateOrderInput, type AuthoritativePrice } from "./orderContract.js";
import type { OrderRepository, StoredOrder } from "./orderService.js";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type PickupAction = "accept" | "ready" | "reject" | "cancel" | "confirm_payment" | "collect";
export type RpcClient = Pick<SupabaseClient, "rpc">;
const fail = (status: number, code: string): never => { throw new OrderContractError(status, code, code); };
export const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail(400,"INVALID_REQUEST");
  return value as Record<string, unknown>;
};
export const onlyKeys = (body: Record<string, unknown>, keys: string[]): void => {
  if (Object.keys(body).some(k => !keys.includes(k))) fail(400,"UNSUPPORTED_INPUT");
};
export interface PickupInput {
  input: CreateOrderInput;
  location: {lat:number; lng:number};
  consent?: {currency:"ZAR"; totalMinor:number; pricingFingerprint:string};
}
export function parsePickupInput(raw: unknown, creating: boolean): PickupInput {
  const body = object(raw);
  if (body.contract_version !== "pickup-v1") return fail(426,"PICKUP_CONTRACT_REQUIRED");
  onlyKeys(body,["contract_version","idempotency_key","shop_id","items","delivery_type","delivery_schedule_mode",
    "tip_amount","payment_method","customer_details","launch_location",...(creating ? ["consent"] : [])]);
  const input = parseCreateOrderInput(body);
  input.idempotency_key=input.idempotency_key.toLowerCase();
  onlyKeys(object(body.customer_details),["name","phone","email","address","city","delivery_instructions"]);
  if (input.delivery_type !== "collection" || input.tip_amount !== 0 || !["cash","card_machine"].includes(input.payment_method))
    return fail(422,"PICKUP_ONLY");
  const location = object(body.launch_location);
  onlyKeys(location,["lat","lng"]);
  if (typeof location.lat !== "number" || !Number.isFinite(location.lat) || Math.abs(location.lat)>90 ||
    typeof location.lng !== "number" || !Number.isFinite(location.lng) || Math.abs(location.lng)>180) return fail(400,"INVALID_COORDINATES");
  const result: PickupInput = {input,location:{lat:location.lat,lng:location.lng}};
  if (creating) {
    const consent = object(body.consent); onlyKeys(consent,["currency","total_minor","pricing_fingerprint"]);
    if (consent.currency !== "ZAR" || !Number.isSafeInteger(consent.total_minor) || Number(consent.total_minor)<0 ||
      typeof consent.pricing_fingerprint !== "string" || !/^[0-9a-f]{64}$/.test(consent.pricing_fingerprint)) return fail(400,"INVALID_PRICE_CONSENT");
    result.consent = {currency:"ZAR",totalMinor:Number(consent.total_minor),pricingFingerprint:consent.pricing_fingerprint};
  }
  return result;
}
const normalized = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
export const creationHash = (uid: string, request: PickupInput): string => draftHash(normalized({
  version:"pickup-v1", uid, input:request.input, location:request.location, consent:request.consent,
}));
export async function pickupPricing(repository: OrderRepository, uid: string, request: PickupInput): Promise<AuthoritativePrice> {
  if (!uid) return fail(401,"UNAUTHORIZED");
  const shop = await repository.findShop(request.input.shop_id);
  if (!shop) return fail(404,"SHOP_NOT_FOUND");
  assertShopCanAcceptOrder(shop,request.input);
  const lat=shop.lat ?? shop.latitude, lng=shop.lng ?? shop.longitude;
  if (typeof lat!=="number" || !Number.isFinite(lat) || Math.abs(lat)>90 || typeof lng!=="number" || !Number.isFinite(lng) || Math.abs(lng)>180)
    return fail(409,"SHOP_LOCATION_UNAVAILABLE");
  if (calculateDistanceKm(lat,lng,request.location.lat,request.location.lng)>4) return fail(422,"OUTSIDE_PICKUP_RADIUS");
  return calculateAuthoritativePrice(request.input, await repository.findMenuItems(request.input.shop_id,request.input.items.map(l=>l.menu_item_id)));
}
export function pickupQuote(pricing: AuthoritativePrice) {
  const snapshot = {currency:"ZAR" as const,lines:pricing.lines.map(line=>({menu_item_id:line.menu_item_id,name:line.name,
    unit_minor:Math.round(line.unit_price*100),quantity:line.quantity,line_minor:Math.round(line.line_total*100)})),
    subtotal_minor:Math.round(pricing.subtotal*100),service_fee_minor:Math.round(pricing.service_fee*100),
    delivery_fee_minor:0,discount_minor:0,tip_minor:0,total_minor:Math.round(pricing.total_price*100)};
  return {...snapshot,pricing_fingerprint:draftHash(snapshot)};
}
const conflicts = new Set(["IDEMPOTENCY_CONFLICT","ORDER_STATE_CHANGED","INVALID_ORDER_TRANSITION","INVALID_PAYMENT_TRANSITION",
  "PICKUP_CONTRACT_REQUIRED","PRICE_CHANGED","SHOP_UNAVAILABLE","MENU_ITEM_UNAVAILABLE","PICKUP_INITIAL_STATE_INVALID","SHOP_LOCATION_UNAVAILABLE"]);
export async function pickupRpc(client: RpcClient, name: string, args: Record<string, unknown>): Promise<unknown> {
  const {data,error}=await client.rpc(name,args);
  if (error) {
    const code = typeof error.message==="string" ? error.message : "";
    if (code==="OUTSIDE_PICKUP_RADIUS") return fail(422,code);
    if (code==="FORBIDDEN") return fail(403,code);
    if (code==="ORDER_NOT_FOUND") return fail(404,code);
    if (conflicts.has(code)) return fail(409,code);
    if (["INVALID_REQUEST","INVALID_COMMAND","INVALID_PAYMENT_METHOD","INVALID_CANCELLATION","HANDOVER_CONFIRMATION_REQUIRED","INVALID_ITEMS","INVALID_QUANTITY"].includes(code)) return fail(400,code);
    return fail(503,"PICKUP_PERSISTENCE_UNAVAILABLE");
  }
  return data;
}
export function persistedResult(data: unknown): {order:StoredOrder; replayed:boolean; event?:unknown} {
  if (!data || typeof data !== "object" || Array.isArray(data)) return fail(503,"PICKUP_PERSISTENCE_UNCONFIRMED");
  const result=data as Record<string,unknown>;
  if (!result.order || typeof result.order!=="object" || typeof (result.order as StoredOrder).id!=="string" ||
    typeof result.replayed!=="boolean") return fail(503,"PICKUP_PERSISTENCE_UNCONFIRMED");
  return result as {order:StoredOrder;replayed:boolean;event?:unknown};
}
export async function createPickup(client: RpcClient, repository: OrderRepository, uid:string, request:PickupInput) {
  if (!uid) return fail(401,"UNAUTHORIZED");
  const hash=creationHash(uid,request);
  // Replay precedes all catalog/price/availability checks. The immutable hash survives actual method changes.
  const existing=await repository.findOrderByIdempotencyKey(request.input.idempotency_key);
  try {
    const replay=draftReplayCreation(existing ? {userId:existing.user_id,orderId:existing.id,createIntentHash:
      typeof existing.create_intent_hash==="string" ? existing.create_intent_hash : null} : null,uid,hash);
    if (replay && existing) return {order:existing,replayed:true};
  } catch (e) { if (e instanceof DraftContractError) return fail(409,e.code); throw e; }
  const price=await pickupPricing(repository,uid,request), quote=pickupQuote(price);
  if (!request.consent) return fail(400,"INVALID_PRICE_CONSENT");
  try { draftAssertConsent(request.consent,{currency:"ZAR",totalMinor:quote.total_minor,pricingFingerprint:quote.pricing_fingerprint}); }
  catch (e) { if (e instanceof DraftContractError) return fail(409,e.code); throw e; }
  const input=request.input, customer=input.customer_details;
  const record={shop_id:input.shop_id,idempotency_key:input.idempotency_key,items:price.lines,
    product_name:price.lines.map(l=>l.name).join(", "),price:price.subtotal,service_fee:price.service_fee,total_price:price.total_price,
    payment_method:input.payment_method,customer_name:customer.name,phone:customer.phone,email:customer.email,
    address:customer.address,city:customer.city,notes:[...input.items.map(l=>l.notes),customer.delivery_instructions].filter(Boolean).join(" • ") || null,
    launch_location:request.location};
  return persistedResult(await pickupRpc(client,"pickup_create_order",{p_uid:uid,p_intent_hash:hash,p_record:record}));
}
export async function commandPickup(client:RpcClient,uid:string,orderId:string,action:PickupAction,raw:unknown) {
  const body=object(raw); onlyKeys(body,["command_id","expected_revision",...(action==="confirm_payment" ? ["payment_method"] : []),
    ...(action==="reject" || action==="cancel" ? ["reason"] : []),...(action==="collect" ? ["handover_confirmed"] : [])]);
  if (!uid) return fail(401,"UNAUTHORIZED");
  if (!UUID.test(orderId) || typeof body.command_id!=="string" || !UUID.test(body.command_id) ||
    !Number.isSafeInteger(body.expected_revision) || Number(body.expected_revision)<0 || Number(body.expected_revision)>=Number.MAX_SAFE_INTEGER) return fail(400,"INVALID_COMMAND");
  if ((action==="reject" || action==="cancel") && (typeof body.reason!=="string" || !body.reason.trim() || body.reason.trim().length>500)) return fail(400,"INVALID_CANCELLATION");
  if (action==="confirm_payment" && !["cash","card_machine"].includes(String(body.payment_method))) return fail(400,"INVALID_PAYMENT_METHOD");
  if (action==="collect" && body.handover_confirmed!==true) return fail(400,"HANDOVER_CONFIRMATION_REQUIRED");
  return persistedResult(await pickupRpc(client,"pickup_order_command",{p_uid:uid,p_order_id:orderId,p_action:action,p_command_id:body.command_id,
    p_expected_revision:body.expected_revision,p_reason:typeof body.reason==="string" ? body.reason.trim() : null,
    p_payment_method:body.payment_method ?? null,p_handover_confirmed:body.handover_confirmed===true}));
}
