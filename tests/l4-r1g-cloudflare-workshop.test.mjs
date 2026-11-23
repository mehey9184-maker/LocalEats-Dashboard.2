import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
execFileSync(process.execPath,["scripts/build-workshop-worker.mjs"],{stdio:"pipe"});
const compiled=await import(new URL("../dist/workshop-worker.mjs",import.meta.url));
const worker=compiled.default;
const host="https://localeats-r1g-merchant-workshop.mehey9184.workers.dev";
const ask=(path="/",method="GET",origin=host)=>worker.fetch(new Request(origin+path,{method}));
test("exact isolated Cloudflare Workers preview host only",async()=>{
 assert.equal((await ask()).status,200);
 for(const other of ["https://dashboard.localeatssa.co.za","https://localeatssa.co.za",
  "https://evil.workers.dev","https://localeats-r1g-merchant-workshop.mehey9184.workers.dev.evil.tld",
  "http://localeats-r1g-merchant-workshop.mehey9184.workers.dev"])
  assert.equal((await ask("/","GET",other)).status,404);
});
test("all writes and unknown API/auth/payment routes forbidden",async()=>{
 for(const method of ["POST","PUT","PATCH","DELETE","OPTIONS"]){
  const r=await ask("/",method);assert.equal(r.status,405);
  assert.equal(r.headers.get("allow"),"GET, HEAD");
 }
 for(const path of ["/api/v1/orders","/api/v1/merchant/shop","/checkout","/payments","/auth","/.env","/workshop.js.map"]){
  const r=await ask(path);assert.equal(r.status,404);
 }
});
test("CSP refuses external network and identity, all responses no-store",async()=>{
 for(const path of ["/","/workshop.js","/workshop.css","/absent"]){
  const r=await ask(path);
  const csp=r.headers.get("content-security-policy");
  assert.match(csp,/connect-src 'none'/);
  assert.match(csp,/form-action 'none'/);
  assert.match(csp,/frame-ancestors 'none'/);
  assert.equal(r.headers.get("cache-control"),"no-store");
  assert.match(r.headers.get("permissions-policy"),/geolocation=\(\)/);
  assert.equal(r.headers.get("access-control-allow-origin"),null);
  assert.equal(r.headers.get("set-cookie"),null);
 }
});
test("sample orders and counter payment remain strictly local in browser memory",async()=>{
 const html=await (await ask()).text();
 const js=await (await ask("/workshop.js")).text();
 for(const term of ["FICTIONAL ORDERS ONLY","READ-ONLY WORKSHOP","Sample menu","Simulate order"])assert.match(html,new RegExp(term));
 for(const term of ["Fictional Customer A","Payment simulated","No real transaction occurred","orders.length>=15"])assert.ok(js.includes(term),term);
 for(const unsafe of [/\bfetch\s*\(/,/XMLHttpRequest/,/localStorage/,/sessionStorage/,/WebSocket/,/firebase/i,/supabase/i,/Authorization:/,/navigator\.geolocation/])
  assert.doesNotMatch(js,unsafe);
 assert.match(js,/order\.paid/);
 assert.match(js,/order\.status==="ready"&&order\.paid/);
});
test("narrow-screen layout and accessibility landmarks exist; physical device approval still separate",async()=>{
 const html=await (await ask("/")).text();
 const css=await (await ask("/workshop.css")).text();
 assert.match(html,/name="viewport"/);
 assert.match(html,/aria-live="polite"/);
 assert.match(html,/aria-label="Workshop navigation"/);
 assert.match(html,/id="orders-heading"/);
 assert.match(css,/@media\(max-width:530px\)/);
 assert.match(css,/@media\(max-width:850px\)/);
 assert.match(css,/:focus-visible/);
 const head=await ask("/","HEAD");assert.equal(head.status,200);assert.equal(await head.text(),"");
});
