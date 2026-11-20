// L3-N7B5I: browser compare actual original Home across parent/candidate,
// including responsive screenshots and DOM, with all data and modules synthetic.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync,writeFileSync,readdirSync} from "node:fs";
import {resolve} from "node:path";
import {build} from "esbuild";
import {chromium} from "playwright";

const root=process.cwd();
const baseline=resolve(root,"overview-baseline/src/components/DashboardOverview.tsx");
const candidate=resolve(root,"src/components/DashboardOverview.tsx");
const oldSource=readFileSync(baseline,"utf8"),newSource=readFileSync(candidate,"utf8");
assert.equal(newSource,oldSource,"Original Home source differs from parent PR; needs separate approval");
const temporary=resolve(root,"src/components/DashboardOverviewL3Baseline.tsx");
writeFileSync(temporary,oldSource);
const css=readdirSync(resolve(root,"dist/assets")).filter(name=>name.endsWith(".css"))
 .map(name=>readFileSync(resolve(root,"dist/assets",name),"utf8")).join("\n");
assert(css.includes(".flex"),"Real compiled Merchant CSS is mandatory");
const stub=resolve(root,"tests/l3-n7b5i/fixture-stubs.tsx");
const output={};
for(const variant of ["parent","candidate"]){
 const built=await build({
  entryPoints:[resolve(root,"tests/l3-n7b5i/fixture-entry.tsx")],
  bundle:true,write:false,format:"iife",platform:"browser",jsx:"automatic",target:"es2022",
  logLevel:"warning",define:{"import.meta.env":JSON.stringify({
   PROD:false,VITE_PICKUP_ORDERING_ENABLED:"false",
   VITE_MERCHANT_PREVIEW_READ_ONLY:"true",VITE_MERCHANT_FAKE_ORDERS_ENABLED:"false",
   VITE_LOCALEATS_API_URL:"http://127.0.0.1:0"
  })},
  plugins:[{name:"l3n7b5i-actual-home-offline-only",setup(plugin){
   plugin.onResolve({filter:/[/\\\\]components[/\\\\]DashboardOverview$/},
    ()=>({path:variant==="parent"?temporary:candidate}));
   for(const name of ["lib/supabase","hooks/useAuthGuard","utils/availabilityChecker","components/MenuManagement"]){
    const escaped=name.replaceAll("/", "[/\\\\]");
    plugin.onResolve({filter:new RegExp("[/\\\\]"+escaped+"$")},()=>({path:stub}));
   }
  }}]
 });
 output[variant]=built.outputFiles[0].text;
}
const host="offline-local-l3-n7b5i.test",origin="https://"+host;
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
let checks=0;
try{
 for(const width of [320,390,1280]){
  const states=["fresh","failed","loading","unverified","other-shop","advanced","compact"];
  const sessions=[];
  for(const variant of ["parent","candidate"]){
   const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:"block",reducedMotion:"reduce"});
   const external=[],writes=[],errors=[];
   await context.route("**/*",async route=>{
    const request=route.request(),url=new URL(request.url());
    if(request.method()!=="GET")writes.push(request.url());
    if(url.origin!==origin){external.push(request.url());return route.abort();}
    if(request.method()!=="GET")return route.abort();
    if(url.pathname==="/")return route.fulfill({
     status:200,contentType:"text/html",
     headers:{"Content-Security-Policy":"default-src 'self'; connect-src 'none'; img-src 'self' data:; font-src 'self' data:"},
     body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/merchant.css"><link rel="stylesheet" href="/snapshot.css"></head><body><div id="root"></div><script src="/merchant.js"></script></body></html>'
    });
    if(url.pathname==="/merchant.css")return route.fulfill({status:200,contentType:"text/css",body:css});
    if(url.pathname==="/snapshot.css")return route.fulfill({status:200,contentType:"text/css",body:"*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}"});
    if(url.pathname==="/merchant.js")return route.fulfill({status:200,contentType:"application/javascript",body:output[variant]});
    return route.abort();
   });
   const page=await context.newPage();
   page.on("pageerror",error=>errors.push(error.message));
   await page.goto(origin+"/",{waitUntil:"domcontentloaded"});
   await page.getByTestId("home-fixture").waitFor({timeout:15000});
   sessions.push({variant,context,page,external,writes,errors});
  }
  try{
   for(const scenario of states){
    for(const session of sessions){
     if(scenario!=="fresh")await session.page.getByTestId("home-"+scenario).click();
     await session.page.getByTestId("fixture-scope").waitFor();
     await session.page.waitForTimeout(80);
    }
    const snap=await Promise.all(sessions.map(async x=>{
     const page=x.page;
     const html=await page.locator('[data-testid="home-fixture"]').innerHTML();
     const image=await page.screenshot({animations:"disabled",fullPage:false});
     const scope=await page.getByTestId("fixture-scope").textContent();
     const observed=await page.evaluate(()=>window.l3n7b5iObserved);
     const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
     assert(overflow<=2,"Original Home horizontally overflows "+overflow+" at "+width+"px scenario "+scenario);checks++;
     assert.equal(observed.writes,0,"Home fixture must not issue backend write");checks++;
     assert.equal(observed.subscriptions,0,"No real channels may initialize");checks++;
     assert(observed.tables.every(table=>table==="shop_followers"),"No rider/delivery DB reads permitted");checks++;
     assert.deepEqual(x.external,[],"Unexpected remote image/API request");checks++;
     assert.deepEqual(x.writes,[],"Unexpected browser mutation request");checks++;
     assert.deepEqual(x.errors,[],"Browser runtime error");checks++;
     assert.equal(await page.getByTestId("home-write-attempts").textContent(),"0");checks++;
     return {html,image,scope};
    }));
    assert.equal(snap[0].scope,snap[1].scope,"Fixture modes disagree");checks++;
    assert.equal(snap[0].html,snap[1].html,"Rendered original Home DOM changed: "+scenario+" "+width);checks++;
    assert(snap[0].image.equals(snap[1].image),"Original Home screenshot changed: "+scenario+" "+width);checks++;
    const fingerprint=createHash("sha256").update(snap[0].image).digest("hex").slice(0,14);
    console.log(`L3_N7B5I_SCREENSHOT_EQUIVALENT width=${width} state=${scenario} sha256=${fingerprint}`);
    if(scenario==="failed"){
     assert(snap[0].html.includes("Unavailable")||snap[0].html.includes("Open Orders to verify"),
      "Home must not assert confirmed order totals on API read failure");checks++;
    }
    if(scenario==="fresh"){
     assert(snap[0].html.includes("Pay at Shop"),"Original pickup payment messaging must survive");checks++;
    }
   }
   for(const session of sessions){
    const nav=session.page.getByTestId("home-nav");
    const openOrder=session.page.getByRole("button",{name:"Open Orders"}).first();
    if(await openOrder.count()){
     await openOrder.click();
     assert.equal(await nav.textContent(),"orders");checks++;
    }
    assert.equal(await session.page.getByTestId("home-write-attempts").textContent(),"0");checks++;
   }
  }finally{for(const s of sessions)await s.context.close();}
 }
}finally{await browser.close();}
console.log(`L3_N7B5I_HOME_EQUIVALENCE_PASS assertions=${checks} widths=320,390,1280 scenarios=7 unchanged-source no-network no-writes`);
