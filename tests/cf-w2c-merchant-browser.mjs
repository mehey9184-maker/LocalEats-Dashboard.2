import {chromium} from "playwright";
import assert from "node:assert/strict";
import {mkdirSync,writeFileSync} from "node:fs";

const dir="artifacts/cf-w2c-merchant";
mkdirSync(dir,{recursive:true});
const origin="https://localeats-merchant-dashboard-preview.mehey9184.workers.dev";
const local="http://127.0.0.1:4177";
const checks=[];
let failures=0;
const browser=await chromium.launch({headless:true});
const check=async(name,fn)=>{
 try{const result=await fn();checks.push({name,status:"PASS",result});console.log("PASS "+name)}
 catch(e){failures++;checks.push({name,status:"FAIL",error:String(e).slice(0,750)});console.error("FAIL "+name,e)}
};
try{
 for(const [width,height,label] of [[390,844,"mobile-390"],[1366,900,"desktop"]]){
   const context=await browser.newContext({viewport:{width,height},serviceWorkers:"block",ignoreHTTPSErrors:true,reducedMotion:"reduce"});
   const page=await context.newPage();
   const out=[],writes=[],errors=[];
   page.on("pageerror",e=>errors.push(String(e)));
   page.on("request",r=>{if(!["GET","HEAD"].includes(r.method()))writes.push(r.method()+" "+r.url());});
   await page.route("**/*",async route=>{
     const request=route.request(),url=new URL(request.url());
     if(url.origin!==origin){
       if(!/fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com/.test(url.hostname))out.push(request.method()+" "+request.url());
       await route.abort("blockedbyclient");
       return;
     }
     if(!["GET","HEAD"].includes(request.method())){writes.push(request.method()+" "+request.url());await route.abort("blockedbyclient");return;}
     try{
       const response=await route.fetch({url:local+url.pathname+url.search,maxRedirects:0});
       const headers={...response.headers(),"content-security-policy":"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'none'; worker-src 'none'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'"};
       await route.fulfill({response,headers});
     }catch(e){await route.abort("failed");}
   });
   await check(label+" original Merchant Home renders on exact preview hostname",async()=>{
     const response=await page.goto(origin+"/",{waitUntil:"domcontentloaded",timeout:35000});
     await page.getByRole("button",{name:"Orders"}).first().waitFor({timeout:25000});
     const originalShop=await page.getByText("LocalEats Example Shop").count();
     assert.equal(response.status(),200);
     assert.ok(originalShop>0,"Fictional shop identity should be visible");
     assert.equal(await page.getByRole("button",{name:"Start fictional order arrivals"}).count(),0,"Preview simulation must be only on Orders page");
     await page.screenshot({path:dir+"/"+label+"-original-home.png",animations:"disabled"});
     return {shopTextMatches:originalShop};
   });
   await check(label+" original Orders navigation and manual fake lifecycle",async()=>{
     await page.getByRole("button",{name:"Orders"}).first().click();
     await page.getByRole("button",{name:"Start fictional order arrivals"}).waitFor({timeout:25000});
     assert.equal(await page.getByTestId("fake-incoming-order").count(),0);
     await page.getByRole("button",{name:"Start fictional order arrivals"}).click();
     await page.getByTestId("fake-incoming-order").first().waitFor({timeout:12000});
     assert.ok(await page.getByText(/FAKE/i).count()>0);
     assert.equal(await page.getByRole("button",{name:"Stop fictional order arrivals"}).count(),1);
     // Status transition is manual, not a timer-generated order completion.
     await page.getByRole("button",{name:"Stop fictional order arrivals"}).click();
     assert.equal(await page.getByRole("button",{name:"Start fictional order arrivals"}).count(),1);
     await page.screenshot({path:dir+"/"+label+"-orders-manual-demo.png",animations:"disabled"});
     return {fakeTickets:await page.getByTestId("fake-incoming-order").count()};
   });
   await check(label+" strict no-network writes or external API access",async()=>{
     assert.deepEqual(writes,[]);
     assert.deepEqual(out,[]);
     assert.deepEqual(errors,[]);
     const d=await page.evaluate(()=>({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth}));
     assert.ok(d.documentWidth<=d.viewport+2,JSON.stringify(d));
     return d;
   });
   await context.close();
 }
}finally{
 await browser.close();
 writeFileSync(dir+"/results.json",JSON.stringify({failures,checks},null,2));
}
if(failures)process.exit(1);
console.log("CF_W2C_ORIGINAL_APP_OFFLINE_BROWSER_PASS");
