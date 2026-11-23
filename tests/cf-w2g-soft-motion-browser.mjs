import {chromium} from "playwright";
import assert from "node:assert/strict";
import {mkdirSync,writeFileSync} from "node:fs";

const HOST="https://localeats-merchant-dashboard-preview.mehey9184.workers.dev";
const LOCAL="http://127.0.0.1:4177";
const DIR="artifacts/cf-w2g-soft-motion";
mkdirSync(DIR,{recursive:true});
const browser=await chromium.launch({headless:true});
const checks=[];
let failures=0;

for(const [width,height,reduce] of [[320,740,false],[390,844,false],[1366,900,false],[390,844,true]]){
 const context=await browser.newContext({
   viewport:{width,height},isMobile:width<600,hasTouch:width<600,
   deviceScaleFactor:width<600?2:1,serviceWorkers:"block",
   reducedMotion:reduce?"reduce":"no-preference",
 });
 const page=await context.newPage();
 const rec={width,height,reduce,pass:false,errors:[],writes:[],external:[]};
 page.on("pageerror",e=>rec.errors.push(String(e)));
 page.on("request",r=>{if(!["GET","HEAD"].includes(r.method()))rec.writes.push(r.method()+" "+r.url())});
 try {
   await page.route("**/*",async route=>{
     const req=route.request(),url=new URL(req.url());
     if(url.origin!==HOST){await route.abort("blockedbyclient");return;}
     if(!["GET","HEAD"].includes(req.method())){await route.abort("blockedbyclient");return;}
     const res=await route.fetch({url:LOCAL+url.pathname+url.search,maxRedirects:0});
     await route.fulfill({response:res,headers:{...res.headers(),
      "content-security-policy":"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'"}});
   });
   const response=await page.goto(HOST+"/",{waitUntil:"domcontentloaded",timeout:35000});
   assert.equal(response.status(),200);
   await page.getByRole("button",{name:"Orders"}).first().waitFor({timeout:14000});
   assert.ok(await page.getByText("LocalEats Example Shop").count());
   await page.getByRole("button",{name:"Orders"}).first().click();
   const hdr=page.getByTestId("orders-mobile-header");
   const q=page.getByTestId("orders-queue-card");
   const start=page.getByRole("button",{name:"Start fictional order arrivals"});
   await start.waitFor();
   assert.ok(await page.getByRole("button",{name:"Enable simulated browser notifications"}).isVisible());
   await start.click();
   const card=page.getByTestId("fake-incoming-order").first();
   await card.waitFor({state:"visible",timeout:12000});
   await page.getByRole("button",{name:"Stop fictional order arrivals"}).click();
   const props=await page.evaluate(()=>{
     const v=s=>document.querySelector(s);
     const css=n=>{const c=getComputedStyle(n);return {shadow:c.boxShadow,transition:c.transitionDuration,transform:c.transform,bg:c.backgroundColor,borderStyle:c.borderStyle,font:c.fontFamily}};
     const hdr=v('[data-testid="orders-mobile-header"]');
     const queue=v('[data-testid="orders-queue-card"]');
     const ticket=v('[data-testid="fake-incoming-order"]');
     const h1=hdr.querySelector("h1"),name=ticket.querySelector("h4");
     const buttons=[...document.querySelectorAll('[data-testid="fake-incoming-controls"] button')];
     return {hdr:css(hdr),queue:css(queue),ticket:css(ticket),heading:css(h1),customer:css(name),
       dims:{viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth},
       controls:buttons.filter(x=>x.getClientRects().length>0).map(x=>({label:x.getAttribute("aria-label"),height:x.getBoundingClientRect().height}))};
   });
   rec.visual=props;
   assert.notEqual(props.hdr.shadow,"none","header surface must have real depth");
   assert.notEqual(props.queue.shadow,"none","queue surface must have real depth");
   assert.notEqual(props.ticket.shadow,"none","ticket must have floating shadow");
   assert.equal(props.ticket.borderStyle,"dashed","fictional badge/border distinction remains");
   assert.equal(props.dims.scrollWidth<=props.dims.viewport+2,true,"no horizontal overflow");
   assert.ok(props.controls.filter(x=>x.label?.includes("fictional order arrivals")||x.label?.includes("simulated browser notifications"))
     .every(x=>x.height>=43.5),"44px mobile buttons remain comfortable");
   const sec=Number.parseFloat(props.ticket.transition);
   if(reduce){assert.ok(!sec||sec===0,"reduced motion must remove ticket transition");}
   else{assert.ok(sec>0&&sec<=0.35,"ticket transition must be subtle, <=350ms")}
   if(width>=768){
     await card.hover();
     await page.waitForTimeout(270);
     const matrix=await card.evaluate(el=>getComputedStyle(el).transform);
     rec.hoverTransform=matrix;
     assert.notEqual(matrix,"none","mouse hover provides gentle lift");
   }
   await page.screenshot({path:DIR+"/"+width+(reduce?"-reduced":"")+"-soft-order-card.png",animations:"disabled"});
   await page.getByRole("button",{name:"Accept → Preparing"}).first().click();
   if(width<768)await page.getByRole("tab",{name:/Preparing/}).click();
   await page.getByRole("button",{name:"Mark Ready"}).first().waitFor({timeout:9000});
   assert.deepEqual(rec.errors,[]);
   assert.deepEqual(rec.writes,[]);
   rec.pass=true;
   console.log("PASS CF-W2G "+width+"px reduce="+reduce+" floating original ticket + smooth type + manual order action");
 }catch(e){
   rec.failure=String(e).slice(0,1300);
   console.error("FAIL CF-W2G "+width+"px "+rec.failure);
   failures++;
   try{await page.screenshot({path:DIR+"/"+width+(reduce?"-reduced":"")+"-failure.png",timeout:3000})}catch{}
 }finally{checks.push(rec);await context.close()}
}
await browser.close();
writeFileSync(DIR+"/report.json",JSON.stringify({failures,checks},null,2));
console.log("CF_W2G_SOFT_MOTION="+(checks.length-failures)+"/"+checks.length);
if(failures)process.exit(1);
