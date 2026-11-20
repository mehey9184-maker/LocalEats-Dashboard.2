// Local-only Chromium regression for the exact existing Kanban component.
// All network is routed in memory; real auth/DB clients are replaced.
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {resolve} from "node:path";
import {build} from "esbuild";
import {chromium} from "playwright";
const root=process.cwd();
const css=readdirSync(resolve(root,"dist/assets")).filter(x=>x.endsWith(".css"))
 .map(x=>readFileSync(resolve(root,"dist/assets",x),"utf8")).join("\n");
assert(css.includes(".flex"),"Must use actual Merchant compiled stylesheet");
const replacements={
 firebase:resolve(root,"tests/l3-n6/fixture-auth.ts"),
 apiAuth:resolve(root,"tests/l3-n6/fixture-api-auth.ts"),
 supabase:resolve(root,"tests/l3-n6b/fixture-supabase.ts"),
 useAuthGuard:resolve(root,"tests/l3-n6b/fixture-auth-guard.ts"),
 OrderService:resolve(root,"tests/l3-n6b/fixture-order-service.ts")
};
const compiled=await build({
 entryPoints:[resolve(root,"tests/l3-n7b5e/fixture-entry.tsx")],
 bundle:true,write:false,platform:"browser",format:"iife",target:"es2022",jsx:"automatic",logLevel:"warning",
 define:{"import.meta.env":JSON.stringify({
  VITE_MERCHANT_PREVIEW_READ_ONLY:"true",
  VITE_MERCHANT_FAKE_ORDERS_ENABLED:"true",
  VITE_PICKUP_ORDERING_ENABLED:"false",
  VITE_LOCALEATS_API_URL:"http://127.0.0.1:0",
  PROD:false
 })},
 plugins:[{name:"no-live-backends",setup(plugin){
  for(const [module,target] of Object.entries(replacements))
   plugin.onResolve({filter:new RegExp("[/\\\\]"+module+"$")},()=>({path:target}));
 }}]
});
const js=compiled.outputFiles[0].text;
const host="local-eats-dashboard-2-6m8o-offlinekanban-mehey9184-makers-projects.vercel.app";
const origin="https://"+host;
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
let checks=0;
try {
 for(const width of [320,390,1280]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:"block"});
  const external=[],writes=[],errors=[];
  await context.route("**/*",async route=>{
   const request=route.request(),url=new URL(request.url());
   if(request.method()!=="GET")writes.push(request.url());
   if(url.origin!==origin){external.push(request.url());return route.abort();}
   if(request.method()!=="GET")return route.abort();
   if(url.pathname==="/")return route.fulfill({status:200,contentType:"text/html",body:
    '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/merchant.css"></head><body><div id="root"></div><script src="/merchant.js"></script></body></html>'});
   if(url.pathname==="/merchant.css")return route.fulfill({status:200,contentType:"text/css",body:css});
   if(url.pathname==="/merchant.js")return route.fulfill({status:200,contentType:"text/javascript",body:js});
   return route.abort();
  });
  const page=await context.newPage();
  page.on("pageerror",error=>errors.push(error.message));
  try {
   await page.goto(origin+"/",{waitUntil:"domcontentloaded"});
   await page.getByTestId("dual-style-kanban").waitFor({timeout:20000});
   const lane=(stage)=>page.getByTestId("lane-"+stage);
   const cards=(stage)=>lane(stage).getByTestId("fake-incoming-order");
   const assertCount=async(target,expected,message)=>{
    assert.equal(await target.count(),expected,message+" at "+width+"px");checks++;
   };
   await assertCount(cards("pending"),6,"Six initial pending cards");
   await assertCount(cards("preparing"),6,"Six initial preparing cards");
   await assertCount(cards("ready"),6,"Six initial ready cards");
   assert.equal(await lane("pending").getByText("15 test").count(),1);checks++;
   assert.equal(await page.getByTestId("dual-style-kanban").getAttribute("data-style"),"expediter");checks++;
   await lane("pending").getByRole("button",{name:/Show 6 more/}).click();
   await assertCount(cards("pending"),12,"Pending increased by six");
   await page.getByTestId("set-compact").click();
   await assertCount(cards("pending"),6,"Style switch resets pagination");
   await page.getByTestId("set-expediter").click();
   await assertCount(cards("pending"),6,"Returning to prior style stays reset");
   if(width<768){
    await page.getByRole("tab",{name:/^Preparing /}).click();
    assert.equal(await page.getByRole("tab",{name:/^Preparing /}).getAttribute("aria-selected"),"true");checks++;
   }
   await page.getByTestId("filter-preparing").click();
   await assertCount(cards("preparing"),6,"New filter starts at six");
   await lane("preparing").getByRole("button",{name:/Show 6 more/}).click();
   await assertCount(cards("preparing"),12,"Preparing load more");
   await page.getByTestId("filter-all").click();
   await assertCount(cards("preparing"),6,"Returning to all filter resets");
   await page.getByTestId("filter-preparing").click();
   await assertCount(cards("preparing"),6,"Returning to previous filter does not resurrect page");
   if(width<768){
    await page.getByTestId("filter-all").click();
    assert.equal(await page.getByRole("tab",{name:/^Preparing /}).getAttribute("aria-selected"),"true",
     "Filter transitions must retain mobile lane selection");checks++;
   }
   await page.getByTestId("set-history").click();
   await page.getByTestId("style-history-list").waitFor();
   await assertCount(page.getByTestId("style-history-list").getByTestId("fake-incoming-order"),24,"History starts at 24");
   await page.getByRole("button",{name:/Show 24 more history orders/}).click();
   await assertCount(page.getByTestId("style-history-list").getByTestId("fake-incoming-order"),27,"History show more");
   await page.getByTestId("set-compact").click();
   await assertCount(page.getByTestId("style-history-list").getByTestId("fake-incoming-order"),24,"Style resets history");
   await page.getByTestId("set-expediter").click();
   await assertCount(page.getByTestId("style-history-list").getByTestId("fake-incoming-order"),24,"Back to history style resets");
   await page.getByTestId("set-active").click();
   await assertCount(cards("pending"),6,"Active view reset");
   await page.getByTestId("set-history").click();
   await assertCount(page.getByTestId("style-history-list").getByTestId("fake-incoming-order"),24,"History return reset");
   assert.equal(writes.length,0,"No writes allowed");checks++;
   assert.equal(external.length,0,"No live/external requests allowed: "+external.join(","));checks++;
   assert.deepEqual(errors,[],"No browser exceptions");checks++;
   assert.equal(await page.getByTestId("safety-statement").count(),1);checks++;
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
   assert(overflow<=2,"Original Kanban created viewport overflow: "+overflow+" at "+width);checks++;
  }finally{await context.close();}
 }
}finally{await browser.close();}
console.log(`L3_N7B5E_KANBAN_BROWSER_PASS assertions=${checks} widths=320,390,1280 no-hosted-network no-writes`);
