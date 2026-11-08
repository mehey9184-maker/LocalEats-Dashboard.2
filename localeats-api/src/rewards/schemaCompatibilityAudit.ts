/**
 * R2.7 OFFLINE STRUCTURAL AUDIT. No Supabase client, network, SQL, HTTP route,
 * database writes, reward activation or payout. Input must come from a reviewed
 * read-only pg_catalog inventory. This is a preflight, NOT a security proof.
 */
export interface RelationInventory {
  schema: string;
  name: string;
  columns: readonly string[];
  rlsEnabled: boolean;
  // Set these to true only when catalog says anon OR authenticated has access.
  anonWrite: boolean;
  authenticatedWrite: boolean;
}
export interface FunctionInventory {
  schema: string;
  name: string;
  securityDefiner: boolean;
  anonExecute: boolean;
  authenticatedExecute: boolean;
  extensionOwned: boolean;
}
export interface PolicyInventory {
  schema: string;
  table: string;
  command: string;
  roles: readonly string[];
  usingExpression: string | null;
  checkExpression: string | null;
}
export interface Inventory {
  label: string;
  collectedAt: string;
  relations: readonly RelationInventory[];
  functions: readonly FunctionInventory[];
  policies: readonly PolicyInventory[];
}
export interface Finding {
  code: string;
  severity: "blocker" | "high" | "review";
  detail: string;
}
export interface SchemaReport {
  inventoryLabel: string;
  pickupStructurePresent: boolean;
  rewardsSchemaCandidate: boolean;
  // No metadata inventory can authorize a financial release.
  productionActivationAllowed: false;
  findings: readonly Finding[];
}
const rkey = (schema: string, table: string) => schema+"."+table;
const expectedPickup: readonly [string,readonly string[]][] = [
  ["orders",["id","shop_id","user_id","items","status","payment_status","delivery_type","create_intent_hash","revision"]],
  ["pickup_order_events",["order_id","revision","command_id","kind","actor_uid","occurred_at","details"]],
  ["shops",["id","owner_id","approval_status"]],
  ["menu_items",["id","shop_id","price","is_available"]],
  ["admin_users",["firebase_uid","role","is_active"]],
] as const;
/** Proposed PRIVATE schema only; names are not an approved Supabase migration. */
export const proposedPrivateRewards: readonly [string,readonly string[]][] = [
  ["programme_versions",["version","active","budget_minor"]],
  ["shop_enrollments",["shop_id","programme_version","enrolled_at"]],
  ["purchase_lines",["order_id","line_id","shop_id","customer_id","menu_item_id",
    "programme_version","price_minor","quantity","qualifying_kota","captured_at"]],
  ["credits",["order_id","line_id","customer_id","units"]],
  ["progress",["customer_id","rank","stage_units"]],
  ["grants",["customer_id","tier","cap_minor","status"]],
  ["handovers",["grant_id","shop_id","item_id","amount_minor"]],
  ["payables",["grant_id","shop_id","amount_minor","status"]],
  ["transfer_evidence",["payable_id","bank_reference","amount_minor"]],
  ["refund_events",["order_id","line_id","verified_by_merchant","verified_by_admin","units"]],
  ["refund_holds",["customer_id","refund_id"]],
  ["audit_events",["event_type","subject_id","created_at"]],
] as const;
const has = (r: RelationInventory | undefined, cols: readonly string[]): boolean =>
  !!r && cols.every(c=>r.columns.includes(c));
const alwaysTrue = (value: string | null): boolean =>
  typeof value==="string" && value.trim().replace(/^\((.*)\)$/,"$1").trim().toLowerCase()==="true";
export function auditRewardsSchema(inventory: Inventory): SchemaReport {
  const findings:Finding[]=[];
  const report=(code:string,severity:Finding["severity"],detail:string)=>{
    findings.push({code,severity,detail});
  };
  const tables=new Map(inventory.relations.map(r=>[rkey(r.schema,r.name),r]));
  let pickupOk=true;
  for(const [name,columns] of expectedPickup){
    const t=tables.get("public."+name);
    if(!has(t,columns)){
      report("PICKUP_SOURCE_MISSING_"+name.toUpperCase(),"blocker",
        "Current pickup "+name+" lacks the expected source-of-truth columns");
      pickupOk=false;
    }
  }
  const order=tables.get("public.orders");
  if(order && !order.columns.includes("test_record") && !order.columns.includes("simulated_checkout")){
    report("ORIGIN_FLAGS_NOT_IN_ORDER_SCHEMA","review",
      "Current orders do not directly expose R2.4 test/simulated fields; future adapter needs a separately verified source, not guessed defaults");
  }
  const menu=tables.get("public.menu_items");
  if(menu && !menu.columns.includes("reward_rule_revision")){
    report("MUTABLE_MENU_HAS_NO_REWARD_REVISION","review",
      "Current menu can change; only immutable purchase-time reward line snapshots can establish historic eligibility");
  }
  for(const name of ["pickup_create_order","pickup_order_command"]){
    const fn=inventory.functions.find(f=>f.schema==="public" && f.name===name);
    if(!fn){
      report("PICKUP_RPC_MISSING_"+name.toUpperCase(),"blocker","Pickup command RPC not found");
      pickupOk=false;
    }else if(fn.anonExecute || fn.authenticatedExecute || fn.securityDefiner){
      report("PICKUP_RPC_EXPOSED_"+name.toUpperCase(),"high",
        "Pickup command RPC needs a server-only invoker privilege review");
      pickupOk=false;
    }
  }
  for(const name of ["pickup_order_events","admin_users"]){
    const r=tables.get("public."+name);
    if(r && (!r.rlsEnabled || r.anonWrite || r.authenticatedWrite)){
      report("TRUSTED_SOURCE_WRITABLE_"+name.toUpperCase(),"high",
        "Trusted source needs isolated access; inspect RLS and API role grants");
      pickupOk=false;
    }
  }
  const paymentPolicy=inventory.policies.some(p=>p.schema==="public" && p.table==="payments" &&
    p.roles.some(role=>role==="authenticated" || role==="public") &&
    ["ALL","UPDATE","INSERT","DELETE"].includes(p.command.toUpperCase()) &&
    alwaysTrue(p.usingExpression) && alwaysTrue(p.checkExpression));
  if(paymentPolicy){
    report("UNSCOPED_AUTHENTICATED_PAYMENTS_POLICY","high",
      "An authenticated ALL payments policy with true/true predicates lacks ownership restrictions; triage before launch");
  }
  for(const fn of inventory.functions){
    if(fn.schema==="public" && fn.securityDefiner && fn.anonExecute && !fn.extensionOwned){
      report("ANON_EXEC_SECURITY_DEFINER_"+fn.name.toUpperCase(),"high",
        "User-defined SECURITY DEFINER function is executable by anon; inspect usage and revoke/harden where safe");
    }
  }
  let privateComplete=true;
  for(const [name,columns] of proposedPrivateRewards){
    const table=tables.get("rewards_private."+name);
    if(!has(table,columns)){
      report("PRIVATE_REWARDS_SOURCE_MISSING_"+name.toUpperCase(),"blocker",
        "No verified private reward "+name+" ledger/source matching the proposed contract");
      privateComplete=false;
    }else if(!table!.rlsEnabled || table!.anonWrite || table!.authenticatedWrite){
      report("PRIVATE_REWARDS_EXPOSED_"+name.toUpperCase(),"high",
        "Reward financial tables must not be directly writable by public API roles");
      privateComplete=false;
    }
  }
  return {inventoryLabel:inventory.label,pickupStructurePresent:pickupOk,
    rewardsSchemaCandidate:pickupOk && privateComplete,
    productionActivationAllowed:false,findings};
}
