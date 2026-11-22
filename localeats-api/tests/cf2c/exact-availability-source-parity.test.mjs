import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const original=readFileSync(new URL("../../../supabase/drafts/merchant_availability.sql",import.meta.url),"utf8");
const rehearsal=readFileSync(new URL("./exact-availability.SYNTHETIC_ONLY.sql",import.meta.url),"utf8");
function originalFunction(name) {
  const start=original.indexOf("CREATE FUNCTION public."+name+"(");
  assert.ok(start>=0,"Missing actual source function "+name);
  assert.equal(original.indexOf("CREATE FUNCTION public."+name+"(",start+1),-1);
  const end=original.indexOf("$$;",start);
  assert.ok(end>start,"Missing end of "+name);
  return original.slice(start,end+3);
}
test("CF2-C reuses exact original SQL for Johannesburg hours and effective state",()=>{
 for(const name of ["shop_schedule_open","shop_effective_open"]){
   const code=originalFunction(name);
   assert.ok(rehearsal.includes(code),"Rehearsal changed original "+name+" body");
 }
 assert.match(rehearsal,/WITH \(security_invoker = true,security_barrier = true\)/);
});
test("CF2-C SQL is local-only, non-login, non-bypass and cannot grant private columns",()=>{
 assert.match(rehearsal,/CREATE ROLE cf2c_reader NOLOGIN/);
 assert.match(rehearsal,/NOBYPASSRLS/);
 assert.match(rehearsal,/ALTER TABLE public\.shops ENABLE ROW LEVEL SECURITY/);
 assert.match(rehearsal,/CREATE POLICY cf2c_shop_read/);
 assert.match(rehearsal,/GRANT SELECT \(/);
 assert.doesNotMatch(rehearsal,/SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL|supabase\.co|CREATE ROLE .* LOGIN|ALTER ROLE .* LOGIN/);
 const readGrants=rehearsal.match(/GRANT SELECT \([^)]*\) ON public\.shops TO cf2c_reader/);
 assert.ok(readGrants);
 assert.doesNotMatch(readGrants[0],/owner_id|private_notes/);
});
