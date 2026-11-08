import test from "node:test";
import assert from "node:assert/strict";
import {auditRewardsSchema,proposedPrivateRewards,
  type Inventory,type RelationInventory} from "./schemaCompatibilityAudit.js";

// Sanitized structure captured from read-only LocalEats Production PG17 metadata
// on 2026-11-07. This is a dated fixture, not a live database connection,
// schema migration or claimed security approval.
const makeRelation=(schema:string,name:string,columns:string[],rlsEnabled=true,
  anonWrite=false,authenticatedWrite=false):RelationInventory=>
  ({schema,name,columns,rlsEnabled,anonWrite,authenticatedWrite});
const productionObserved=():Inventory=>({
  label:"LocalEats production structural inventory observed 2026-11-07 (redacted, no rows)",
  collectedAt:"2026-11-07T21:08:33Z",
  relations:[
    makeRelation("public","orders",["id","shop_id","user_id","items","status",
      "payment_status","delivery_type","create_intent_hash","revision"],true,true,true),
    makeRelation("public","pickup_order_events",["order_id","revision","command_id",
      "kind","actor_uid","occurred_at","details"]),
    makeRelation("public","shops",["id","owner_id","approval_status"],true,true,true),
    makeRelation("public","menu_items",["id","shop_id","price","is_available"],true,true,true),
    makeRelation("public","admin_users",["firebase_uid","role","is_active"]),
    makeRelation("public","profiles",["user_id","role"],true,true,true),
    makeRelation("public","payments",["id","shop_id"],true,true,true)
  ],
  functions:[
    {schema:"public",name:"pickup_create_order",securityDefiner:false,
      anonExecute:false,authenticatedExecute:false,extensionOwned:false},
    {schema:"public",name:"pickup_order_command",securityDefiner:false,
      anonExecute:false,authenticatedExecute:false,extensionOwned:false},
    ...["handle_new_user","nudge_rider","nudge_rider_by_id","rls_auto_enable"].map(name=>({
      schema:"public",name,securityDefiner:true,
      anonExecute:true,authenticatedExecute:true,extensionOwned:false
    })),
    {schema:"public",name:"st_estimatedextent",securityDefiner:true,
      anonExecute:true,authenticatedExecute:true,extensionOwned:true},
  ],
  policies:[
    {schema:"public",table:"payments",command:"ALL",roles:["authenticated"],
      usingExpression:"true",checkExpression:"true"},
    {schema:"public",table:"shops",command:"SELECT",roles:["public"],
      usingExpression:"true",checkExpression:null},
    {schema:"public",table:"menu_items",command:"SELECT",roles:["public"],
      usingExpression:"true",checkExpression:null},
  ],
});
const hasCode=(r:ReturnType<typeof auditRewardsSchema>,code:string)=>
  r.findings.some(x=>x.code===code);

test("R2.7: observed real Production pickup baseline exists but Rewards is NOT deployable",()=>{
  const r=auditRewardsSchema(productionObserved());
  assert.equal(r.pickupStructurePresent,true);
  assert.equal(r.rewardsSchemaCandidate,false);
  assert.equal(r.productionActivationAllowed,false);
  assert.equal(proposedPrivateRewards.length,12);
  assert.equal(r.findings.filter(f=>f.code.startsWith("PRIVATE_REWARDS_SOURCE_MISSING_")).length,12);
});
test("R2.7: no retroactive Rewards qualification from a mutable menu or missing order flags",()=>{
  const r=auditRewardsSchema(productionObserved());
  assert.equal(hasCode(r,"ORIGIN_FLAGS_NOT_IN_ORDER_SCHEMA"),true);
  assert.equal(hasCode(r,"MUTABLE_MENU_HAS_NO_REWARD_REVISION"),true);
  assert.equal(hasCode(r,"PRIVATE_REWARDS_SOURCE_MISSING_PURCHASE_LINES"),true);
});
test("R2.7: observed Production payments policy must be flagged for owner/Codex triage",()=>{
  const r=auditRewardsSchema(productionObserved());
  assert.equal(hasCode(r,"UNSCOPED_AUTHENTICATED_PAYMENTS_POLICY"),true);
  assert.equal(r.findings.find(x=>x.code==="UNSCOPED_AUTHENTICATED_PAYMENTS_POLICY")?.severity,"high");
});
test("R2.7: risky user-defined anon-executable definer functions are flagged, extensions distinguished",()=>{
  const r=auditRewardsSchema(productionObserved());
  for(const name of ["HANDLE_NEW_USER","NUDGE_RIDER","NUDGE_RIDER_BY_ID","RLS_AUTO_ENABLE"])
    assert.equal(hasCode(r,"ANON_EXEC_SECURITY_DEFINER_"+name),true);
  assert.equal(hasCode(r,"ANON_EXEC_SECURITY_DEFINER_ST_ESTIMATEDEXTENT"),false);
});
test("R2.7: direct client execution of pickup create/command would be a severe regression",()=>{
  const a=productionObserved();
  const b={...a,functions:a.functions.map(fn=>fn.name==="pickup_create_order"?
    {...fn,anonExecute:true}:fn)};
  const r=auditRewardsSchema(b);
  assert.equal(r.pickupStructurePresent,false);
  assert.equal(hasCode(r,"PICKUP_RPC_EXPOSED_PICKUP_CREATE_ORDER"),true);
});
test("R2.7: loss of pickup RLS/server-only event protection blocks structural compatibility",()=>{
  const a=productionObserved();
  const b={...a,relations:a.relations.map(t=>t.name==="pickup_order_events"?
    {...t,authenticatedWrite:true}:t)};
  const r=auditRewardsSchema(b);
  assert.equal(hasCode(r,"TRUSTED_SOURCE_WRITABLE_PICKUP_ORDER_EVENTS"),true);
  assert.equal(r.pickupStructurePresent,false);
});
test("R2.7: profile-staging alone is NOT a valid Rewards/pickup staging database",()=>{
  const a:Inventory={label:"profile-only isolated staging",collectedAt:"2026-11-07T21:08:33Z",
    relations:[makeRelation("public","profiles",["user_id","role"])],
    functions:[],policies:[]};
  const r=auditRewardsSchema(a);
  assert.equal(r.pickupStructurePresent,false);
  assert.equal(r.rewardsSchemaCandidate,false);
  assert.equal(hasCode(r,"PICKUP_SOURCE_MISSING_ORDERS"),true);
  assert.equal(r.productionActivationAllowed,false);
});
test("R2.7: even a hypothetical complete PRIVATE schema can never self-authorize launch",()=>{
  const a=productionObserved();
  const examplePrivate=proposedPrivateRewards.map(([name,cols])=>
    makeRelation("rewards_private",name,[...cols]));
  const b:Inventory={...a,relations:[...a.relations,...examplePrivate],
    policies:[],functions:a.functions.filter(x=>!x.securityDefiner||x.extensionOwned)};
  const r=auditRewardsSchema(b);
  assert.equal(r.pickupStructurePresent,true);
  assert.equal(r.rewardsSchemaCandidate,true);
  assert.equal(r.productionActivationAllowed,false);
});
test("R2.7: a private ledger with authenticated writes is NOT a valid structural candidate",()=>{
  const a=productionObserved();
  const examplePrivate=proposedPrivateRewards.map(([name,cols])=>
    makeRelation("rewards_private",name,[...cols]));
  examplePrivate[0]={...examplePrivate[0]!,authenticatedWrite:true};
  const r=auditRewardsSchema({...a,relations:[...a.relations,...examplePrivate]});
  assert.equal(r.rewardsSchemaCandidate,false);
  assert.equal(hasCode(r,"PRIVATE_REWARDS_EXPOSED_PROGRAMME_VERSIONS"),true);
});
test("R2.7: missing or altered trusted pickup columns cannot silently pass",()=>{
  const a=productionObserved();
  const r=auditRewardsSchema({...a,relations:a.relations.map(t=>t.name==="orders"?
    {...t,columns:t.columns.filter(c=>c!=="create_intent_hash")}:t)});
  assert.equal(r.pickupStructurePresent,false);
  assert.equal(hasCode(r,"PICKUP_SOURCE_MISSING_ORDERS"),true);
});
test("R2.7: scoped payment policy is not incorrectly classified as unconditional ALL",()=>{
  const a=productionObserved();
  const r=auditRewardsSchema({...a,policies:[{
    schema:"public",table:"payments",command:"ALL",roles:["authenticated"],
    usingExpression:"shop_id = auth.uid()",checkExpression:"shop_id = auth.uid()"
  }]});
  assert.equal(hasCode(r,"UNSCOPED_AUTHENTICATED_PAYMENTS_POLICY"),false);
  assert.equal(r.productionActivationAllowed,false);
});
