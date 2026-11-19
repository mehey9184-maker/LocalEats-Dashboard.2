// L3-N6 local-only browser acceptance: the REAL Merchant pickup controls,
// API adapter and recovery module are bundled into this temporary test page.
// All identity/API traffic is intercepted by this Node loopback fixture.
// No hosted Firebase, Supabase, Vercel, customer data, or FCM connections.
import assert from "node:assert/strict";
import http from "node:http";
import {readdirSync,readFileSync} from "node:fs";
import {resolve} from "node:path";
import {build} from "esbuild";
import {chromium} from "playwright";

const cwd=process.cwd();
const merchantApiModule=resolve(cwd,"tests/l3-n6/fixture-api-auth.ts");
const firebaseModule=resolve(cwd,"tests/l3-n6/fixture-auth.ts");
const entrypoint=resolve(cwd,"tests/l3-n6/fixture-entry.tsx");
const cssDir=resolve(cwd,"dist/assets");
const cssFiles=readdirSync(cssDir).filter(p=>p.endsWith(".css"));
assert(cssFiles.length>0,"Must load actual Merchant CSS from a successful Vite build");
const stylesheet=cssFiles.map(x=>readFileSync(resolve(cssDir,x),"utf8")).join("\n");
let bundles={};
let state;
let faultMode=null;
let unexpectedRequests=0;
const uuid=()=>globalThis.crypto.randomUUID();
const initialOrder=()=>({
 id:"synthetic-l3n6-order",shop_id:"synthetic-shop",user_id:"synthetic-customer",
 delivery_type:"collection",delivery_status:"none",status:"pending",payment_status:"unpaid",
 payment_method:"cash",revision:0,total_price:25,service_fee:0,delivery_fee:0,
 customer_name:"Synthetic Customer",phone:"+27700000000",
 items:[{menu_item_id:"test-meal",name:"Fixture meal",quantity:1,unit_price:25,line_total:25}],
 updated_at:new Date().toISOString()
});
function reset(){
 state={order:initialOrder(),receipts:new Map(),mutations:0,reads:0};
 faultMode=null;unexpectedRequests=0;
}
reset();
const payload=(res,status,body)=>{res.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store"});res.end(JSON.stringify(body));};
const receive=async req=>{let body="";for await(const c of req)body+=c;return JSON.parse(body||"{}");};
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url??"/","http://127.0.0.1");
 if(req.method==="GET"&&url.pathname==="/styles.css"){
  res.writeHead(200,{"Content-Type":"text/css","Cache-Control":"no-store"});res.end(stylesheet);return;
 }
 if(req.method==="GET"&&url.pathname==="/fixture.js"){
  res.writeHead(200,{"Content-Type":"text/javascript","Cache-Control":"no-store"});res.end(bundles[url.searchParams.get("mode")==="disabled"?"disabled":"enabled"]);return;
 }
 if(req.method==="GET"&&url.pathname==="/"){
  res.writeHead(200,{"Content-Type":"text/html","Cache-Control":"no-store"});
  const mode=url.searchParams.get("mode")==="disabled"?"disabled":"enabled";
  res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script src="/fixture.js?mode='+mode+'"></script></body></html>');return;
 }
 if(url.pathname.startsWith("/api/v1/")){
  const uid=/^Bearer fb-(.+)$/.exec(String(req.headers.authorization??""))?.[1]??"";
  if(uid!=="merchant-a"&&uid!=="merchant-b")return payload(res,401,{success:false,code:"UNAUTHORIZED",error:"No synthetic merchant"});
  if(req.method==="GET"&&url.pathname==="/api/v1/merchant/orders"){
   state.reads++;
   return payload(res,200,{success:true,orders:uid==="merchant-a"?[state.order]:[]});
  }
  const match=/^\/api\/v1\/merchant\/orders\/([^/]+)\/(accept|ready|reject|payment-confirmation|collect)$/.exec(url.pathname);
  if(req.method==="POST"&&match){
   state.mutations++;
   if(uid!=="merchant-a"||match[1]!==state.order.id)return payload(res,403,{success:false,code:"FORBIDDEN",error:"Not the shop owner"});
   let command;try{command=await receive(req);}catch{return payload(res,400,{success:false,code:"BAD_REQUEST"});}
   const action=match[2];
   if(typeof command.command_id!=="string"||!Number.isSafeInteger(command.expected_revision))return payload(res,422,{success:false,code:"INVALID_COMMAND"});
   if(state.receipts.has(command.command_id)){
    const saved=state.receipts.get(command.command_id);
    if(saved.action!==action||JSON.stringify(saved.command)!==JSON.stringify(command))return payload(res,409,{success:false,code:"IDEMPOTENCY_CONFLICT"});
    return payload(res,200,{success:true,replayed:true,order:state.order,command_receipt:saved.receipt});
   }
   if(faultMode==="reject-once"){faultMode=null;return payload(res,503,{success:false,code:"API_UNAVAILABLE",error:"Synthetic transport outage; no change confirmed"});}
   if(command.expected_revision!==state.order.revision)return payload(res,409,{success:false,code:"ORDER_STATE_CHANGED",error:"Order changed"});
   const before={...state.order},next={...state.order,revision:state.order.revision+1,updated_at:new Date().toISOString()};
   let kind;
   if(action==="accept"&&before.status==="pending"){next.status="preparing";kind="accepted";}
   else if(action==="ready"&&before.status==="preparing"){next.status="ready_for_pickup";kind="ready";}
   else if(action==="payment-confirmation"&&before.status==="ready_for_pickup"&&before.payment_status==="unpaid"&&["cash","card_machine"].includes(command.payment_method)){next.payment_status="paid";next.payment_method=command.payment_method;kind="payment_confirmed";}
   else if(action==="collect"&&before.status==="ready_for_pickup"&&before.payment_status==="paid"&&command.handover_confirmed===true){next.status="collected";kind="collected";}
   else if(action==="reject"&&before.status==="pending"&&typeof command.reason==="string"&&command.reason.trim()){next.status="cancelled";kind="merchant_rejected";}
   else return payload(res,409,{success:false,code:"INVALID_ORDER_TRANSITION",error:"Invalid synthetic transition"});
   state.order=next;
   const receipt={command_id:command.command_id,order_id:next.id,actor_uid:uid,kind,revision:next.revision};
   state.receipts.set(command.command_id,{action,command,receipt});
   if(faultMode==="drop-after-commit-once"){
    faultMode=null;
    req.socket.destroy(); // Simulated lost reply AFTER synthetic state was committed
    return;
   }
   return payload(res,200,{success:true,replayed:false,order:next,command_receipt:receipt});
  }
 }
 unexpectedRequests++;
 return payload(res,404,{success:false,code:"NOT_FOUND"});
});
await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
const base="http://127.0.0.1:"+server.address().port;
async function compile(enabled){
 const env={VITE_PICKUP_ORDERING_ENABLED:enabled?"true":"false",VITE_LOCALEATS_API_URL:base,
  VITE_MERCHANT_PREVIEW_READ_ONLY:"false",VITE_MERCHANT_FAKE_ORDERS_ENABLED:"false"};
 const result=await build({
  entryPoints:[entrypoint],bundle:true,write:false,format:"iife",platform:"browser",target:"es2022",
  jsx:"automatic",logLevel:"warning",define:{"import.meta.env":JSON.stringify(env)},
  plugins:[{name:"l3n6-isolated-auth-only",setup(build){
   build.onResolve({filter:/[/\\]lib[/\\]firebase$/},()=>({path:firebaseModule}));
   build.onResolve({filter:/[/\\]lib[/\\]apiAuth$/},()=>({path:merchantApiModule}));
  }}]
 });
 return result.outputFiles[0].text;
}
try {
 bundles.enabled=await compile(true);
 bundles.disabled=await compile(false);
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  const widths=[320,390,1280];
  let checks=0;
  async function newPage(width,disabled=false){
   const context=await browser.newContext({viewport:{width,height:850},serviceWorkers:"block"});
   await context.route("**/*",async route=>{
    const url=route.request().url();
    if(!url.startsWith(base+"/")){await route.abort();throw Error("L3_N6_BLOCKED_EXTERNAL_REQUEST");}
    await route.continue();
   });
   const page=await context.newPage();
   page.on("dialog",d=>{void d.accept();});
   const errors=[];page.on("pageerror",e=>errors.push(e.message));
   await page.goto(base+(disabled?"/?mode=disabled":"/"),{waitUntil:"networkidle"});
   return {page,context,errors};
  }
  async function expectStatus(page,status){
   await page.getByTestId("fixture-status").filter({hasText:"Persisted fixture state: "+status}).waitFor({timeout:6000});
   checks++;
  }
  async function clickAccessible(page,name,width){
   const button=page.getByRole("button",{name,exact:true});
   await button.waitFor({state:"visible"});
   assert(await button.isEnabled(),name+" must be enabled in the isolated browser-only fixture");
   const rect=await button.boundingBox();
   assert(rect&&rect.x>=-1&&rect.width>=40&&rect.x+rect.width<=width+1,
    name+" must fit within viewport width "+width+" (was "+JSON.stringify(rect)+")");
   await button.click();
   checks++;
  }
  for(const width of widths){
   reset();
   const {page,context,errors}=await newPage(width);
   try{
    await expectStatus(page,"pending / unpaid");
    await clickAccessible(page,"Accept → Preparing",width);
    await expectStatus(page,"preparing / unpaid");
    await clickAccessible(page,"Mark Ready",width);
    await expectStatus(page,"ready_for_pickup / unpaid");
    assert(await page.getByText(/awaiting actual payment at the counter/i).isVisible());
    await clickAccessible(page,"Confirm card-machine payment",width);
    await expectStatus(page,"ready_for_pickup / paid");
    assert(await page.getByText(/Paid · still awaiting physical handover/i).isVisible());
    await clickAccessible(page,"Food handed over → Collected",width);
    await expectStatus(page,"collected / paid");
    assert.equal(state.order.revision,4);
    assert.equal(state.receipts.size,4);
    assert.equal(state.mutations,4);
    await page.reload({waitUntil:"networkidle"});
    await expectStatus(page,"collected / paid");
    assert.equal(await page.getByRole("button",{name:"Food handed over → Collected"}).count(),0);
    assert.deepEqual(errors,[]);
    assert.equal(unexpectedRequests,0);
    console.log("L3_N6_REAL_PICKUP_COMPONENT_BROWSER_LIFECYCLE_PASS width="+width);
   }finally{await context.close();}
  }
  // Read-only real UI must refuse actual acceptance even though its fixture
  // API could accept it; no auth or SQL/FCM connection is ever made.
  reset();{
   const {page,context,errors}=await newPage(390,true);
   try{
    await expectStatus(page,"pending / unpaid");
    const accept=page.getByRole("button",{name:"Accept → Preparing"});
    assert(await accept.isDisabled());
    assert(await page.getByText(/Pickup changes are disabled pending database activation/i).isVisible());
    assert.equal(state.mutations,0);
    assert.deepEqual(errors,[]);
    console.log("L3_N6_READ_ONLY_PICKUP_ACTION_DENIAL_PASS");
   }finally{await context.close();}
  }
  // Simulate committing an order transition but losing its HTTP response:
  // UI cannot mark it successful locally, exact persisted command is retried.
  reset();{
   faultMode="drop-after-commit-once";
   const {page,context,errors}=await newPage(390);
   try{
    await expectStatus(page,"pending / unpaid");
    await clickAccessible(page,"Accept → Preparing",390);
    await page.getByRole("alert").waitFor({timeout:23000}); // Actual Merchant command deadline is 15s
    await expectStatus(page,"pending / unpaid"); // The browser never invents success
    assert.equal(state.order.status,"preparing"); // But the fixture did commit
    assert.equal(state.receipts.size,1);
    const keys=await page.evaluate(()=>Object.keys(sessionStorage));
    assert(keys.some(k=>k.startsWith("pickup-command:merchant-a:")));
    // Wrong account never sees earlier owner's order or recovery button.
    await page.getByTestId("switch-merchant").click();
    await page.getByTestId("fixture-account").filter({hasText:"merchant-b"}).waitFor();
    await page.getByTestId("empty").waitFor();
    assert.equal(await page.getByTestId("pickup-card").count(),0);
    assert.equal(await page.getByRole("button",{name:"Retry previous action"}).count(),0);
    await page.getByTestId("switch-merchant").click();
    await expectStatus(page,"preparing / unpaid");
    await page.getByRole("button",{name:"Retry previous action"}).click();
    await expectStatus(page,"preparing / unpaid");
    await page.waitForFunction(()=>!Object.keys(sessionStorage).some(k=>k.startsWith("pickup-command:merchant-a:")));
    assert.equal(state.order.revision,1);
    assert.equal(state.receipts.size,1);
    assert.equal(state.mutations,2,"Retry must reuse the same synthetic command ID");
    assert.deepEqual(errors,[]);
    console.log("L3_N6_LOST_REPLY_ACCOUNT_SWITCH_EXACT_RETRY_PASS");
   }finally{await context.close();}
  }
  // 503 before commit must not advance the UI or invent a payment.
  reset();{
   const {page,context,errors}=await newPage(390);
   try {
    await clickAccessible(page,"Accept → Preparing",390);await expectStatus(page,"preparing / unpaid");
    await clickAccessible(page,"Mark Ready",390);await expectStatus(page,"ready_for_pickup / unpaid");
    faultMode="reject-once";
    await clickAccessible(page,"Confirm cash received",390);
    await page.getByRole("alert").filter({hasText:/Synthetic transport outage/i}).waitFor();
    await expectStatus(page,"ready_for_pickup / unpaid");
    assert.equal(state.order.payment_status,"unpaid");
    assert.equal(await page.getByRole("button",{name:"Food handed over → Collected"}).count(),0);
    await page.getByRole("button",{name:"Retry previous action"}).click();
    await expectStatus(page,"ready_for_pickup / paid");
    assert.equal(state.order.payment_method,"cash");
    assert.deepEqual(errors,[]);
    console.log("L3_N6_UNCONFIRMED_PAYMENT_RETRY_PASS");
   }finally{await context.close();}
  }
  console.log("L3_N6_ISOLATED_MERCHANT_BROWSER_PASS checks="+checks+" widths=320,390,1280");
 }finally{await browser.close();}
}finally{await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));}
