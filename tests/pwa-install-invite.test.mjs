import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const app=source("src/App.tsx");
const ui=source("src/components/InstallAppInvite.tsx");
const bridge=source("src/services/pwaInstallInvite.ts");
const vite=source("vite.config.ts");

test("PWA manifest identity stays stable across app updates",()=>{
  assert.match(vite,/VitePWA\(/);
  assert.match(vite,/display: "standalone"/);
  assert.match(vite,/icons:/);
  assert.match(vite,/name: "LocalEats Merchant Dashboard"/); assert.doesNotMatch(vite,/id: "\/merchant-dashboard"/);
});

test("native one-click install only; no false how-to fallback or already-installed CTA",()=>{
  assert.match(bridge,/window.addEventListener\("beforeinstallprompt"/);
  assert.match(bridge,/window.addEventListener\("appinstalled"/);
  assert.match(bridge,/requestNativeInstall/);
  assert.match(bridge,/const event = consumeInstallEvent\(\)/);
  assert.match(bridge,/await event.prompt\(\)/);
  assert.match(ui,/await requestNativeInstall\(\)/);
  assert.match(ui,/availableInstallEvent\(\)/);
  assert.match(ui,/!appAlreadyInstalled\(\)/);
  assert.match(ui,/deferInstallOffer\(storageKey\)/);
  assert.match(ui,/Install now/);
  assert.match(ui,/Maybe later/);
  assert.doesNotMatch(ui,/How to install|Look in its menu|Add to Home Screen/);
  assert.match(bridge,/INSTALL_REMINDER_HOURS = 20/);
  assert.match(bridge,/AUTO_INSTALL_DELAY_MS = 10 \* 60 \* 1000/);
  assert.match(ui,/document.addEventListener\("visibilitychange", sync\)/);
  assert.match(ui,/document.removeEventListener\("visibilitychange", sync\)/);
  assert.match(ui,/document.visibilityState !== "visible"/);
  
  const home=source("src/components/DashboardOverview.tsx");
  assert.match(home,/onInstallApp\?: \(\) => void/);
  assert.match(home,/\{onInstallApp && \(/);
  assert.match(home,/onClick=\{onInstallApp\}/);
  assert.match(app,/onClick=\{onInstallPwa\}/);
  assert.match(app,/requestNativeInstall\(\).then/);
  assert.match(app,/isPwaInstallAvailable && !isPwaInstalled/);
  assert.match(app,/onInstallApp=\{isPwaInstallAvailable && !isPwaInstalled \? onInstallPwa : undefined\}/);
  assert.doesNotMatch(app,/manualOpen=|setManualInstallOpen/);
  
});

test("browser simulation: only user click prompts; dismiss 20h; installed signal prevents nags",async()=>{
  const listeners=new Map();
  const values=new Map();
  globalThis.window={
    addEventListener:(name,callback)=>listeners.set(name,callback),
    matchMedia:()=>({matches:false}),
    localStorage:{
      getItem:key=>values.get(key)??null,
      setItem:(key,val)=>values.set(key,String(val)),
      removeItem:key=>values.delete(key),
    }
  };
  Object.defineProperty(globalThis,"navigator",{value:{userAgent:"Mozilla/5.0 (Android)",maxTouchPoints:0,standalone:false},configurable:true,writable:true});
  const service=await import("../src/services/pwaInstallInvite.ts");
  assert.equal(service.availableInstallEvent(),null);
  assert.equal(service.appAlreadyInstalled(),false);
  let promptCalls=0;
  const offered=new Event("beforeinstallprompt",{cancelable:true});
  offered.prompt=()=>{ promptCalls++; return Promise.resolve({outcome:"dismissed"}); };
  offered.userChoice=Promise.resolve({outcome:"dismissed"});
  listeners.get("beforeinstallprompt")(offered);
  assert.equal(promptCalls,0);
  assert.equal(offered.defaultPrevented,true);
  assert.equal(service.availableInstallEvent(),offered);
  const chosen=service.requestNativeInstall();
  assert.equal(promptCalls,1,"browser install requested during click, before awaiting");
  assert.equal(await chosen,"dismissed");
  assert.equal(service.availableInstallEvent(),null);
  service.deferInstallOffer("later");
  assert.equal(service.hasDeferredInstall("later",Date.now()+19*3600000),true);
  assert.equal(service.hasDeferredInstall("later",Date.now()+21*3600000),false);
  listeners.get("appinstalled")(new Event("appinstalled"));
  assert.equal(service.appAlreadyInstalled(),true);
  assert.equal(values.get("localeats_pwa_installed_verified_v1"),"true");
  const newOffer=new Event("beforeinstallprompt",{cancelable:true});
  newOffer.prompt=async()=>({outcome:"accepted"});
  listeners.get("beforeinstallprompt")(newOffer);
  assert.equal(values.has("localeats_pwa_installed_verified_v1"),false,"new native offer clears stale marker after uninstall");
  assert.equal(service.availableInstallEvent(),newOffer);
  assert.equal(service.appAlreadyInstalled(),false);
  assert.equal(await service.requestNativeInstall(),"accepted");
  assert.equal(values.has("localeats_pwa_installed_verified_v1"),false,
    "Browser chooser acceptance must not be reported as an installed app");
  listeners.get("appinstalled")(new Event("appinstalled"));
  assert.equal(service.appAlreadyInstalled(),true);
});
