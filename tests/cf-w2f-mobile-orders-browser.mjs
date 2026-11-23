import {chromium} from "playwright";
import assert from "node:assert/strict";
import {mkdirSync,writeFileSync} from "node:fs";

const HOST="https://localeats-merchant-dashboard-preview.mehey9184.workers.dev";
const LOCAL="http://127.0.0.1:4177";
const DIR="artifacts/cf-w2f-mobile-orders";
mkdirSync(DIR,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
let failures=0;

for(const [width,height] of [[320,740],[390,844],[768,1024],[1366,900]]){
 const mobile=width<768;
 const ctx=await browser.newContext({
   viewport:{width,height},deviceScaleFactor:mobile?2:1,
   isMobile:mobile,hasTouch:mobile,serviceWorkers:"block",reducedMotion:"reduce"
 });
 const page=await ctx.newPage();
 const item={width,height,mobile,steps:[],requests:[],errors:[],success:false};
 try{
   page.on("pageerror",e=>item.errors.push(String(e)));
   page.on("request",r=>{if(!["GET","HEAD"].includes(r.method()))item.requests.push(r.method()+" "+r.url())});
   page.on("dialog",async d=>{item.steps.push("test confirmation: "+d.message().slice(0,90));await d.accept()});
   await page.route("**/*",async route=>{
     const req=route.request(),url=new URL(req.url());
     if(url.origin!==HOST){
       await route.abort("blockedbyclient");return;
     }
     if(!["GET","HEAD"].includes(req.method())){await route.abort("blockedbyclient");return;}
     const rsp=await route.fetch({url:LOCAL+url.pathname+url.search,maxRedirects:0});
     const headers={...rsp.headers(),
       "content-security-policy":"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'"};
     await route.fulfill({response:rsp,headers});
   });
   const response=await page.goto(HOST+"/",{waitUntil:"domcontentloaded",timeout:40000});
   assert.equal(response.status(),200);
   await page.getByRole("button",{name:"Orders"}).first().waitFor({timeout:17000});
   assert.ok(await page.getByText("LocalEats Example Shop").count());
   await page.getByRole("button",{name:"Orders"}).first().click();
   const start=page.getByRole("button",{name:"Start fictional order arrivals"});
   await start.waitFor({state:"visible",timeout:18000});
   const alert=page.getByRole("button",{name:"Enable simulated browser notifications"});
   await alert.waitFor({state:"visible",timeout:7000});
   const hdr=page.getByTestId("orders-mobile-header"),queue=page.getByTestId("orders-queue-card");
   const h=await hdr.boundingBox(),q=await queue.boundingBox(),sr=await start.boundingBox(),ar=await alert.boundingBox();
   item.headerHeight=h?.height;
   item.queueTop=q?.y;
   item.startButton=sr?{x:Math.round(sr.x),y:Math.round(sr.y),w:Math.round(sr.width),h:Math.round(sr.height)}:null;
   item.alertButton=ar?{x:Math.round(ar.x),y:Math.round(ar.y),w:Math.round(ar.width),h:Math.round(ar.height)}:null;
   if(mobile){
     assert.ok(h.height<(width===320?310:270),"mobile header should no longer be a stack: "+h.height);
     assert.ok(Math.abs(sr.y-ar.y)<3,"start and alert buttons must share one row");
     assert.ok(sr.height>=43.5&&ar.height>=43.5,"44px touch targets must survive");
     assert.equal(await page.getByRole("button",{name:"Simulate a fake incoming pickup order"}).isVisible(),false);
     assert.equal(await page.getByRole("group",{name:"Choose your Orders style"}).isVisible(),false);
     assert.equal(await page.getByRole("group",{name:"Queue status"}).isVisible(),false);
     assert.equal(await page.locator('button[title="Help & Tips"]').isVisible(),false,"floating help must not cover tickets");
     assert.equal(await page.getByRole("button",{name:"Legal & Privacy (POPIA)"}).isVisible(),false,"legal floating chip must not cover the nav");
     assert.equal(await page.getByRole("combobox",{name:"Sort mobile orders"}).count(),1);
     const tabs=page.getByRole("tablist",{name:"Mobile kitchen lane"}).getByRole("tab");
     assert.equal(await tabs.count(),4);
     for(let i=0;i<4;i++){
       const b=await tabs.nth(i).boundingBox();
       assert.ok(b&&b.x>=0&&b.x+b.width<=width+0.5,"all 4 tabs must fit screen; tab "+i);
       assert.ok(b.width>=43,"stage touch target should be usable");
       assert.ok(b.height>=43,"stage touch target at least 44px");
     }
     const tool=page.locator("summary").filter({hasText:"Tools"}).first();
     await tool.click();
     assert.ok(await page.getByRole("button",{name:"Simulate one fake incoming pickup order"}).isVisible());
     assert.ok(await page.getByRole("button",{name:"Help & Tips"}).isVisible());
     assert.ok(await page.getByRole("button",{name:"Legal & Privacy"}).isVisible());
     await tool.click();
     item.steps.push("Compact mobile toolbar, four equal-width stages and accessible Help/Legal");
   } else {
     assert.ok(await page.getByRole("button",{name:"Simulate a fake incoming pickup order"}).isVisible());
     assert.ok(await page.getByRole("group",{name:"Choose your Orders style"}).isVisible());
     assert.equal(await page.getByRole("tablist",{name:"Mobile kitchen lane"}).isVisible(),false);
     item.steps.push("Original desktop Orders controls unchanged");
   }
   await page.evaluate(()=>window.scrollTo(0,0));
   await page.screenshot({path:DIR+"/"+width+"-compact-orders.png",animations:"disabled"});
   await start.click({timeout:7000});
   await page.getByTestId("fake-incoming-order").first().waitFor({state:"visible",timeout:10000});
   await page.getByRole("button",{name:"Stop fictional order arrivals"}).click();
   await page.getByRole("button",{name:"Accept → Preparing"}).first().click();
   if(mobile)await page.getByRole("tab",{name:/Preparing/}).click();
   await page.getByRole("button",{name:"Mark Ready"}).first().waitFor({state:"visible",timeout:9000});
   await page.getByRole("button",{name:"Mark Ready"}).first().click();
   if(mobile)await page.getByRole("tab",{name:/Ready/}).click();
   await page.getByRole("button",{name:"Confirm cash received"}).first().waitFor({state:"visible",timeout:9000});
   await page.getByRole("button",{name:"Confirm cash received"}).first().click();
   await page.getByRole("button",{name:"Confirm handover"}).first().waitFor({state:"visible",timeout:9000});
   await page.getByRole("button",{name:"Confirm handover"}).first().click();
   item.steps.push("Manual fake pickup stages complete");
   if(mobile){
     const tool=page.locator("summary").filter({hasText:"Tools"}).first();
     await tool.click();
     await page.getByRole("button",{name:/Test busy queue/}).click();
     await tool.click();
     const active=page.getByRole("button",{name:/Current/}).first();
     await active.click();
     await page.getByRole("tab",{name:/New/}).click();
     await page.evaluate(()=>window.scrollTo(0,0));
     await page.screenshot({path:DIR+"/"+width+"-busy-orders.png",animations:"disabled"});
     item.steps.push("Busy queue remains usable with polished controls");
   }
   const dims=await page.evaluate(()=>({viewport:window.innerWidth,width:document.documentElement.scrollWidth}));
   assert.ok(dims.width<=dims.viewport+2,"horizontal overflow "+JSON.stringify(dims));
   assert.deepEqual(item.requests,[],"no backend write requests");
   assert.deepEqual(item.errors,[],"no JS errors");
   item.dimensions=dims;
   item.success=true;
   console.log("PASS CF-W2F "+width+"px header="+Math.round(h.height)+" queue="+Math.round(q.y)+"px");
 }catch(e){
   failures++;
   item.failure=String(e).slice(0,1100);
   console.error("FAIL CF-W2F "+width+"px "+item.failure);
   try{await page.screenshot({path:DIR+"/"+width+"-failure.png",timeout:4000})}catch{}
 }finally{
   results.push(item);
   await ctx.close();
 }
}
await browser.close();
writeFileSync(DIR+"/results.json",JSON.stringify({failures,results},null,2));
console.log("CF_W2F_POLISH="+(results.length-failures)+"/"+results.length);
if(failures)process.exit(1);
