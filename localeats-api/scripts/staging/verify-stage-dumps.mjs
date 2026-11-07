// OFFLINE ONLY: verifies dump artifact presence and byte integrity, NOT restore.
// Files may contain secrets/PII. Never commit or upload dumps to GitHub.
// Prints only checksums, sizes, fixed reference and "RESTORE_NOT_VERIFIED".
import {createHash} from "node:crypto";
import {readFileSync,statSync,writeFileSync} from "node:fs";
import {resolve,basename} from "node:path";
import {fileURLToPath} from "node:url";
export const STAGING_REF="rgpbdajhlrwfmhopzgzk";
export const DUMPS=["roles.sql","schema.sql","data.sql","history_schema.sql","history_data.sql"];

export function summarizeDumpFiles(directory,read=readFileSync,stat=statSync){
 const files=[];
 for(const name of DUMPS){
  const path=resolve(directory,name);
  let info;
  try { info=stat(path); } catch { throw Error("Required staging backup artifact missing or empty: "+name); }
  if(!info.isFile() || info.size<16)throw Error("Required staging backup artifact missing or empty: "+name);
  const bytes=read(path);
  if(!Buffer.isBuffer(bytes) || bytes.length!==info.size)throw Error("Backup artifact cannot be verified: "+name);
  const body=bytes.toString("utf8");
  if(name==="schema.sql" && !/(?:CREATE TABLE|create table)\s+(?:"?public"?\.)?"?profiles"?\b/i.test(body)){
   throw Error("Staging profiles table missing from schema dump");
  }
  if(name==="history_schema.sql" && !/schema_migrations/i.test(body)){
   throw Error("Staging migration history schema missing from dump");
  }
  files.push({name:basename(name),bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")});
 }
 return {
  project_ref:STAGING_REF,
  file_integrity:"PASS",
  restore_status:"NOT_VERIFIED",
  cloud_changes:"NONE",
  files,
  warning:"Verify source project independently; encrypt and test an isolated restore. Hash checks alone do NOT satisfy the migration backup gate."
 };
}
export function parseArgs(args){
 if(args.length!==4 || args[0]!=="--directory"||args[2]!=="--manifest") throw Error("Usage: node scripts/staging/verify-stage-dumps.mjs --directory PRIVATE_DIR --manifest PRIVATE_DIR/manifest.json");
 return {directory:args[1],manifest:args[3]};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const {directory,manifest}=parseArgs(process.argv.slice(2));
  const result=summarizeDumpFiles(directory);
  const target=resolve(manifest);
  if(!target.startsWith(resolve(directory)+"/") && !target.startsWith(resolve(directory)+"\\")){
   throw Error("Manifest must remain inside private backup directory");
  }
  writeFileSync(target,JSON.stringify(result,null,2)+"\n",{flag:"wx",mode:0o600});
  console.log("DUMP_FILE_INTEGRITY_PASS_RESTORE_NOT_VERIFIED; "+DUMPS.length+" hashes recorded privately.");
 } catch {
  console.error("Backup artifacts missing/invalid, or manifest exists. No database change performed.");
  process.exitCode=1;
 }
}
