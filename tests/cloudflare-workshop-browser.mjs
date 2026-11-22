import { chromium } from "playwright";
import assert from "node:assert/strict";
import {mkdirSync, writeFileSync} from "node:fs";

const out="artifacts/cloudflare-workshop-preview";
mkdirSync(out,{recursive:true});
const host="https://localeats-merchant-workshop-preview.mehey9184.workers.dev";
const local="http://127.0.0.1:4174";
const checks=[];
let failures=0;

async function check(name,fn){
  try{await fn();checks.push({name,status:"PASS"});console.log("PASS "+name);}
  catch(err){failures++;checks.push({name,status:"FAIL",error:String(err).slice(0,350)});console.error("FAIL "+name,err);}
}

const browser=await chromium.launch({headless:true});
async function visit(width,height,virtualOrigin=host){
  const context=await browser.newContext({viewport:{width,height},serviceWorkers:"block",ignoreHTTPSErrors:true});
  const page=await context.newPage();
  const external=[],writes=[],jsErrors=[];
  page.on("pageerror",e=>jsErrors.push(String(e)));
  page.on("request",req=>{if(!["GET","HEAD"].includes(req.method()))writes.push(req.method()+" "+req.url());});
  await page.route("**/*",async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin!==virtualOrigin || !["GET","HEAD"].includes(req.method())){
      external.push(req.method()+" "+url.origin+url.pathname);
      return route.abort("blockedbyclient");
    }
    try{const reply=await route.fetch({url:local+url.pathname+url.search,maxRedirects:0});await route.fulfill({response:reply});}
    catch(e){external.push("fixture failed "+url.pathname);await route.abort("failed");}
  });
  await page.goto(virtualOrigin+"/",{waitUntil:"domcontentloaded",timeout:40000});
  return {context,page,external,writes,jsErrors};
}

try{
for(const [width,height,label] of [[320,740,"mobile-320"],[390,844,"mobile-390"],[1366,900,"desktop"]]){
  const o=await visit(width,height);
  const {page}=o;
  await check(label+" real React component renders under isolated Cloudflare hostname",async()=>{
    await page.getByRole("dialog",{name:"LocalEats Kitchen Workshop"}).waitFor({timeout:22000});
    assert.ok(await page.getByText("Demo only · No real orders").isVisible());
    assert.ok(await page.getByText("Sample customer 1").isVisible());
    assert.ok((await page.getByTestId("workshop-fake-ticket").count())>=1);
  });
  await check(label+" no horizontal overflow or crashes",async()=>{
    const dims=await page.evaluate(()=>({w:innerWidth,doc:document.documentElement.scrollWidth}));
    assert.ok(dims.doc<=dims.w+2,JSON.stringify(dims));
    assert.deepEqual(o.jsErrors,[]);
  });
  await page.screenshot({path:out+"/"+label+".png",animations:"disabled"});
  await check(label+" pause and manually advance, then restart",async()=>{
    await page.getByRole("button",{name:"Pause"}).click();
    const tick=async()=>Number((await page.getByText(/Simulation step \d+/).innerText()).match(/\d+/)?.[0]);
    const start=await tick();
    await page.waitForTimeout(2350);
    assert.equal(await tick(),start);
    await page.getByRole("button",{name:"Next step"}).click();
    assert.equal(await tick(),start+1);
    await page.getByRole("button",{name:"Restart"}).click();
    assert.equal(await tick(),0);
  });
  if(label==="desktop"){
    await check("desktop 30 manual steps keep bounded fake order memory",async()=>{
      await page.getByRole("button",{name:"Pause"}).click();
      for(let i=0;i<30;i++)await page.getByRole("button",{name:"Next step"}).click();
      assert.ok((await page.getByTestId("workshop-fake-ticket").count())<=10);
      await page.screenshot({path:out+"/desktop-30-steps.png",animations:"disabled"});
    });
    await check("Escape closes and opener reopens demo",async()=>{
      await page.keyboard.press("Escape");
      assert.equal(await page.getByRole("dialog").count(),0);
      await page.getByRole("button",{name:"Open fictional workshop"}).click();
      assert.equal(await page.getByRole("dialog").count(),1);
    });
  }
  await check(label+" network isolated from APIs and writes",async()=>{
    assert.deepEqual(o.writes,[]);
    assert.deepEqual(o.external,[]);
    assert.deepEqual(o.jsErrors,[]);
  });
  await o.context.close();
}
for(const [label,origin] of [
 ["Production merchant domain","https://dashboard.localeatssa.co.za"],
 ["unrelated Cloudflare API worker","https://localeats-api-cf1-staging.mehey9184.workers.dev"]
]){
  const o=await visit(390,844,origin);
  await check(label+" cannot run the workshop",async()=>{
    await o.page.waitForTimeout(500);
    assert.equal(await o.page.getByRole("dialog").count(),0);
    assert.ok(await o.page.getByText("LocalEats Workshop unavailable").isVisible());
    assert.deepEqual(o.external,[]);
  });
  await o.context.close();
}
}finally{
  await browser.close();
  writeFileSync(out+"/results.json",JSON.stringify({failed:failures,checks},null,2));
}
if(failures)process.exit(1);
console.log("CLOUDFLARE_WORKSHOP_LOCAL_BROWSER_ACCEPTANCE_PASS");
