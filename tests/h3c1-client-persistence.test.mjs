import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
test("merchant direct business writes and unverified media fail closed",()=>{
 const f=read("src/lib/firebase.ts");
 for(const name of ["updateFirestoreShop","updateFirestoreMenuItem","createFirestoreMenuItem","deleteFirestoreMenuItem"]){
  const body=f.split("export async function "+name+"(")[1].split("\n}")[0];
  assert.match(body,/No changes were saved/);
  assert.doesNotMatch(body,/await (setDoc|deleteDoc|updateDoc)/);
 }
 assert.match(f,/No records were migrated/);
 assert.match(f,/No file was uploaded/);
 assert.doesNotMatch(f,/uploadBytes\(/);
 const bridge=read("src/lib/supabase.ts");
 assert.match(bridge,/if \(this.insertData !== undefined \|\| this.updateData !== undefined \|\| this.isDelete\)/);
 assert.doesNotMatch(bridge,/await (setDoc|updateDoc|deleteDoc|runTransaction)/);
});
test("merchant deferred settings and shop location cannot cache or show false saved state",()=>{
 const a=read("src/App.tsx");
 assert.match(a,/Delivery settings are unavailable during pickup-only launch/);
 assert.equal((a.match(/Terminal linking is not active\. No changes were saved/g)||[]).length,3);
 assert.doesNotMatch(a,/\.update\(\{ (require_terminal_sync|terminal_provider|terminal_serial)/);
 const s=read("src/components/ShopProfile.tsx");
 assert.match(s,/Shop profile changes require the verified API/);
 assert.doesNotMatch(s,/localStorage\.setItem\("localeats_cached_shops"|Shop profile updated successfully/);
 const l=read("src/hooks/useShopLocation.ts");
 assert.match(l,/Shop location changes require the verified API/);
 assert.doesNotMatch(l,/Shop location & area filter saved|localStorage\.setItem\("localeats_cached_shops"/);
});
