// L3-N7B5G: original navigation attention hook, entirely synthetic Chromium.
// No live network, user identity, FCM permissions, backend orders or writes.
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {resolve} from "node:path";
import {build} from "esbuild";
import {chromium} from "playwright";

const root=process.cwd();
const css=readdirSync(resolve(root,"dist/assets")).filter(x=>x.endsWith(".css"))
 .map(x=>readFileSync(resolve(root,"dist/assets",x),"utf8")).join("\n");
assert(css.includes(".flex"),"Merchant production stylesheet is required");
const out=await build({
 entryPoints:[resolve(root,"tests/l3-n7b5g/fixture-entry.tsx")],
 bundle:true,write:false,platform:"browser",format:"iife",target:"es2022",jsx:"automatic",logLevel:"warning",
 define:{"import.meta.env":JSON.stringify({PROD:false,VITE_PICKUP_ORDERING_ENABLED:"false"})}
});
const js=out.outputFiles[0].text;
const origin="https://offline-local-l3-n7b5g.test";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
let assertions=0;
try{
 for(const width of [320,390,1280]){
  const ctx=await browser.newContext({viewport:{width,height:900},serviceWorkers:"block",reducedMotion:"no-preference"});
  const writes=[],external=[],errors=[];
  await ctx.route("**/*",async route=>{
   const request=route.request(),url=new URL(request.url());
   if(request.method()!=="GET")writes.push(request.url());
   if(url.origin!==origin){external.push(request.url());return route.abort();}
   if(request.method()!=="GET")return route.abort();
   if(url.pathname==="/")return route.fulfill({
    status:200,contentType:"text/html",
    headers:{"Content-Security-Policy":"default-src 'self'; connect-src 'none'; img-src 'self' data:; font-src 'self' data:"},
    body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/merchant.css"></head><body><div id="root"></div><script src="/merchant.js"></script></body></html>'
   });
   if(url.pathname==="/merchant.js")return route.fulfill({status:200,contentType:"text/javascript",body:js});
   if(url.pathname==="/merchant.css")return route.fulfill({status:200,contentType:"text/css",body:css});
   return route.abort();
  });
  const page=await ctx.newPage();
  page.on("pageerror",error=>errors.push(error.message));
  const pulse=async id=>page.getByTestId("pulse-"+id).textContent();
  const quiet=async id=>{assert.equal(await pulse(id),"quiet",id+" should not animate at "+width+"px");assertions++;};
  const active=async id=>{
   // A verified data change is consumed by a post-commit React effect.
   // Wait briefly, but fail when no actual visual cue is produced.
   await page.waitForFunction(target=>{
    const value=document.querySelector(`[data-testid="pulse-${target}"]`)?.textContent;
    return value!==undefined && value!=="quiet";
   },id,{timeout:950});
   assert.notEqual(await pulse(id),"quiet",id+" should animate at "+width+"px");assertions++;
  };
  try{
   await page.goto(origin+"/",{waitUntil:"domcontentloaded"});
   await page.getByTestId("attention-hook").waitFor({timeout:15000});
   await quiet("orders");
   await quiet("menu");
   assert.equal(await page.getByTestId("topic-new-order").textContent(),"orders");assertions++;
   assert.equal(await page.getByTestId("topic-inventory").textContent(),"menu");assertions++;
   assert.equal(await page.getByTestId("topic-payment").textContent(),"payments");assertions++;

   // First verified read creates a baseline, never a fake new-order alert.
   await page.getByTestId("verify-a").click();
   await quiet("orders");
   await page.getByTestId("capture-callback").click();
   await page.getByTestId("new-a-order").click();
   await active("orders");
   const pulseA=await pulse("orders");

   // Freshness and scope transitions must invalidate all old movement.
   await page.getByTestId("switch-b-unverified").click();
   assert.equal(await page.getByTestId("owner").textContent(),"owner-b:shop-b");assertions++;
   await quiet("orders");
   await page.getByTestId("invoke-old-callback").click();
   await quiet("orders");
   await page.getByTestId("new-b-order").click();
   await quiet("orders"); // still unverified
   await page.getByTestId("verify-b").click();
   await quiet("orders"); // first new verified B read = baseline
   await page.getByTestId("new-b-order").click();
   await active("orders");
   const pulseB=await pulse("orders");
   assert.notEqual(pulseB,pulseA,"Scope B must have a newly scoped nonce");assertions++;

   // Navigating a destination clears its movement, without acknowledging facts.
   await page.getByTestId("trigger-marketing").click();
   await active("marketing");
   await active("orders");
   await page.getByTestId("tab-marketing").click();
   await quiet("marketing");
   await active("orders");
   await page.getByTestId("tab-orders").click();
   await quiet("orders");

   // Stock changes animate only following a verified same-shop menu baseline.
   await page.getByTestId("tab-home").click();
   await page.getByTestId("new-stock").click();
   await active("menu");
   await quiet("orders");
   await page.getByTestId("tab-menu").click();
   await quiet("menu");

   // A topic manually selected from an existing notice can animate its own tab.
   await page.getByTestId("trigger-payment").click();
   await active("payments");
   await page.waitForTimeout(1210);
   await quiet("payments");

   // Reduced-motion preference suppresses movement without suppressing data.
   await page.emulateMedia({reducedMotion:"reduce"});
   await page.getByTestId("trigger-new-order").click();
   await quiet("orders");
   await page.getByTestId("trigger-payment").click();
   await quiet("payments");
   await page.emulateMedia({reducedMotion:"no-preference"});
   await page.getByTestId("trigger-new-order").click();
   await active("orders");

   // A second pulse must not be cleared by the earlier pulse's timer.
   await page.waitForTimeout(430);
   await page.getByTestId("trigger-new-order").click();
   const newer=await pulse("orders");
   await page.waitForTimeout(770);
   assert.equal(await pulse("orders"),newer,"Earlier timeout cleared newer cue");assertions++;
   await page.waitForTimeout(470);
   await quiet("orders");

   // A scope-specific callback retained for B cannot animate owner A.
   await page.getByTestId("capture-callback").click();
   await page.getByTestId("verify-a").click();
   await quiet("orders");
   await page.getByTestId("invoke-old-callback").click();
   await quiet("orders");

   // Destroying the hook clears cue state and timers; old callbacks are inert.
   await page.getByTestId("trigger-new-order").click();
   await active("orders");
   await page.getByTestId("capture-callback").click();
   await page.getByTestId("unmount").click();
   await page.getByTestId("attention-hook").waitFor({state:"detached"});
   await page.getByTestId("invoke-old-callback").click();
   await page.getByTestId("remount").click();
   await page.getByTestId("attention-hook").waitFor();
   await quiet("orders");
   await quiet("menu");
   assert.equal(writes.length,0,"No network mutations were made");assertions++;
   assert.deepEqual(external,[],"No external requests should be attempted");assertions++;
   assert.deepEqual(errors,[],"React lifecycle produced browser errors");assertions++;
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
   assert(overflow<=2,"Unexpected viewport overflow "+overflow+" at "+width);assertions++;
  }finally{await ctx.close();}
 }
}finally{await browser.close();}
console.log(`L3_N7B5G_ATTENTION_BROWSER_PASS assertions=${assertions} widths=320,390,1280 no-network no-writes reduced-motion`);
