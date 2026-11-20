// L3-N7B5I: compare untouched parent Home and candidate Home pixel/DOM output.
// The source is identical except for unreachable declarations. Both builds
// use the same synthetic props, CSS and offline-only adapter replacements.
import assert from "node:assert/strict";
import {readFileSync,writeFileSync,unlinkSync,readdirSync} from "node:fs";
import {resolve} from "node:path";
import {build} from "esbuild";
import {chromium} from "playwright";

const root=process.cwd();
const original=resolve(root,"l3-n7b5i-baseline/src/components/DashboardOverview.tsx");
const originalCopy=resolve(root,"src/components/DashboardOverviewL3N7B5IOriginal.tsx");
const untouched=readFileSync(original,"utf8");
const candidate=readFileSync(resolve(root,"src/components/DashboardOverview.tsx"),"utf8");
assert(untouched!==candidate,"This regression is only meaningful with a changed candidate");
assert(untouched.includes("const ConnectionsSlider ="));
assert(untouched.includes("const DeliveryDispatchSuburbTrends ="));
assert(untouched.includes("const fetchRiders = useCallback"));
assert(untouched.includes("const driverAvailability = useMemo"));
for(const id of ["ConnectionsSlider","DeliveryDispatchSuburbTrends","fetchRiders","driverAvailability","connectedRidersCount"]){
 assert(!new RegExp("\\b"+id+"\\b").test(candidate),"Unused legacy declaration still in candidate "+id);
}
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
const origin="https://offline-local-l3-n7b5i.test";
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
     await page.waitForTimeout(280);
     const rootNode=page.getByTestId("home-fixture");
     const html=await rootNode.innerHTML();
     const screenshot=await rootNode.screenshot({animations:"disabled",caret:"hide",timeout:20000});
     const headings=await page.locator("h1,h2,h3").allTextContents();
     const buttons=await page.locator("button").allTextContents();
     const classes=await page.locator("button").evaluateAll(nodes=>nodes.map(n=>n.getAttribute("class")));
     state[variant]={html,screenshot,headings,buttons,classes};
     assert.deepEqual(external,[],"Attempted a hosted network request");assertions++;
     assert.deepEqual(writes,[],"Attempted mutation request");assertions++;
     assert.deepEqual(errors,[],"Runtime exception in "+variant+" "+scenario+" "+width);assertions++;
     const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
     assert(overflow<=2,"Unexpected horizontal overflow in "+variant+" "+scenario+" "+width+": "+overflow);assertions++;
    }finally{await ctx.close();}
   }
   assert.deepEqual(state.candidate.headings,state.baseline.headings,"Home headings changed "+scenario+" "+width);assertions++;
   assert.deepEqual(state.candidate.buttons,state.baseline.buttons,"Home controls changed "+scenario+" "+width);assertions++;
   assert.deepEqual(state.candidate.classes,state.baseline.classes,"Home button styles changed "+scenario+" "+width);assertions++;
   assert.equal(state.candidate.html,state.baseline.html,"Home DOM changed "+scenario+" "+width);assertions++;
   assert(state.candidate.screenshot.equals(state.baseline.screenshot),
    "Original Home screenshot changed "+scenario+" "+width);assertions++;
   console.log(`L3_N7B5I_HOME_EQUIVALENT width=${width} scenario=${scenario} screenshots-identical`);
  }
 }
}finally{await browser.close();}
console.log(`L3_N7B5I_HOME_BROWSER_PASS assertions=${assertions} cases=9 scenarios=loading,blank,owned widths=320,390,1280 screenshots-identical no-hosted-network no-writes`);
