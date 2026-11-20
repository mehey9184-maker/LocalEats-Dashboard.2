// L3-N7B5F: real ConnectivityMonitor rendered against an in-memory fake backend.
// Chromium is denied ALL external network requests, service workers and writes.
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {resolve} from "node:path";
import {build} from "esbuild";
import {chromium} from "playwright";
const root=process.cwd();
const css=readdirSync(resolve(root,"dist/assets")).filter(x=>x.endsWith(".css"))
 .map(x=>readFileSync(resolve(root,"dist/assets",x),"utf8")).join("\n");
assert(css.includes(".flex"),"Must render shipping Merchant CSS");
const stub=resolve(root,"tests/l3-n7b5f/fixture-connectivity.ts");
const out=await build({
 entryPoints:[resolve(root,"tests/l3-n7b5f/fixture-entry.tsx")],
 bundle:true,write:false,platform:"browser",format:"iife",target:"es2022",jsx:"automatic",logLevel:"warning",
 define:{"import.meta.env":JSON.stringify({
  VITE_PICKUP_ORDERING_ENABLED:"false",VITE_MERCHANT_PREVIEW_READ_ONLY:"true",
  VITE_LOCALEATS_API_URL:"http://127.0.0.1:0",PROD:false
 })},
 plugins:[{name:"deny-real-connectivity-adapters",setup(plugin){
  for(const name of ["supabase","offlineSyncQueue","errorHandler"])
   plugin.onResolve({filter:new RegExp("[/\\\\]"+name+"$")},()=>({path:stub}));
 }}]
});
const code=out.outputFiles[0].text;
const origin="https://offline-local-l3-n7b5f.test";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
let checks=0;
try {
 for(const width of [320,390,1280]){
  const ctx=await browser.newContext({viewport:{width,height:900},serviceWorkers:"block"});
  const writes=[],external=[],errors=[];
  await ctx.route("**/*",async route=>{
   const request=route.request(),url=new URL(request.url());
   if(request.method()!=="GET")writes.push(request.url());
   if(url.origin!==origin){external.push(request.url());return route.abort();}
   if(request.method()!=="GET")return route.abort();
   if(url.pathname==="/")return route.fulfill({
    status:200,contentType:"text/html",
    headers:{"Content-Security-Policy":"default-src 'self'; connect-src 'none'; img-src 'self' data:; font-src 'self' data:"},
    body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>'
   });
   if(url.pathname==="/fixture.js")return route.fulfill({status:200,contentType:"text/javascript",body:code});
   if(url.pathname==="/fixture.css")return route.fulfill({status:200,contentType:"text/css",body:css});
   return route.abort();
  });
  const page=await ctx.newPage();
  page.on("pageerror",error=>errors.push(error.message));
  const monitor=()=>page.locator('button[title*="Channel adapter:"]');
  const hasStatus=async label=>(await monitor().textContent())?.includes(label)??false;
  const waitStatus=async label=>{
   await page.waitForFunction(label=>{
    const badge=document.querySelector('button[title*="Channel adapter:"]');
    return badge?.textContent?.includes(label)??false;
   },label,{timeout:12000});
  };
  const pending=()=>page.evaluate(()=>window.l3n7b5fSynthetic.reads.length);
  const waitPending=async count=>page.waitForFunction(expected=>window.l3n7b5fSynthetic?.reads?.length===expected,count,{timeout:12000});
  try{
   await page.goto(origin+"/",{waitUntil:"domcontentloaded"});
   await monitor().waitFor({timeout:15000});
   await waitPending(1);
   assert(await hasStatus("Connecting"),"Initial diagnostic must not claim connected before a read");checks++;
   assert((await monitor().getAttribute("title")).includes("not pickup API proof"));checks++;
   await page.getByTestId("channel-subscribed").click();
   assert(await hasStatus("Connecting"),"Synthetic SUBSCRIBED does not prove API health");checks++;
   await page.getByTestId("set-offline").click();
   await waitStatus("Offline");
   assert((await monitor().getAttribute("title")).includes("unverified"));checks++;
   await page.getByTestId("probe-success").click();
   assert(await hasStatus("Offline"),"Late successful ping may not turn offline badge green");checks++;
   await page.getByTestId("old-channel-subscribed").click();
   assert(await hasStatus("Offline"),"Late adapter callback may not turn offline badge green");checks++;
   await page.getByTestId("set-online").click();
   await waitPending(1);
   assert(await hasStatus("Connecting"),"Reconnection requires a fresh read");checks++;
   await page.getByTestId("probe-failure").click();
   await waitStatus("Degraded");
   assert(!(await hasStatus("Connected")),"Failed read never claims healthy");checks++;
   await page.getByTestId("set-offline").click();
   await waitStatus("Offline");
   await page.getByTestId("set-online").click();
   await waitPending(1);
   assert(await hasStatus("Connecting"));checks++;
   await page.getByTestId("probe-success").click();
   await waitStatus("Connected");
   assert((await monitor().getAttribute("title")).includes("Legacy read:"));checks++;
   await page.getByTestId("channel-closed").click();
   await waitStatus("Degraded");
   await page.getByTestId("channel-subscribed").click();
   assert(await hasStatus("Degraded"),"Adapter success must not mask a recorded channel error");checks++;
   await page.getByTestId("add-review").click();
   await page.getByRole("button",{name:/3 REVIEW/}).waitFor();
   await page.getByRole("button",{name:/3 REVIEW/}).click();
   assert.equal(await page.getByTestId("record-count").textContent(),"3");checks++;
   assert.equal(await page.getByTestId("write-count").textContent(),"0");checks++;
   await page.getByTestId("clear-review").click();
   await page.getByRole("button",{name:/3 REVIEW/}).waitFor({state:"detached"});
   assert.equal(await page.getByTestId("record-count").textContent(),"0");checks++;
   // Same lifecycle protections must hold when a new merchant scope mounts.
   await page.getByTestId("set-offline").click();
   await waitStatus("Offline");
   await page.getByTestId("set-online").click();
   await waitPending(1);
   await page.getByTestId("switch-synthetic-shop").click();
   await page.getByText("fixture-merchant-b",{exact:true}).waitFor();
   await waitPending(2);
   assert(await hasStatus("Connecting"),"New merchant remains unverified");checks++;
   await page.getByTestId("probe-success").click(); // Old merchant response
   assert(await hasStatus("Connecting"),"Prior merchant request must not authorize new merchant");checks++;
   await page.getByTestId("old-channel-subscribed").click();
   assert(await hasStatus("Connecting"),"Old channel callbacks cannot verify new merchant");checks++;
   await page.getByTestId("probe-success").click(); // New merchant response
   await waitStatus("Connected");
   assert.equal(await page.getByTestId("active-channels").textContent(),"1");checks++;
   await page.getByTestId("toggle-monitor").click();
   await monitor().waitFor({state:"detached"});
   await page.getByTestId("refresh-fixture-values").click();
   assert.equal(await page.getByTestId("active-channels").textContent(),"0");checks++;
   assert.equal(writes.length,0,"No mutation requests permitted");checks++;
   assert.deepEqual(external,[],"No hosted/network requests permitted");checks++;
   assert.deepEqual(errors,[],"React must not throw in lifecycle fixture");checks++;
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
   assert(overflow<=2,"Unexpected horizontal overflow: "+overflow+" at "+width+"px");checks++;
  }finally{await ctx.close();}
 }
}finally{await browser.close();}
console.log(`L3_N7B5F_CONNECTIVITY_BROWSER_PASS assertions=${checks} widths=320,390,1280 no-hosted-network no-writes`);
