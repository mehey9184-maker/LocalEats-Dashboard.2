// R3.5 OFFLINE audit. No Supabase API, network or real customer records.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import {resolve,dirname} from "node:path";
const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,"../../../..");
const manifest=JSON.parse(readFileSync(resolve(here,"reproducibility-manifest.json"),"utf8"));
const read=path=>readFileSync(resolve(root,path),"utf8");

test("R3.5: applied migration history inventoried, not silently reconstructed",()=>{
  assert.equal(manifest.applied.length,8);
  assert.equal(manifest.complete,false,"Cannot mark complete while source chain is incomplete");
  const versions=manifest.applied.map(x=>x.version);
  assert.deepEqual(versions,[...versions].sort());
  assert.equal(new Set(versions).size,8);
  assert.deepEqual(manifest.applied.map(x=>x.state).reduce((out,x)=>{
    out[x]=(out[x]||0)+1;return out;
  },{}),{
    "versioned-migration-present":4,
    "recorded-statement-archived-not-versioned":4,
  });
  assert.ok(manifest.manually_pending.length>=5);
});

test("R3.5: historical four and explicitly inventoried later L2 files exist; archived versions stay inert",()=>{
  const list=readdirSync(resolve(root,"supabase/migrations")).filter(x=>x.endsWith(".sql"));
  const declared=manifest.applied.filter(x=>x.state==="versioned-migration-present");
  // Historical ledger is a dated 8 November snapshot. Three later L2 security files
  // are explicitly inventoried by exact repository blob hash, NOT asserted applied.
  // They are not part of the reduced pickup fixture and are never run in this lab.
  const later={
    "20261111060000_l2_private_chat_payment_acl.sql":"0ecef55bccb6374447636320380961405f4680bc",
    "20261111061500_l2_signup_customer_role_guard.sql":"c3f5204c6dbb2b4e223c2a0c5afb7905e86868aa",
    "20261111061600_l2_rider_notification_acl.sql":"6975e7df126b5e39dd98f00cfc7f7e5a09603c36",
  };
  assert.deepEqual(list.sort(),[...declared.map(x=>x.repo_source.split("/").at(-1)),...Object.keys(later)].sort(),
    "Mismatch: versioned SQL list must be reconciled before claiming parity");
  for(const [name,sha] of Object.entries(later)){
    const raw=readFileSync(resolve(root,"supabase/migrations",name));
    assert.equal(createHash("sha1").update("blob "+raw.length+"\0").update(raw).digest("hex"),sha,"Later L2 source drift: "+name);
  }
  for(const m of declared){
    assert.ok(read(m.repo_source).length>200,"Missing migration "+m.version);
    assert.ok(m.repo_source.endsWith(m.version+"_"+m.name+".sql"));
  }
});

test("R3.6: all four missing applied statements recovered in inert archive",()=>{
  const recovered=manifest.applied.filter(x=>x.state==="recorded-statement-archived-not-versioned");
  assert.equal(recovered.length,4);
  const catalog=JSON.parse(read("supabase/recovered_applied_readonly/R36_APPLIED_STATEMENTS_MANIFEST.json"));
  assert.equal(catalog.versions.length,4);
  assert.equal(catalog.historical_source_recovered,true);
  assert.equal(catalog.deployable_migration_chain_complete,false);
  assert.equal(catalog.effective_full_schema_parity_verified,false);
  for(const m of recovered){
    const v=catalog.versions.find(x=>x.version===m.version && x.name===m.name);
    assert.ok(v,"Missing archive provenance for "+m.version);
    assert.equal(v.archived_path,m.repo_source);
    assert.match(m.repo_source,/^supabase\/recovered_applied_readonly\/\d{14}_.+\.sql\.txt$/);
    const raw=readFileSync(resolve(root,m.repo_source));
    assert.equal(raw.toString("utf8").length,v.recorded_sql_utf8_char_length);
    assert.equal(createHash("md5").update(raw).digest("hex"),v.recorded_sql_md5);
    assert.equal(v.recorded_statement_count,1);
    assert.ok(m.review_draft && read(m.review_draft).length>100);
    assert.ok(!readdirSync(resolve(root,"supabase/migrations")).some(x=>x.startsWith(m.version)));
  }
  assert.equal(manifest.complete,false,"History recovered != whole schema parity");
});

test("R3.6: original payment migration recovered without rewriting effective-only fixture",()=>{
  const m=manifest.applied.find(x=>x.version==="20261101160331");
  assert.equal(m.name,"pickup_payment_methods");
  assert.match(read(m.repo_source),/set local lock_timeout = '5s'/);
  assert.match(read(m.repo_source),/create function public.pickup_payment_method_guard/);
  assert.match(read(m.repo_source),/create function public.merchant_set_pickup_payment_methods/);
  assert.match(read(m.review_draft),/OBSERVED BEHAVIOR RECONSTRUCTION/);
  assert.equal(manifest.complete,false);
});

test("R3.5: offline runners never connect to Production or publish DB ports",()=>{
  for(const p of [
    "localeats-api/tests/pickup/r34/run-local-pickup-r34.sh",
    "localeats-api/tests/pickup/r35/run-local-pickup-r35.sh",
  ]){
    const s=read(p);
    assert.match(s,/postgres:17-alpine/);
    assert.match(s,/docker run/);
    assert.doesNotMatch(s,/(?:db push|apply_migration|SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL|supabase\.co)/i);
    assert.doesNotMatch(s,/(-p\s+\d+:\d+|--publish\b)/);
  }
});
