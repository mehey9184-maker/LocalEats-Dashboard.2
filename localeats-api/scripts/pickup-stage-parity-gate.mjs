// Read-only, OFFLINE verifier. Does not connect to any database, deploy SQL,
// create test accounts or print credentials. A trusted operator must obtain
// the snapshot using the companion read-only Supabase query.
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

export const STAGE_PROJECT_REF = "rgpbdajhlrwfmhopzgzk";
export const REQUIREMENTS = Object.freeze([
  ["table","public.profiles"],
  ["table","public.shops"],
  ["table","public.menu_items"],
  ["table","public.orders"],
  ["table","public.pickup_order_events"],
  ["table","public.pickup_push_outbox"],
  ["table","public.admin_users"],
  ["table","public.shop_approval_events"],
  ["table","public.pickup_push_subscriptions"],
  ["view","public.shops_with_availability"],
  ["column","public.profiles.user_id"],
  ["column","public.profiles.role"],
  ["column","public.shops.approval_status"],
  ["column","public.shops.is_active"],
  ["column","public.orders.idempotency_key"],
  ["column","public.orders.revision"],
  ["function","public.transition_shop_approval(text,text,text,text,text)"],
  ["function","public.merchant_set_availability(text,text,boolean,boolean,bigint)"],
  ["function","public.pickup_create_order(text,text,jsonb)"],
  ["function","public.pickup_order_command(text,uuid,text,uuid,bigint,text,text,boolean)"],
  ["function","public.pickup_claim_push(text)"],
  ["function","public.pickup_push_sendable(text,uuid,integer,timestamp with time zone,text)"],
  ["function","public.pickup_finish_push(text,uuid,integer,timestamp with time zone,boolean,boolean)"]
]);
const PRIVILEGED_SERVER_FUNCTIONS = new Set([
  "public.transition_shop_approval(text,text,text,text,text)",
  "public.merchant_set_availability(text,text,boolean,boolean,bigint)",
  "public.pickup_create_order(text,text,jsonb)",
  "public.pickup_order_command(text,uuid,text,uuid,bigint,text,text,boolean)",
  "public.pickup_claim_push(text)",
  "public.pickup_push_sendable(text,uuid,integer,timestamp with time zone,text)",
  "public.pickup_finish_push(text,uuid,integer,timestamp with time zone,boolean,boolean)"
]);

/**
 * Does not declare public launch readiness even on a complete synthetic
 * snapshot; only examines object presence and narrow service-role boundaries.
 * The snapshot MUST come from the intended staging project, authenticated
 * through an independent trusted source.
 */
export function evaluateStageParity(snapshot) {
  if (!snapshot || typeof snapshot!=="object" || Array.isArray(snapshot)
      || snapshot.project_ref!==STAGE_PROJECT_REF
      || !Array.isArray(snapshot.objects)
      || typeof snapshot.database!=="string" || !snapshot.database.trim()) {
    throw Error("Missing/incorrect staging project, database, or object inventory");
  }
  const byKey=new Map();
  for(const obj of snapshot.objects){
    if(!obj || typeof obj!=="object"
      || !["table","view","column","function"].includes(obj.kind)
      || typeof obj.identifier!=="string"
      || typeof obj.exists!=="boolean") {
      throw Error("Malformed read-only inventory entry");
    }
    const k=obj.kind+":"+obj.identifier;
    if(byKey.has(k))throw Error("Duplicate inventory entry: "+k);
    byKey.set(k,obj);
  }
  const missing=[],unsafe=[];
  for(const [kind,identifier] of REQUIREMENTS) {
    const item=byKey.get(kind+":"+identifier);
    if(!item || !item.exists){missing.push(identifier);continue;}
    if(kind==="function" &&
      (item.anon_execute!==false || item.authenticated_execute!==false)) {
        unsafe.push(identifier+": anon/authenticated EXECUTE must be denied");
    }
    if(kind==="function" && PRIVILEGED_SERVER_FUNCTIONS.has(identifier)
        && item.service_execute!==true) {
      unsafe.push(identifier+": verified server service role requires EXECUTE");
    }
    if(identifier==="public.pickup_create_order(text,text,jsonb)" && item.security_definer!==false) {
      unsafe.push(identifier+": must remain SECURITY INVOKER");
    }
  }
  return {
    status:missing.length || unsafe.length ? "BLOCKED" : "OBJECT_AND_GRANT_PRECHECK_PASS",
    missing,unsafe,
    checked:REQUIREMENTS.length,
    database:snapshot.database,
    note:"Not full schema parity, not proof of RLS, Firebase identity, hosted end-to-end behavior or public launch readiness."
  };
}

if(process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]){
  const args=process.argv.slice(2);
  if(args.length!==2 || args[0]!=="--snapshot"){
    console.error("Usage: node scripts/pickup-stage-parity-gate.mjs --snapshot /private/path/staging-readonly.json");
    process.exitCode=2;
  } else {
    try {
      const result=evaluateStageParity(JSON.parse(readFileSync(args[1],"utf8")));
      console.log(JSON.stringify(result,null,2));
      if(result.status!=="OBJECT_AND_GRANT_PRECHECK_PASS") process.exitCode=1;
    }catch {
      console.error("Invalid or wrong-project staging snapshot; no cloud call or data change performed.");
      process.exitCode=2;
    }
  }
}
