import test from "node:test";
import assert from "node:assert/strict";
import {launchReadiness} from "./health.js";

test("Firebase Admin missing must not be represented as launch-ready",()=>{
 const result=launchReadiness(false,true,true);
 assert.equal(result.status,"blocked");
 assert.equal(result.firebase_admin_ready,false);
 assert.equal(result.controlled_pickup_configured,true);
 assert.equal(result.human_acceptance_required,true);
});
test("pickup flags off or no test allowlist never pass launch-readiness",()=>{
 for(const flags of [[false,false],[false,true],[true,false]]){
  const result=launchReadiness(true,flags[0],flags[1]);
  assert.equal(result.status,"blocked");
  assert.equal(result.controlled_pickup_configured,false);
 }
});
test("fully configured backend reports only candidate, not a successful real-world launch",()=>{
 const result=launchReadiness(true,true,true);
 assert.equal(result.status,"candidate");
 assert.equal(result.human_acceptance_required,true);
 assert.equal("fcm_token" in result,false);
 assert.equal("private_key" in result,false);
});
