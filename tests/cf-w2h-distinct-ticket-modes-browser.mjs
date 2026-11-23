import {chromium} from "playwright";
import assert from "node:assert/strict";
import {mkdirSync,writeFileSync} from "node:fs";
const HOST="https://localeats-merchant-dashboard-preview.mehey9184.workers.dev";
const LOCAL="http://127.0.0.1:4177";
const LIVE=process.env.CF_W2H_LIVE==="true";
const DIR="artifacts/cf-w2h-a-b-modes";
mkdirSync(DIR,{recursive:true});
const browser=await chromium.launch({headless:true});
const report={checks:[],failures:0};
for(const [width,height] of [[320,740],[390,844],[1366,900]]){
 const mobile=width<600;
 const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1,serviceWorkers:"block",reducedMotion:"reduce"});
 const page=await context.newPage();
 const result={width,height,steps:[],errors:[],writes:[],success:false};
 page.on("pageerror",e=>result.errors.push(String(e)));
 page.on("request",r=>{if(!["GET","HEAD"].includes(r.method()))result.writes.push(r.method()+" "+r.url())});
 page.on("dialog",async d=>{result.steps.push("fake confirmation: "+d.message().slice(0,70));await d.accept()});
 async function choose(mode){
  if(mobile){
    const summary=page.locator("summary").filter({hasText:"Tools"}).first();
    if(!(await summary.isVisible()))throw Error("Tools menu not visible");
    await summary.click();
    const btn=page.getByRole("button",{name:mode==="expediter"?"A · Expediter":"B · Compact"}).first();
    await btn.click();
    await page.waitForTimeout(60);
    assert.equal(await page.locator("details[open]").filter({has:summary}).count(),0,"mobile Tools should auto-close");
  }else{
    await page.getByRole("group",{name:"Choose your Orders style"}).getByRole("button",{name:mode==="expediter"?"A · Expediter":"B · Compact"}).click();
  }
  await page.locator('[data-testid="dual-style-kanban"]').waitFor();
  assert.equal(await page.locator('[data-testid="dual-style-kanban"]').getAttribute("data-style"),mode);
 }
 async function currentTicket(){
  const card=page.getByTestId("fake-incoming-order").first();
  await card.waitFor({state:"visible",timeout:12000});
  return card;
 }
 async function openCompact(){
  const card=await currentTicket();
  const disclosure=card.locator('button[aria-expanded]').first();
  // A row can stay expanded as a desktop order advances between lanes.
  // Preserve that useful continuity instead of assuming every transition
  // always collapses the disclosure.
  if((await disclosure.getAttribute("aria-expanded"))!=="true")await disclosure.click();
  assert.equal(await disclosure.getAttribute("aria-expanded"),"true");
  await card.getByTestId("compact-fake-actions").waitFor({state:"visible",timeout:4000});
  return card;
 }
 try{
  if(!LIVE){
  await page.route("**/*",async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin!==HOST){await route.abort("blockedbyclient");return;}
    if(!["GET","HEAD"].includes(request.method())){await route.abort("blockedbyclient");return;}
    const response=await route.fetch({url:LOCAL+url.pathname+url.search,maxRedirects:0});
    await route.fulfill({response,headers:{...response.headers(),"content-security-policy":"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'"}});
  });
  }
  const resp=await page.goto(HOST+"/",{waitUntil:"domcontentloaded",timeout:35000});
  assert.equal(resp.status(),200);
  await page.getByRole("button",{name:"Orders"}).first().waitFor({timeout:16000});
  await page.getByRole("button",{name:"Orders"}).first().click();
  await page.getByRole("button",{name:"Start fictional order arrivals"}).click();
  await (await currentTicket()).getByText("Fake · Test only").waitFor({timeout:8000});
  await page.getByRole("button",{name:"Stop fictional order arrivals"}).click();
  await choose("expediter");
  const full=await currentTicket();
  assert.equal(await full.getAttribute("data-style"),"expediter");
  const fullSize=await full.boundingBox();result.fullHeight=Math.round(fullSize.height);
  assert.ok(await full.getByTestId("order-customer-note").isVisible(),"A exposes special request");
  assert.ok(await full.getByRole("button",{name:"Accept → Preparing"}).isVisible(),"A exposes actions immediately");
  await page.screenshot({path:DIR+"/"+width+"-a-expanded.png",animations:"disabled"});
  await choose("compact");
  const scan=await currentTicket();
  assert.equal(await scan.getAttribute("data-style"),"compact");
  const compactSize=await scan.boundingBox();result.compactHeight=Math.round(compactSize.height);
  assert.ok(compactSize.height+40<fullSize.height,`B row ${compactSize.height} must be 40+px shorter than A ${fullSize.height}`);
  assert.ok(await scan.getByText("Fake · Test only").isVisible());
  assert.ok(await scan.getByText(/Special request/).isVisible(),"B must flag hidden request");
  assert.equal(await scan.getByRole("button",{name:"Accept → Preparing"}).count(),0,"B actions tucked into disclosure");
  result.steps.push("A full ticket vs B short row / visible FAKE and special-request marker");
  await page.screenshot({path:DIR+"/"+width+"-b-condensed.png",animations:"disabled"});
  await openCompact();
  assert.ok(await scan.getByText("No atchar").isVisible(),"expanded B shows full customer note");
  await scan.getByRole("button",{name:"Accept → Preparing"}).click();
  result.steps.push("B expandable actions / simulated accept");
  if(mobile)await page.getByRole("tab",{name:/Preparing/}).click();
  await choose("expediter");
  const prep=await currentTicket();
  await prep.getByRole("button",{name:"Mark Ready"}).waitFor({state:"visible",timeout:8000});
  result.steps.push("Switching back to A preserves manual order state");
  await choose("compact");
  const preparing=await openCompact();
  await preparing.getByRole("button",{name:"Mark Ready"}).click();
  if(mobile)await page.getByRole("tab",{name:/Ready/}).click();
  // Real updates are lower-priority transitions: wait until the ticket has
  // reached its destination lane before inspecting its disclosure state.
  await page.getByTestId("lane-ready").getByTestId("fake-incoming-order")
    .first().waitFor({state:"visible",timeout:12000});
  const ready=await openCompact();
  await ready.getByRole("button",{name:"Confirm cash received"}).click();
  const paid=await currentTicket();
  await paid.getByRole("button",{name:"Confirm handover"}).waitFor({state:"visible",timeout:8000});
  await paid.getByRole("button",{name:"Confirm handover"}).click();
  result.steps.push("B preparing, ready, cash, handover all fake");
  const dims=await page.evaluate(()=>({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth}));
  assert.ok(dims.documentWidth<=dims.viewport+2,"no horizontal overflow");
  assert.deepEqual(result.errors,[],"no browser runtime errors");
  assert.deepEqual(result.writes,[],"no application HTTP writes");
  result.dimensions=dims;
  result.success=true;
  console.log("PASS CF-W2H "+(LIVE?"LIVE HOST":"local build")+" "+width+"px A="+result.fullHeight+"px B="+result.compactHeight+"px full fake pickup flow");
 }catch(e){
  result.failure=String(e).slice(0,1200);
  report.failures++;console.error("FAIL CF-W2H "+width+"px "+result.failure);
  try{await page.screenshot({path:DIR+"/"+width+"-failure.png",timeout:3500})}catch{}
 }finally{report.checks.push(result);await context.close();}
}
await browser.close();
writeFileSync(DIR+"/results.json",JSON.stringify(report,null,2));
console.log("CF_W2H_DISTINCT_A_B="+(report.checks.length-report.failures)+"/"+report.checks.length);
if(report.failures)process.exit(1);
