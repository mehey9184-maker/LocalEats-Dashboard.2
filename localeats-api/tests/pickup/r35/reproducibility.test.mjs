// R3.5 OFFLINE audit. No Supabase API, network or real customer records.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
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
    "draft-only-not-versioned":3,
    "effective-behavior-only-not-original":1,
  });
  assert.ok(manifest.manually_pending.length>=5);
});

test("R3.5: original four versioned migration files exist, later versions not impersonated",()=>{
  const list=readdirSync(resolve(root,"supabase/migrations")).filter(x=>x.endsWith(".sql"));
  const declared=manifest.applied.filter(x=>x.state==="versioned-migration-present");
  assert.deepEqual(list.sort(),declared.map(x=>x.repo_source.split("/").at(-1)).sort(),
    "Mismatch: versioned SQL list must be reconciled before claiming parity");
  for(const m of declared){
    assert.ok(read(m.repo_source).length>200,"Missing migration "+m.version);
    assert.ok(m.repo_source.endsWith(m.version+"_"+m.name+".sql"));
  }
});

test("R3.5: October pickup SQL remains a review draft, not a forged migration",()=>{
  for(const m of manifest.applied.filter(x=>x.state==="draft-only-not-versioned")){
    assert.match(m.repo_source,/^supabase\/drafts\/.+\.sql$/);
    assert.ok(read(m.repo_source).length>100);
    assert.ok(!readdirSync(resolve(root,"supabase/migrations")).some(x=>x.startsWith(m.version)));
  }
});

test("R3.5: missing November migration is modeled as effective behavior ONLY",()=>{
  const m=manifest.applied.find(x=>x.version==="20261101160331");
  assert.equal(m.name,"pickup_payment_methods");
  assert.match(m.repo_source,/SYNTHETIC_ONLY\.sql$/);
  const sql=read(m.repo_source);
  assert.match(sql,/OBSERVED BEHAVIOR RECONSTRUCTION/);
  assert.match(sql,/merchant_set_pickup_payment_methods/);
  assert.match(sql,/pickup_payment_method_guard/);
  assert.ok(!readdirSync(resolve(root,"supabase/migrations")).some(x=>x.startsWith(m.version)));
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
