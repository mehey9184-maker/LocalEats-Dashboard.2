import assert from "node:assert/strict";

// Read-only browser-equivalent CORS verification against the dedicated
// LocalEats API Preview. No login credentials, writes or real orders.
const api="https://localeats-api-git-repair-custo-0b5f1a-mehey9184-makers-projects.vercel.app";
const origins=[
 "https://project-x7cvt-git-repair-custo-0a45c9-mehey9184-makers-projects.vercel.app",
 "https://project-x7cvt-git-repair-custo-49d47e-mehey9184-makers-projects.vercel.app",
 "https://project-x7cvt-7vqksai9s-mehey9184-makers-projects.vercel.app",
];
const path="/api/v1/catalog/shops";
for(const origin of origins){
 const res=await fetch(api+path,{headers:{Origin:origin},signal:AbortSignal.timeout(15000)});
 assert.equal(res.status,200,"GET must be 200 for "+origin);
 assert.equal(res.headers.get("access-control-allow-origin"),origin,
  "Browser response must expose catalog to "+origin);
 const data=await res.json();
 assert.equal(data.success,true);
 assert.ok(data.shops?.some(s=>s.id==="shop-my-kota-ivory-park"),"My-Kota must remain in approved catalog");
 const preflight=await fetch(api+path,{
  method:"OPTIONS",headers:{
   Origin:origin,
   "Access-Control-Request-Method":"GET",
   "Access-Control-Request-Headers":"content-type",
  },signal:AbortSignal.timeout(15000),
 });
 assert.equal(preflight.status,204,"CORS preflight must be allowed for "+origin);
 assert.equal(preflight.headers.get("access-control-allow-origin"),origin,
  "Browser preflight must allow "+origin);
 console.log("PASS: read-only catalog GET + OPTIONS from Customer Preview alias: "+new URL(origin).hostname);
}
const hostile=await fetch(api+path,{
 headers:{Origin:"https://not-local-eats.example.invalid"},
 signal:AbortSignal.timeout(15000),
});
assert.equal(hostile.status,403);
assert.equal(hostile.headers.get("access-control-allow-origin"),null);
console.log("PASS: unknown browser origin denied. No database writes or ordering actions.");
