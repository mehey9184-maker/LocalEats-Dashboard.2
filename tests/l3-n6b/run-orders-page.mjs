// L3-N6B full ORIGINAL OrdersManagement page, not only the action component.
// End-to-end browser *presentation* against a loopback API. Real Cloud clients,
// merchant accounts and production/staging order writes cannot be accessed.
import assert from "node:assert/strict";
import http from "node:http";
import {readFileSync,readdirSync} from "node:fs";
import {resolve} from "node:path";
import {build} from "esbuild";
import {chromium} from "playwright";
const root=process.cwd(),fixtureRoot=resolve(root,"tests/l3-n6b");
const realCss=readdirSync(resolve(root,"dist/assets")).filter(s=>s.endsWith(".css")).map(s=>readFileSync(resolve(root,"dist/assets",s),"utf8")).join("\n");
assert(realCss.includes(".flex"),"Shipping Merchant stylesheet must be loaded");
const order=()=>({
 id:"l3-n6b-order-001",shop_id:"test-owned-shop",user_id:"synthetic-customer",
 delivery_type:"collection",order_type:"collection",delivery_status:"none",
 status:"pending",payment_status:"unpaid",revision:0,total_price:25,service_fee:0,
 delivery_fee:0,customer_name:"Synthetic Customer",phone:"+27700000000",
 product_name:"Synthetic Kota",payment_method:"cash",notes:"No atchar",
 items:[{menu_item_id:"synthetic-kota",name:"Synthetic Kota",quantity:1,unit_price:25,line_total:25}],
 created_at:new Date().toISOString(),updated_at:new Date().toISOString()
});
let records=[order()],apiReads=0,apiWrites=0,unknownRequests=0;
let nextFault=null,bundle="";
const json=(res,status,data)=>{res.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store"});res.end(JSON.stringify(data));};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url||"/","http://127.0.0.1");
 if(req.method==="GET"&&url.pathname==="/"){
  res.writeHead(200,{"Content-Type":"text/html","Cache-Control":"no-store"});
  return res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/merchant.css"></head><body><div id="root"></div><script src="/merchant.js"></script></body></html>');
 }
 if(req.method==="GET"&&url.pathname==="/merchant.css"){
  res.writeHead(200,{"Content-Type":"text/css"});return res.end(realCss);
 }
 if(req.method==="GET"&&url.pathname==="/merchant.js"){
  res.writeHead(200,{"Content-Type":"text/javascript"});return res.end(bundle);
 }
 if(url.pathname.startsWith("/api/v1/")){
  const uid=/^Bearer fb-(.*)$/.exec(String(req.headers.authorization||""))?.[1]||"";
  if(req.method!=="GET"){apiWrites++;return json(res,503,{success:false,code:"PREVIEW_READ_ONLY"});}
  apiReads++;
  if(!["merchant-a","merchant-b"].includes(uid))return json(res,401,{error:"Unauthorized",code:"UNAUTHORIZED"});
  if(url.pathname==="/api/v1/merchant/shop"){
   if(nextFault==="wrong-owner"&&uid==="merchant-b"){
    nextFault=null;return json(res,200,{success:true,shop:{id:"test-owned-shop",owner_id:"merchant-a",approval_status:"approved",name:"Fixture Merchant Shop"}});
   }
   return json(res,200,{success:true,shop:{id:uid==="merchant-a"?"test-owned-shop":"other-test-shop",owner_id:uid,approval_status:"approved",name:"Fixture Merchant Shop",phone:"+27700000000"}});
  }
  if(url.pathname==="/api/v1/merchant/orders"){
   if(nextFault==="fail-read"){nextFault=null;return json(res,503,{success:false,error:"Synthetic order read unavailable"});}
   return json(res,200,{success:true,orders:uid==="merchant-a"?records:[]});
  }
 }
 unknownRequests++;
 return json(res,404,{success:false,code:"NOT_FOUND"});
});
await new Promise((ok,fail)=>{server.once("error",fail);server.listen(0,"127.0.0.1",ok);});
const origin="http://127.0.0.1:"+server.address().port;
try {
 const auth=resolve(root,"tests/l3-n6/fixture-auth.ts"),apiAuth=resolve(root,"tests/l3-n6/fixture-api-auth.ts");
 const resolvedStubs={
  firebase:auth,
  apiAuth,
  supabase:resolve(fixtureRoot,"fixture-supabase.ts"),
  useAuthGuard:resolve(fixtureRoot,"fixture-auth-guard.ts"),
  OrderService:resolve(fixtureRoot,"fixture-order-service.ts")
 };
 const out=await build({
  entryPoints:[resolve(fixtureRoot,"fixture-entry.tsx")],bundle:true,write:false,
  platform:"browser",format:"iife",target:"es2022",jsx:"automatic",logLevel:"warning",
  define:{"import.meta.env":JSON.stringify({
   VITE_PICKUP_ORDERING_ENABLED:"false",VITE_MERCHANT_PREVIEW_READ_ONLY:"true",
   VITE_MERCHANT_FAKE_ORDERS_ENABLED:"false",VITE_MERCHANT_ORDERS_FOCUSED_UI:"false",
   VITE_LOCALEATS_API_URL:origin,PROD:false
  })},
  plugins:[{name:"l3n6b-deny-real-backends",setup(plugin){
    for(const [target,path]of Object.entries(resolvedStubs)){
      plugin.onResolve({filter:new RegExp("[/\\\\]"+target+"$")},()=>({path}));
    }
  }}]
 });
 bundle=out.outputFiles[0].text;
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try {
  let count=0;
  const open=async width=>{
   const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:"block"});
   await context.route("**/*",async route=>{
    if(!route.request().url().startsWith(origin+"/"))return route.abort();
    return route.continue();
   });
   const page=await context.newPage(),errors=[];
   page.on("pageerror",e=>errors.push(e.message));
   await page.goto(origin+"/",{waitUntil:"networkidle"});
   return {context,page,errors};
  };
  for(const width of [320,390,1280]){
   records=[order()];apiReads=0;apiWrites=0;unknownRequests=0;nextFault=null;
   const {context,page,errors}=await open(width);
   try {
    await page.getByTestId("real-orders-page").waitFor({timeout:15000});
    await page.getByRole("heading",{name:"Orders Management"}).waitFor();
    const readOnly=page.getByText(/Pickup order, payment and collection changes are disabled pending separately approved database activation/i);
    assert(await readOnly.isVisible(),"Read-only banner must be visible at "+width);
    assert(await page.getByText("Synthetic Kota",{exact:false}).count()>0);
    const controls=page.getByRole("button",{name:"Accept → Preparing"});
    assert(await controls.count()>0,"Pickup action must render from actual OrdersManagement");
    for(const c of await controls.all())assert(await c.isDisabled(),"Pickup mutations disabled");
    const pageWidth=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    assert(pageWidth<=2,"Unexpected document-wide overflow at "+width+" px: "+pageWidth);
    assert.equal(apiWrites,0);assert.equal(unknownRequests,0);
    // Actual Orders page refresh buttons must call the parent callback.
    const before=apiReads;
    const refreshButton=width<768 ? page.getByTitle("Refresh Queue") : page.getByRole("button",{name:"Refresh",exact:true}).first();
    const bounds=await refreshButton.boundingBox();
    assert(bounds,"Refresh must have a visible bounding rectangle");
    const x=bounds.x+bounds.width/2,y=bounds.y+bounds.height/2;
    const tappable=await refreshButton.evaluate((root,{x,y})=>{
      const hit=document.elementFromPoint(x,y);
      return !!hit && (root===hit || root.contains(hit));
    },{x,y});
    assert(tappable,"Refresh button is visually obstructed or outside hit target at "+width+"px");
    // Execute actual React handler, but avoid Playwright click's auto-wait
    // attaching to the fixture's rapidly refreshed component tree.
    await refreshButton.evaluate((node)=>node.click());
    if(width>=768){
      await page.getByRole("button",{name:"Order History",exact:true}).evaluate(node=>node.click());
      await page.getByRole("button",{name:"Current Orders",exact:true}).evaluate(node=>node.click());
    }
    await page.waitForFunction(()=>Number(document.querySelector('[data-testid="fixture-refreshes"]')?.textContent?.match(/\d+/)?.[0])>0);
    await page.getByTestId("fixture-loading").waitFor({state:"hidden"});
    if(width===390){
      // Exercise the actual previously broken mobile Orders layout switch.
      // The default board keeps its original design; tapping Switch must
      // select and restore the single-column alternative without a runtime error.
      await page.getByTitle("Toggle Extra Tools").evaluate(button=>button.click());
      await page.getByText("Layout: Kanban Board").waitFor();
      const layoutSwitch=page.getByRole("button",{name:"Switch",exact:true});
      await layoutSwitch.evaluate(button=>button.click());
      await page.getByText("Layout: List View").waitFor();
      await layoutSwitch.evaluate(button=>button.click());
      await page.getByText("Layout: Kanban Board").waitFor();
      console.log("L3_N7B2_ORIGINAL_ORDERS_LAYOUT_SWITCH_PASS");
    }
    assert(apiReads>before,"Refresh must issue verified API reads");
    assert.equal(apiWrites,0);
    assert.deepEqual(errors,[],"No React/runtime page exceptions");
    count+=8;
    console.log("L3_N6B_REAL_ORDERS_PAGE_READ_ONLY_PASS width="+width);
   }finally{await context.close();}
  }
  // Permission failure must not unlock the previous merchant's shop or cached order.
  records=[order()];apiWrites=0;nextFault="wrong-owner";
  {
   const {context,page,errors}=await open(390);
   try{
    await page.getByTestId("real-orders-page").waitFor();
    await page.getByTestId("switch-account").click();
    await page.getByTestId("fixture-error").filter({hasText:/verify this shop against your Firebase identity/i}).waitFor({timeout:8000});
    assert.equal(await page.getByTestId("real-orders-page").count(),0);
    assert.equal(await page.getByText("Synthetic Kota",{exact:false}).count(),0);
    await page.getByTestId("test-refresh").click();
    await page.getByTestId("real-orders-page").waitFor();
    assert.equal(await page.getByText("Synthetic Kota",{exact:false}).count(),0,
      "Merchant-b must not see merchant-a's order");
    assert.equal(apiWrites,0);
    assert.deepEqual(errors,[]);
    count+=6;
    console.log("L3_N6B_CROSS_MERCHANT_OWNER_GUARD_PASS");
   }finally{await context.close();}
  }
  // Read failure is not silently converted to an empty kitchen.
  records=[order()];apiWrites=0;nextFault=null;
  {
   const {context,page,errors}=await open(390);
   try {
    await page.getByTestId("real-orders-page").waitFor();
    nextFault="fail-read";
    await page.getByTestId("test-refresh").evaluate(node=>node.click());
    await page.getByTestId("fixture-error").filter({hasText:/Synthetic order read unavailable/i}).waitFor();
    assert(await page.getByText("Synthetic Kota",{exact:false}).count()>0,
      "Old same-account verified order not erased after read failure");
    assert.equal(apiWrites,0);
    assert.deepEqual(errors,[]);
    count+=4;
    console.log("L3_N6B_READ_FAILURE_TRUSTWORTHY_STATE_PASS");
   }finally{await context.close();}
  }
  console.log("L3_N6B_ORDERS_PAGE_BROWSER_PASS assertions="+count+" widths=320,390,1280");
 }finally{await browser.close();}
}finally{await new Promise((ok,fail)=>server.close(e=>e?fail(e):ok()));}
