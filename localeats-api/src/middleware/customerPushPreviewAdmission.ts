import type {Request} from "express";
import {customerPushTestEnabled} from "../orders/customerPushTest.js";

/** Staging-only, owner-configured carve-out from the read-only Preview barrier.
 * No generic Preview or Production may enable this via request input.
 * Firebase authentication and individual UID ownership are ALSO enforced later
 * by the notification routes, after this pre-routing admission decision.
 */
export function canUseIsolatedCustomerPushPreview(
  req:Pick<Request,"method"|"path"|"headers">,
  env:NodeJS.ProcessEnv=process.env
):boolean {
  if(env.LOCALEATS_PREVIEW_READ_ONLY==="true" || !customerPushTestEnabled(env) ||
     !(env.CUSTOMER_PUSH_TEST_UIDS||"").split(",").some(uid=>uid.trim().length>0)) return false;
  const expected=env.CUSTOMER_PUSH_TEST_STAGING_ORIGIN;
  const origin=req.headers.origin;
  if(typeof expected!=="string" || typeof origin!=="string" || origin!==expected) return false;
  try {
    const value=new URL(expected);
    if(value.protocol!=="https:" || value.origin!==expected ||
       !/^localeats-customer-staging-r52d(?:-[a-z0-9-]+)?\.vercel\.app$/.test(value.hostname))
      return false;
  }catch{return false;}
  const uuid="[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
  const path=req.path;
  if((req.method==="PUT" || req.method==="DELETE") &&
     new RegExp("^/api/v1/push-subscriptions/"+uuid+"/?$","i").test(path)) return true;
  return req.method==="POST" &&
    new RegExp("^/api/v1/customer-push-subscriptions/"+uuid+"/test/?$","i").test(path);
}

/** Don't make the API respond to CORS on unknown Preview project hosts.
 * The origin must be the exact configured Customer preview for this stage.
 */
export function isIsolatedCustomerPushCorsOrigin(origin:string|undefined,env:NodeJS.ProcessEnv=process.env):boolean {
  if(!origin)return false;
  return canUseIsolatedCustomerPushPreview({
    method:"POST",path:"/api/v1/customer-push-subscriptions/550e8400-e29b-41d4-a716-446655440000/test",
    headers:{origin}
  } as Pick<Request,"method"|"path"|"headers">,env);
}
