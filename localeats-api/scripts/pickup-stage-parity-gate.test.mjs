import test from "node:test";
import assert from "node:assert/strict";
import {evaluateStageParity,REQUIREMENTS,STAGE_PROJECT_REF} from "./pickup-stage-parity-gate.mjs";

function fixture(){
 return {
  project_ref:STAGE_PROJECT_REF,
  database:"postgres",
  objects:REQUIREMENTS.map(([kind,identifier])=>({
    kind,identifier,exists:true,
    ...(kind==="function"?
      {anon_execute:false,authenticated_execute:false,service_execute:true,
       security_definer:identifier==="public.handle_new_user()"}:{})
  }))
 };
}
test("Complete synthetic pickup schema passes ONLY a limited presence/privilege preflight",()=>{
 const result=evaluateStageParity(fixture());
 assert.equal(result.status,"OBJECT_AND_GRANT_PRECHECK_PASS");
 assert.equal(result.checked,REQUIREMENTS.length);
 assert.deepEqual(result.missing,[]);
 assert.deepEqual(result.unsafe,[]);
 assert.match(result.note,/not proof of RLS/i);
});
test("Current profile-only staging shape fails the full pickup release gate",()=>{
 const input=fixture();
 input.objects=input.objects.filter(x=>["public.profiles","public.profiles.user_id","public.profiles.role"].includes(x.identifier));
 const result=evaluateStageParity(input);
 assert.equal(result.status,"BLOCKED");
 for(const name of ["public.shops","public.menu_items","public.orders","public.shop_approval_events",
 "public.pickup_create_order(text,text,jsonb)","public.transition_shop_approval(text,text,text,text,text)"]){
  assert.ok(result.missing.includes(name),name+" must block full workflow acceptance");
 }
});
test("Function role escalation or missing service privilege blocks readiness",()=>{
 const input=fixture();
 const functionRow=input.objects.find(x=>x.identifier==="public.pickup_create_order(text,text,jsonb)");
 functionRow.anon_execute=true;
 functionRow.service_execute=false;
 const result=evaluateStageParity(input);
 assert.equal(result.status,"BLOCKED");
 assert.ok(result.unsafe.some(x=>x.includes("anon/authenticated EXECUTE")));
 assert.ok(result.unsafe.some(x=>x.includes("service role requires EXECUTE")));
});
test("Weak security-definer change to order-create function is detected",()=>{
 const input=fixture();
 input.objects.find(x=>x.identifier==="public.pickup_create_order(text,text,jsonb)").security_definer=true;
 const result=evaluateStageParity(input);
 assert.equal(result.status,"BLOCKED");
 assert.ok(result.unsafe.some(x=>x.includes("SECURITY INVOKER")));
});
test("Incomplete grants are never interpreted as secure denials",()=>{
 const input=fixture();
 delete input.objects.find(x=>x.identifier==="public.transition_shop_approval(text,text,text,text,text)").authenticated_execute;
 const result=evaluateStageParity(input);
 assert.equal(result.status,"BLOCKED");
 assert.ok(result.unsafe.some(x=>x.includes("authenticated EXECUTE")));
});
test("Unknown or ambiguous project inventory cannot pass",()=>{
 assert.throws(()=>evaluateStageParity({...fixture(),project_ref:"phdjumtqkooyppxozqsi"}),/incorrect staging project/);
 assert.throws(()=>evaluateStageParity({...fixture(),project_ref:""}),/incorrect staging project/);
 assert.throws(()=>evaluateStageParity({...fixture(),objects:null}),/incorrect staging project/);
 const input=fixture();
 input.objects.push({...input.objects[0]});
 assert.throws(()=>evaluateStageParity(input),/Duplicate inventory/);
});
test("Invalid inventory values reject instead of becoming permissive",()=>{
 const input=fixture();
 input.objects[0].exists="true";
 assert.throws(()=>evaluateStageParity(input),/Malformed read-only inventory entry/);
});
