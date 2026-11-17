import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read = path => readFileSync(new URL("../"+path,import.meta.url),"utf8");
const app=read("src/App.tsx");
const html=read("index.html");
const css=read("src/index.css");

test("merchant mobile nav fits 320 CSS pixels without 8px labels",()=>{
  assert.match(app,/const primaryMobileTabIds = \["dashboard", "orders", "menu", "riders"\]/);
  const primary=app.slice(app.indexOf('const primaryMobileTabIds'),app.indexOf('{/* More Features Bottom Drawer'));
  assert.match(primary,/min-w-\[56px\] flex-1 shrink-0 min-h-\[56px\]/);
  assert.equal((primary.match(/min-w-\[56px\] flex-1 shrink-0 min-h-\[56px\]/g)||[]).length,2);
  assert.equal((primary.match(/text-\[10px\] uppercase tracking-wide font-bold/g)||[]).length,2);
  assert.doesNotMatch(primary,/text-\[8px\]|min-w-\[64px\]/);
  // 4 primary tabs + 1 More, 4px gaps and 12px side padding each
  assert.ok(5*56+4*4+2*12<=320);
  assert.match(app,/aria-label="Merchant main navigation"/);
  assert.match(primary,/aria-label="More merchant pages"/);
  assert.match(primary,/aria-haspopup="dialog"/);
  assert.match(primary,/aria-expanded=\{isMobileMoreOpen\}/);
  assert.match(primary,/aria-current=\{isActive \? "page" : undefined\}/);
  assert.match(primary,/focus-visible:outline-primary/);
});

test("existing merchant section icons retain their meaning and screen-reader labels",()=>{
  for(const [label,icon] of [
    ["Dashboard","LayoutDashboard"],["Menu","UtensilsCrossed"],
    ["Orders","ReceiptText"],["Riders","Bike"],["Marketing","Megaphone"],
    ["Payments","CreditCard"],["Settings","Settings"]
  ]){
    assert.match(app,new RegExp('label:\\s*"'+label+'",\\s*icon:\\s*'+icon));
  }
  assert.match(app,/<item\.icon size=\{18\} aria-hidden="true"/);
  assert.match(app,/<item\.icon size=\{20\} aria-hidden="true"/);
  assert.match(app,/<MoreHorizontal size=\{20\} aria-hidden="true"/);
});

test("merchant typography uses loaded original brand fonts without introducing a disruptive font swap",()=>{
  assert.match(html,/family=Nunito:/);
  assert.match(html,/family=Quicksand:/);
  assert.match(html,/display=swap/);
  assert.match(css,/--font-headline: "Quicksand"/);
  assert.match(css,/--font-body: "Nunito"/);
  assert.match(app,/text-\[10px\] uppercase tracking-wide font-bold mt-1\.5 leading-tight/);
  assert.match(app,/const navItems = \[/);
  assert.match(app,/pickupOrderingEnabled/);
});
