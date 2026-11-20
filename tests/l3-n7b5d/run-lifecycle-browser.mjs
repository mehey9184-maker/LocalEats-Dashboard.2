// L3-N7B5D local-only Chromium check. Every resource is fulfilled in memory.
// No hosted app, backend, service worker, account, payment or order can be reached.
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {resolve} from "node:path";
import {build} from "esbuild";
import {chromium} from "playwright";

const root=process.cwd(), fixtureRoot=resolve(root,"tests/l3-n7b5d");
const styles=readdirSync(resolve(root,"dist/assets")).filter(file=>file.endsWith(".css"))
 .map(file=>readFileSync(resolve(root,"dist/assets",file),"utf8")).join("\n");
assert(styles.includes(".flex"),"Merchant's actual compiled stylesheet is required");
const stubs={
 firebase:resolve(root,"tests/l3-n6/fixture-auth.ts"),
 apiAuth:resolve(root,"tests/l3-n6/fixture-api-auth.ts"),
 supabase:resolve(root,"tests/l3-n6b/fixture-supabase.ts"),
 useAuthGuard:resolve(root,"tests/l3-n6b/fixture-auth-guard.ts"),
 OrderService:resolve(root,"tests/l3-n6b/fixture-order-service.ts")
};
const out=await build({
 entryPoints:[resolve(fixtureRoot,"fixture-entry.tsx")],bundle:true,write:false,
 platform:"browser",format:"iife",target:"es2022",jsx:"automatic",logLevel:"warning",
 define:{"import.meta.env":JSON.stringify({
  VITE_MERCHANT_PREVIEW_READ_ONLY:"true",
  VITE_PAYMENTS_PLAN_DEMO_ENABLED:"true",
  VITE_PICKUP_ORDERING_ENABLED:"false",
  VITE_MERCHANT_FAKE_ORDERS_ENABLED:"false",
  VITE_LOCALEATS_API_URL:"http://127.0.0.1:0",
  PROD:false
 })},
 plugins:[{name:"l3-n7b5d-block-real-backends",setup(plugin){
  for(const [target,path]of Object.entries(stubs))
   plugin.onResolve({filter:new RegExp("[/\\\\]"+target+"$")},()=>({path}));
 }}]
});
const bundle=out.outputFiles[0].text;
const host="local-eats-dashboard-2-6m8o-isolatedtest-mehey9184-makers-projects.vercel.app";
const origin="https://"+host;
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
let assertions=0;
try {
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:"block"});
  await context.addInitScript(()=>{
   localStorage.setItem("l3-n7b5d-style:fixture-a","expediter");
   localStorage.setItem("l3-n7b5d-style:fixture-b","compact");
  });
  const blocked=[],writes=[];
  await context.route("**/*",async route=>{
   const req=route.request(),url=new URL(req.url());
   if(req.method()!=="GET")writes.push(req.url());
   if(url.origin!==origin){blocked.push(req.url());return route.abort();}
   if(req.method()!=="GET")return route.abort();
   if(url.pathname==="/")return route.fulfill({status:200,contentType:"text/html",
    headers:{"Content-Security-Policy":"default-src 'self'; connect-src 'none'; img-src 'self' data:; font-src 'self' data:"},
    body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>'});
   if(url.pathname==="/fixture.js")return route.fulfill({status:200,contentType:"application/javascript",body:bundle});
   if(url.pathname==="/fixture.css")return route.fulfill({status:200,contentType:"text/css",body:styles});
   return route.abort();
  });
  const page=await context.newPage(),errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  try {
   await page.goto(origin+"/",{waitUntil:"domcontentloaded"});
   await page.getByTestId("payments-plan-preview").waitFor({timeout:15000});
   await page.getByTestId("orders-focused-workspace").waitFor();
   assert.equal(await page.getByRole("button",{name:"A · Expediter"}).getAttribute("aria-pressed"),"true"); assertions++;
   assert.equal(await page.getByRole("button",{name:"B · Compact"}).getAttribute("aria-pressed"),"false"); assertions++;
   assert(await page.getByText("Free introductory period",{exact:true}).isVisible()); assertions++;
   const clock=page.getByTestId("live-clock-probe").getByTestId("sample-plan-clock");
   const before=await clock.innerText();
   await page.waitForTimeout(1200);
   const after=await clock.innerText();
   assert.notEqual(before,after,"Subscription countdown must continue ticking"); assertions++;
   // Synthetic preview sample is visible only on a permitted preview hostname.
   await page.getByRole("button",{name:"Preview: show sample countdown"}).click();
   assert.equal(await page.getByTestId("sample-subscription-countdown").count(),1); assertions++;
   // Filter belongs to a shop key and must not carry between synthetic merchants.
   await page.getByRole("button",{name:"Search orders"}).click();
   await page.getByRole("searchbox",{name:"Search order ID, customer or product"}).fill("private-filter-a");
   assert.equal(await page.getByRole("searchbox",{name:"Search order ID, customer or product"}).inputValue(),"private-filter-a"); assertions++;
   await page.getByTestId("switch-merchant").click();
   assert(await page.getByText("Synthetic identity: test-owner-b").isVisible()); assertions++;
   assert.equal(await page.getByTestId("sample-subscription-countdown").count(),0); assertions++;
   assert.equal(await page.getByRole("searchbox",{name:"Search order ID, customer or product"}).count(),0); assertions++;
   assert.equal(await page.getByRole("button",{name:"B · Compact"}).getAttribute("aria-pressed"),"true"); assertions++;
   // A distinct B preference is saved only to the B-local UI storage key.
   await page.getByRole("button",{name:"A · Expediter"}).click();
   assert.equal(await page.evaluate(()=>localStorage.getItem("l3-n7b5d-style:fixture-b")),"expediter"); assertions++;
   await page.getByTestId("switch-merchant").click();
   assert(await page.getByText("Synthetic identity: test-owner-a").isVisible()); assertions++;
   assert.equal(await page.getByTestId("sample-subscription-countdown").count(),0); assertions++;
   assert.equal(await page.getByRole("button",{name:"A · Expediter"}).getAttribute("aria-pressed"),"true"); assertions++;
   assert.equal(await page.evaluate(()=>localStorage.getItem("l3-n7b5d-style:fixture-a")),"expediter"); assertions++;
   assert.equal(await page.getByText(/Pickup order, payment and collection changes are currently disabled/).count(),1); assertions++;
   assert.equal(writes.length,0,"No browser mutation requests permitted"); assertions++;
   assert.equal(errors.length,0,"Unexpected browser runtime errors: "+errors.join("; ")); assertions++;
   assert.equal(blocked.filter(url=>/firebase|supabase|firestore|\/api\/v1\//i.test(url)).length,0,
    "A test must not attempt a hosted data or auth network request"); assertions++;
  }finally{await context.close();}
 }
}finally{await browser.close();}
console.log(`L3_N7B5D_LIFECYCLE_BROWSER_PASS assertions=${assertions} widths=390,1280 no-hosted-network no-writes`);
