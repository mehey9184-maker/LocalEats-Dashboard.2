// R3.7 static evidence gate: this NEVER claims authenticated browser acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const manifest=JSON.parse(readFileSync(new URL('./preview-evidence.json',import.meta.url),'utf8'));
const customer='01069d9e6db41325c4ad9a086a0148efa32edce7';
const merchant='5aedc5424d7070ee7156a080cc69e6a550acc1a4';

test('R3.7: both exact-main SHA previews verified READY, never Production',()=>{
 assert.equal(manifest.ready_for_public_launch,false);
 assert.equal(manifest.progress_is_certification,false);
 assert.equal(manifest.public_launch_progress_estimate_percent,60);
 assert.equal(manifest.no_real_orders_submitted,true);
 assert.equal(manifest.no_prod_database_mutations,true);
 const c=manifest.deployments.customer,m=manifest.deployments.merchant;
 assert.equal(c.main_sha,customer);
 assert.equal(m.main_sha,merchant);
 for(const dep of [c,m]){
   assert.equal(dep.review_branch,'review/r37-exact-main-readonly-preview-20261108');
   assert.equal(dep.deployment_state,'READY');
   assert.equal(dep.target,null,'Vercel target null is Preview, not Production');
   assert.equal(dep.http_get_status,200);
   assert.match(dep.url,/^https:\/\/[\w-]+\.vercel\.app\/$/);
   assert.equal(dep.authenticated_browser_walkthrough,false);
   assert.equal(dep.visual_screenshots_inspected,false);
   assert.equal(dep.real_push_verified,false);
 }
});
test('R3.7: owner acceptance cannot be implicitly signed off by CI',()=>{
 assert.equal(manifest.approval_gates.length,8);
 for(const x of manifest.approval_gates){
   assert.match(x.status,/^pending_/);
 }
 assert.ok(manifest.verified_observations.some(s=>s.includes('Delivery')));
});
test('R3.7: real payments RLS risk remains explicit and unmodified',()=>{
 const x=manifest.blocking_security_issue;
 assert.equal(x.table,'public.payments');
 assert.equal(x.authenticated_rls_policy,'Payments access');
 assert.equal(x.policy_cmd,'ALL');
 assert.equal(x.using_expression,'true');
 assert.equal(x.with_check_expression,'true');
 for(const privilege of ['select','insert','update','delete']){
   assert.equal(x['authenticated_has_'+privilege],true);
 }
 assert.equal(x.mitigation_status,'NOT_APPLIED_TO_PRODUCTION');
});
