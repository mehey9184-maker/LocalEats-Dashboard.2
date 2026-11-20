// L3-N7B5J: compare original vs responsive Home, with identical loaded states.
// Only the loading skeleton may wrap below 640px. Both builds
// use the same synthetic props, CSS and offline-only adapter replacements.
import assert from "node:assert/strict";
import {readFileSync,writeFileSync,unlinkSync,readdirSync} from "node:fs";
import {resolve} from "node:path";
import {build} from "esbuild";
import {chromium} from "playwright";

const root=process.cwd();
const original=resolve(root,"l3-n7b5j-baseline/src/components/DashboardOverview.tsx");
const originalCopy=resolve(root,"src/components/DashboardOverviewL3N7B5JOriginal.tsx");
const untouched=readFileSync(original,"utf8");
const candidate=readFileSync(resolve(root,"src/components/DashboardOverview.tsx"),"utf8");
assert(untouched!==candidate,"This regression is only meaningful with a changed candidate");
const oldHeader='className="flex justify-between items-start"';
const newHeader='className="flex flex-wrap items-start justify-between gap-4 sm:flex-nowrap sm:gap-0"';
const oldLoading=untouched.slice(untouched.indexOf("if (loading) {"),untouched.indexOf("  return (\n    <div",untouched.indexOf("if (loading) {")+1));
const newLoading=candidate.slice(candidate.indexOf("if (loading) {"),candidate.indexOf("  return (\n    <div",candidate.indexOf("if (loading) {")+1));
assert(oldLoading.includes(oldHeader),"Original loading row must be untouched");
assert(newLoading.includes(newHeader),"Only the verified narrow loading row may wrap");
assert.equal(newLoading.replace(newHeader,oldHeader),oldLoading,
 "No loading skeleton content, geometry or interactions may change beyond the single responsive class");
assert.equal(candidate.replace(newHeader,oldHeader),untouched,
 "The full live Home component must match the parent except one loading skeleton class");

writeFileSync(originalCopy,untouched);
const css=readdirSync(resolve(root,"dist/assets")).filter(x=>x.endsWith(".css"))
 .map(x=>readFileSync(resolve(root,"dist/assets",x),"utf8")).join("\n");
assert(css.includes(".flex"),"Actual Merchant CSS required");
const stubPaths={
 supabase:resolve(root,"tests/l3-n6b/fixture-supabase.ts"),
 useAuthGuard:resolve(root,"tests/l3-n6b/fixture-auth-guard.ts"),
 firebase:resolve(root,"tests/l3-n7b5i/fixture-firebase.ts"),
 apiAuth:resolve(root,"tests/l3-n6/fixture-api-auth.ts"),
 OrderService:resolve(root,"tests/l3-n6b/fixture-order-service.ts")
};
async function compile(originalMode){
 const result=await build({
  entryPoints:[resolve(root,"tests/l3-n7b5i/home-entry.tsx")],
  bundle:true,write:false,platform:"browser",format:"iife",target:"es2022",
  jsx:"automatic",logLevel:"warning",
  define:{"import.meta.env":JSON.stringify({
   VITE_PICKUP_ORDERING_ENABLED:"false",
   VITE_MERCHANT_PREVIEW_READ_ONLY:"true",
   VITE_MERCHANT_FAKE_ORDERS_ENABLED:"false",
   VITE_LOCALEATS_API_URL:"http://127.0.0.1:0",PROD:false
  })},
  plugins:[{name:"l3-n7b5i-offline-home-only",setup(plugin){
   if(originalMode)plugin.onResolve({filter:/src[/\\\\]components[/\\\\]DashboardOverview$/},
     ()=>({path:originalCopy}));
   for(const [target,path]of Object.entries(stubPaths)){
    plugin.onResolve({filter:new RegExp("[/\\\\]"+target+"$")},()=>({path}));
   }
  }}]
 });
 return result.outputFiles[0].text;
}
let baselineJs,candidateJs;
try{baselineJs=await compile(true);candidateJs=await compile(false);}
finally{unlinkSync(originalCopy);}
const origin="https://offline-local-l3-n7b5j.test";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
let assertions=0;
try{
 for(const width of [320,390,1280]){
  for(const scenario of ["loading","blank","owned"]){
   const state={};
   for(const variant of ["baseline","candidate"]){
    const ctx=await browser.newContext({
     viewport:{width,height:900},serviceWorkers:"block",reducedMotion:"reduce"
    });
    const external=[],writes=[],errors=[];
    await ctx.route("**/*",async route=>{
     const req=route.request(),url=new URL(req.url());
     if(req.method()!=="GET")writes.push(req.url());
     if(url.origin!==origin){external.push(req.url());return route.abort();}
     if(req.method()!=="GET")return route.abort();
     if(url.pathname==="/")return route.fulfill({status:200,contentType:"text/html",
      headers:{"Content-Security-Policy":"default-src 'self'; connect-src 'none'; img-src 'self' data:; font-src 'self' data:"},
      body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/merchant.css"></head><body><div id="root"></div><script src="/merchant.js"></script></body></html>'});
     if(url.pathname==="/merchant.css")return route.fulfill({status:200,contentType:"text/css",body:css});
     if(url.pathname==="/merchant.js")return route.fulfill({status:200,contentType:"application/javascript",
      body:variant==="baseline"?baselineJs:candidateJs});
     return route.abort();
    });
    const page=await ctx.newPage();
    page.on("pageerror",err=>errors.push(err.message));
    try{
     await page.goto(origin+"/?scenario="+scenario,{waitUntil:"domcontentloaded"});
     await page.getByTestId("home-fixture").waitFor({timeout:15000});
     // Wait for Framer Motion's normal entrance transitions to complete.
     // Sampling at 280ms captures non-semantic subpixel translateY variation
     // (e.g. -0.108px vs -0.099px) between otherwise identical pages.
     await page.waitForTimeout(1100);
     const rootNode=page.getByTestId("home-fixture");
     const screenshot=await rootNode.screenshot({animations:"disabled",caret:"hide",timeout:20000});
     const html=await rootNode.innerHTML();
     const headings=await page.locator("h1,h2,h3").allTextContents();
     const buttons=await page.locator("button").allTextContents();
     const classes=await page.locator("button").evaluateAll(nodes=>nodes.map(n=>n.getAttribute("class")));
     const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
     const loadingHeader=scenario==="loading"
       ?await page.locator("div.space-y-12 > section > div").first().evaluate(el=>{
         const left=el.children[0].getBoundingClientRect();
         const right=el.children[1].getBoundingClientRect();
         return {leftBottom:left.bottom,rightTop:right.top};
        })
       :null;
     const skeletons=await rootNode.locator('[class*="animate-pulse"]').count();
     state[variant]={html,screenshot,headings,buttons,classes,overflow,loadingHeader,skeletons};
     assert.deepEqual(external,[],"Attempted a hosted network request");assertions++;
     assert.deepEqual(writes,[],"Attempted mutation request");assertions++;
     assert.deepEqual(errors,[],"Runtime exception in "+variant+" "+scenario+" "+width);assertions++;
    }finally{await ctx.close();}
   }
   const mobileLoading=scenario==="loading"&&width<640;
   assert.deepEqual(state.candidate.headings,state.baseline.headings,"Home headings changed "+scenario+" "+width);assertions++;
   assert.deepEqual(state.candidate.buttons,state.baseline.buttons,"Home controls changed "+scenario+" "+width);assertions++;
   assert.deepEqual(state.candidate.classes,state.baseline.classes,"Home controls CSS changed "+scenario+" "+width);assertions++;
   assert.equal(state.candidate.skeletons,state.baseline.skeletons,"Loading placeholders removed "+scenario+" "+width);assertions++;
   const oldClass='class="flex justify-between items-start"';
   const newClass='class="flex flex-wrap items-start justify-between gap-4 sm:flex-nowrap sm:gap-0"';
   const candidateHtml=scenario==="loading"
     ?state.candidate.html.replace(newClass,oldClass)
     :state.candidate.html;
   if(candidateHtml!==state.baseline.html){
    let first=0;
    while(first<Math.min(state.baseline.html.length,candidateHtml.length) &&
      state.baseline.html[first]===candidateHtml[first])first++;
    throw Error("Home unexpected DOM change "+scenario+" "+width+" at "+first+
      " original="+JSON.stringify(state.baseline.html.slice(Math.max(first-120,0),first+180))+
      " candidate="+JSON.stringify(candidateHtml.slice(Math.max(first-120,0),first+180)));
   }
   assertions++;
   if(mobileLoading){
    assert(state.baseline.overflow>2,
     "Expected to reproduce the original narrow-screen overflow "+width);assertions++;
    assert(state.candidate.overflow<=2,
     "New Home loading overflow "+state.candidate.overflow+"px at "+width);assertions++;
    assert(state.candidate.loadingHeader.rightTop>=state.candidate.loadingHeader.leftBottom,
     "Loading title and controls must occupy separate non-overlapping rows on narrow screens");assertions++;
    assert(!state.candidate.screenshot.equals(state.baseline.screenshot),
     "Mobile loading layout should visibly change when overflow is fixed");assertions++;
    console.log(`L3_N7B5J_LOADING_OVERFLOW_FIXED width=${width} original=${state.baseline.overflow}px corrected=${state.candidate.overflow}px`);
   }else{
    assert.equal(state.candidate.overflow,state.baseline.overflow,
     "Unrelated Home viewport overflow changed "+scenario+" "+width);assertions++;
    assert(state.candidate.screenshot.equals(state.baseline.screenshot),
     "Original non-loading or desktop Home screenshot changed "+scenario+" "+width);assertions++;
    console.log(`L3_N7B5J_UNCHANGED_HOME width=${width} scenario=${scenario} screenshots-identical`);
   }
  }
 }
}finally{await browser.close();}
console.log(`L3_N7B5J_RESPONSIVE_HOME_BROWSER_PASS assertions=${assertions} cases=9 scenarios=loading,blank,owned widths=320,390,1280 preserve-loaded-and-desktop,fix-mobile-loading no-hosted-network no-writes`);
