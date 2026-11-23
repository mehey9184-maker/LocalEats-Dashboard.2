// CF-W2D: only fictional information; against the ALREADY DEPLOYED isolated Worker.
// This is automated browser emulation, never evidence of a physical phone test.
import {chromium,webkit} from "playwright";
import assert from "node:assert/strict";
import {mkdirSync,writeFileSync} from "node:fs";

const HOST="https://localeats-merchant-dashboard-preview.mehey9184.workers.dev";
const DIR="artifacts/cf-w2d-phone";
mkdirSync(DIR,{recursive:true});
const profiles=[
 {id:"android-small-320",engine:"chromium",viewport:{width:320,height:740},isMobile:true,hasTouch:true,deviceScaleFactor:2},
 {id:"android-390",engine:"chromium",viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2.75},
 {id:"iphone-safari-webkit-375",engine:"webkit",viewport:{width:375,height:812},isMobile:true,hasTouch:true,deviceScaleFactor:3},
 {id:"tablet-768",engine:"chromium",viewport:{width:768,height:1024},isMobile:true,hasTouch:true,deviceScaleFactor:2},
 {id:"desktop-1366",engine:"chromium",viewport:{width:1366,height:900},deviceScaleFactor:1},
];
const report={date:new Date().toISOString(),url:HOST,scope:"emulated web browsers only; physical founder/vendor signoff pending",checks:[],failures:0};
const browsers={chromium:await chromium.launch({headless:true}),webkit:await webkit.launch({headless:true})};
const assertVisible=async page=>{
 await page.getByRole("button",{name:"Orders"}).first().waitFor({state:"visible",timeout:20000});
 assert.ok(await page.getByText("LocalEats Example Shop").count(),"fictional shop required");
 assert.equal(await page.getByRole("button",{name:"Start fictional order arrivals"}).count(),0,"demo simulation must not appear on Home");
};
try {
 for(const profile of profiles){
  const {id,engine,...settings}=profile;
  const context=await browsers[engine].newContext({...settings,serviceWorkers:"block",reducedMotion:"reduce",ignoreHTTPSErrors:false});
  const page=await context.newPage();
  const record={profile:id,engine,status:"FAIL",errors:[],writes:[],externalResponses:[],dialogs:[],measurements:{},steps:[]};
  page.on("pageerror",e=>record.errors.push(String(e)));
  page.on("request",r=>{if(!["GET","HEAD"].includes(r.method()))record.writes.push(r.method()+" "+r.url());});
  page.on("response",r=>{
   if(new URL(r.url()).origin!==HOST && !/^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)/.test(r.url()))
    record.externalResponses.push({url:r.url().slice(0,120),status:r.status()});
  });
  page.on("dialog",async d=>{record.dialogs.push({type:d.type(),text:d.message()});await d.accept("TEST ONLY")});
  try {
   const time=Date.now();
   const response=await page.goto(HOST+"/",{waitUntil:"domcontentloaded",timeout:45000});
   await assertVisible(page);
   record.measurements.homeInteractiveMs=Date.now()-time;
   assert.equal(response.status(),200);
   record.steps.push("Original fictional Home");
   const h=response.headers();
   assert.match(h["content-security-policy"]??"",/connect-src 'none'/);
   assert.match(h["content-security-policy"]??"",/worker-src 'none'/);
   assert.match(h["x-robots-tag"]??"",/noindex/);
   await page.screenshot({path:DIR+"/"+id+"-home.png",animations:"disabled"});
   await page.getByRole("button",{name:"Orders"}).first().click({timeout:10000});
   const start=page.getByRole("button",{name:"Start fictional order arrivals"});
   await start.waitFor({timeout:15000});
   record.steps.push("Original Orders route");
   record.measurements.startControl=await start.boundingBox();
   assert.equal(await page.getByTestId("fake-incoming-order").count(),0,"no fake ticket before manual Start");
   await start.click({timeout:10000});
   await page.getByTestId("fake-incoming-order").first().waitFor({state:"visible",timeout:15000});
   assert.ok(await page.getByText("Fake · Test only").count(),"visible fictional-order label");
   record.steps.push("Start fictional arrivals / FAKE ticket displayed");
   await page.getByRole("button",{name:"Stop fictional order arrivals"}).click({timeout:10000});
   await start.waitFor({timeout:10000});
   record.steps.push("Stop fictional arrivals");
   const pending=page.getByRole("button",{name:"Accept → Preparing"}).first();
   await pending.click({timeout:12000});
   if(settings.viewport.width<768)await page.getByRole("tab",{name:/Preparing/}).click({timeout:10000});
   await page.getByRole("button",{name:"Mark Ready"}).first().waitFor({state:"visible",timeout:12000});
   record.steps.push("Accepted → Preparing lane");
   await page.getByRole("button",{name:"Mark Ready"}).first().click({timeout:12000});
   if(settings.viewport.width<768)await page.getByRole("tab",{name:/Ready/}).click({timeout:10000});
   await page.getByRole("button",{name:"Confirm cash received"}).first().waitFor({state:"visible",timeout:12000});
   record.steps.push("Marked Ready → Ready lane");
   await page.getByRole("button",{name:"Confirm cash received"}).first().click({timeout:12000});
   await page.getByRole("button",{name:"Confirm handover"}).first().waitFor({state:"visible",timeout:12000});
   record.steps.push("Simulated counter payment");
   await page.getByRole("button",{name:"Confirm handover"}).first().click({timeout:12000});
   record.steps.push("Simulated food handover");
   assert.equal(record.dialogs.length,2,"payment and handover must each require confirmation");
   assert.ok(record.dialogs.every(d=>d.text.includes("TEST ONLY")),"confirmation dialogs must say TEST ONLY");
   const size=await page.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,innerHeight}));
   record.measurements.layout=size;
   assert.ok(size.scrollWidth<=size.viewport+2,"horizontal overflow "+JSON.stringify(size));
   assert.deepEqual(record.writes,[],"demo should never submit an HTTP write");
   assert.deepEqual(record.errors,[],"no JavaScript runtime errors");
   assert.ok(record.externalResponses.every(r=>!/localeatssa|firebase|supabase|google\.com/.test(r.url)),"unexpected external data exchange");
   await page.screenshot({path:DIR+"/"+id+"-pickup-completed.png",animations:"disabled"});
   await page.reload({waitUntil:"domcontentloaded",timeout:30000});
   await assertVisible(page);
   await page.getByRole("button",{name:"Orders"}).first().click({timeout:10000});
   await start.waitFor({timeout:12000});
   assert.equal(await page.getByTestId("fake-incoming-order").count(),0,"fake orders must reset on refresh");
   record.steps.push("Refresh clears fictional state");
   const res=await page.request.get(HOST+"/api/v1/merchant/orders");
   assert.equal(res.status(),404,"no Merchant API route on demo");
   record.steps.push("No Merchant API route");
   record.status="PASS";
   console.log("PASS "+id+": "+record.steps.join(" | "));
  }catch(e){
   report.failures++;
   record.failure=String(e).slice(0,1100);
   console.error("FAIL "+id+": "+record.failure);
   try{await page.screenshot({path:DIR+"/"+id+"-failure.png",timeout:4000})}catch{}
  }finally {
   report.checks.push(record);
   await context.close();
  }
 }
}finally {
 await Promise.allSettled(Object.values(browsers).map(b=>b.close()));
 writeFileSync(DIR+"/results.json",JSON.stringify(report,null,2));
}
console.log("CF_W2D_DEVICE_REHEARSAL_TESTS="+report.checks.length+" PASS="+report.checks.filter(c=>c.status==="PASS").length+" FAIL="+report.failures);
if(report.failures)process.exit(1);
