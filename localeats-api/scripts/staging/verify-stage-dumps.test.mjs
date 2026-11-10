import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,writeFileSync,rmSync,unlinkSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {DUMPS,STAGING_REF,summarizeDumpFiles,parseArgs} from "./verify-stage-dumps.mjs";

const fake={
 "roles.sql":"-- Synthetic example role backup\nSELECT 'example';\n",
 "schema.sql":"-- synthetic only\nCREATE TABLE public.profiles (user_id text primary key);\n",
 "data.sql":"-- Synthetic empty data dump\nSELECT 'no rows';\n",
 "history_schema.sql":"-- synthetic only\nCREATE TABLE supabase_migrations.schema_migrations (version text);\n",
 "history_data.sql":"-- synthetic empty history dump\nSELECT 'no rows';\n"
};
function sandbox(){
 const dir=mkdtempSync(join(tmpdir(),"stage-backup-gate-"));
 for(const [name,body] of Object.entries(fake))writeFileSync(join(dir,name),body);
 return dir;
}
test("Five local artifacts produce checksums but never claim a verified restore",()=>{
 const dir=sandbox();
 try{
  const result=summarizeDumpFiles(dir);
  assert.equal(result.project_ref,STAGING_REF);
  assert.equal(result.file_integrity,"PASS");
  assert.equal(result.restore_status,"NOT_VERIFIED");
  assert.equal(result.files.length,5);
  assert.equal(new Set(result.files.map(f=>f.sha256)).size,5);
  assert.ok(result.files.every(f=>f.bytes>16 && /^[a-f\d]{64}$/.test(f.sha256)));
  assert.match(result.warning,/NOT satisfy/i);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test("A missing, empty or truncated required dump blocks the preparation gate",()=>{
 const dir=sandbox();
 try{
  unlinkSync(join(dir,"data.sql"));
  assert.throws(()=>summarizeDumpFiles(dir),/missing or empty/);
  writeFileSync(join(dir,"data.sql"),"x");
  assert.throws(()=>summarizeDumpFiles(dir),/missing or empty/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test("A misleading schema dump without profiles blocks staging bootstrap",()=>{
 const dir=sandbox();
 try{
  writeFileSync(join(dir,"schema.sql"),"CREATE TABLE public.shops (id text primary key);\n");
  assert.throws(()=>summarizeDumpFiles(dir),/profiles table missing/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test("Missing migration history schema is explicitly detected",()=>{
 const dir=sandbox();
 try{
  writeFileSync(join(dir,"history_schema.sql"),"CREATE TABLE public.anything (id uuid);\n");
  assert.throws(()=>summarizeDumpFiles(dir),/migration history schema missing/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test("The tool requires explicit private directory and manifest arguments",()=>{
 assert.throws(()=>parseArgs([]),/Usage/);
 assert.throws(()=>parseArgs(["--directory","some"]),/Usage/);
 assert.deepEqual(parseArgs(["--directory","private","--manifest","private/manifest.json"]),{directory:"private",manifest:"private/manifest.json"});
});
test("No content of dump is included in the integrity report",()=>{
 const dir=sandbox();
 try{
  writeFileSync(join(dir,"roles.sql"),fake["roles.sql"]+"-- SECRET TEST TOKEN never-print-synthetic\n");
  const result=summarizeDumpFiles(dir);
  assert.doesNotMatch(JSON.stringify(result),/SECRET TEST TOKEN/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
