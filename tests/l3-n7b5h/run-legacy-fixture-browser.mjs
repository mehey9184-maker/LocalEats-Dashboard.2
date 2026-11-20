// L3-N7B5H: actual legacy fixture is bundled with in-memory-only Merchant API.
// Route all files from one fake origin. No hosted endpoints, accounts, FCM or writes.
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {resolve} from "node:path";
import {build} from "esbuild";
import {chromium} from "playwright";

const root=process.cwd();
const stylesheet=readdirSync(resolve(root,"dist/assets")).filter(name=>name.endsWith(".css"))
 .map(name=>readFileSync(resolve(root,"dist/assets",name),"utf8")).join("\n");
assert(stylesheet.includes(".flex"),"Use original built Merchant CSS");
const stub=resolve(root,"tests/l3-n7b5h/fixture-merchant-api.ts");
const result=await build({
 entryPoints:[resolve(root,"tests/l3-n6/fixture-entry.tsx")],
 bundle:true,write:false,platform:"browser",format:"iife",jsx:"automatic",target:"es2022",logLevel:"warning",
 define:{"import.meta.env":JSON.stringify({
  VITE_MERCHANT_PREVIEW_READ_ONLY:"true",
  VITE_PICKUP_ORDERING_ENABLED:"false",
  VITE_MERCHANT_FAKE_ORDERS_ENABLED:"false",
  PROD:false
 })},
 plugins:[{name:"l3n7b5h-block-real-merchant-api",setup(p){
  p.onResolve({filter:/[/\\\\]services[/\\\\]MerchantApi$/},()=>({path:stub}));
 }}]
});
const bundle=result.outputFiles[0].text;
const origin="https://isolated-local-l3-n7b5h.test";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
let checks=0;
try{
 for(const width of [320,390,1280]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:"block"});
  const blocked=[],writes=[],errors=[];
  await context.route("**/*",async route=>{
   const req=route.request(),url=new URL(req.url());
   if(req.method()!=="GET")writes.push(req.url());
   if(url.origin!==origin){blocked.push(req.url());return route.abort();}
   if(req.method()!=="GET")return route.abort();
   if(url.pathname==="/")return route.fulfill({
    status:200,contentType:"text/html",
    headers:{"Content-Security-Policy":"default-src 'self'; connect-src 'none'; img-src 'self' data:; font-src 'self' data:"},
    body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/merchant.css"></head><body><div id="root"></div><script src="/merchant.js"></script></body></html>'
   });
   if(url.pathname==="/merchant.css")return route.fulfill({status:200,contentType:"text/css",body:stylesheet});
   if(url.pathname==="/merchant.js")return route.fulfill({status:200,contentType:"application/javascript",body:bundle});
   return route.abort();
  });
  const page=await context.newPage();
  page.on("pageerror",e=>errors.push(e.message));
  const waitOwners=async values=>page.waitForFunction(expected=>
   JSON.stringify(window.l3n7b5hFixture?.outstanding)===JSON.stringify(expected),
   values,{timeout:12000});
  const resolveOwner=async uid=>page.evaluate(value=>window.l3n7b5hFixture.resolveOwner(value),uid);
  try{
   await page.goto(origin+"/",{waitUntil:"domcontentloaded"});
   await page.getByTestId("fixture-account").waitFor({timeout:15000});
   assert.match(await page.getByTestId("fixture-account").textContent(),/merchant-a/);checks++;
   await waitOwners(["merchant-a"]);
   assert.equal(await page.getByTestId("pickup-card").count(),0);checks++;

   // Switch before A's initial API request resolves. The old A response
   // must never be shown in the merchant B fixture.
   await page.getByTestId("switch-merchant").click();
   await waitOwners(["merchant-a","merchant-b"]);
   await resolveOwner("merchant-b");
   await page.getByTestId("fixture-status").waitFor();
   assert.match(await page.getByTestId("fixture-status").textContent(),/ready_for_pickup \/ unpaid/);checks++;
   const bButton=page.getByRole("button",{name:"Confirm cash received"});
   assert(await bButton.isDisabled(),"Live payment action must remain disabled");checks++;
   await resolveOwner("merchant-a");
   await page.waitForTimeout(30);
   assert.match(await page.getByTestId("fixture-account").textContent(),/merchant-b/);checks++;
   assert.match(await page.getByTestId("fixture-status").textContent(),/ready_for_pickup \/ unpaid/);checks++;

   // Manual refresh and the old event listener still read synthetic B only.
   await page.getByTestId("refresh-order").click();
   await waitOwners(["merchant-b"]);
   await resolveOwner("merchant-b");
   assert.match(await page.getByTestId("fixture-status").textContent(),/ready_for_pickup \/ unpaid/);checks++;
   await page.evaluate(()=>window.dispatchEvent(new Event("merchant-pickup-order-confirmed")));
   await waitOwners(["merchant-b"]);
   await resolveOwner("merchant-b");
   await page.waitForTimeout(25);
   assert.match(await page.getByTestId("fixture-status").textContent(),/ready_for_pickup \/ unpaid/);checks++;

   await page.getByTestId("switch-merchant").click();
   await waitOwners(["merchant-a"]);
   await page.getByTestId("pickup-card").waitFor({state:"detached"});
   await resolveOwner("merchant-a");
   await page.getByTestId("fixture-status").waitFor();
   assert.match(await page.getByTestId("fixture-status").textContent(),/pending \/ unpaid/);checks++;
   assert(await page.getByRole("button",{name:"Accept → Preparing"}).isDisabled());checks++;

   const counters=await page.evaluate(()=>window.l3n7b5hFixture.counters);
   assert.equal(counters.writeCalls,0,"Synthetic Merchant API never made writes");checks++;
   assert(counters.readCalls>=5,"Initial, switched, refresh, event and return read");checks++;
   assert.deepEqual(blocked,[],"Hosted network not allowed");checks++;
   assert.deepEqual(writes,[],"Mutation network forbidden");checks++;
   assert.deepEqual(errors,[],"No browser runtime exceptions");checks++;
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
   assert(overflow<=2,"Unexpected fixture overflow "+overflow+" at "+width);checks++;
  }finally{await context.close();}
 }
}finally{await browser.close();}
console.log(`L3_N7B5H_LEGACY_FIXTURE_BROWSER_PASS assertions=${checks} widths=320,390,1280 no-hosted-network no-writes`);
