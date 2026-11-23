import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {build} from "esbuild";
import {createRequire} from "node:module";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";

const code=readFileSync("src/components/PickupOrderActions.tsx","utf8");
const order={id:"fixture-order-1",shop_id:"fixture-owned-shop",delivery_type:"collection",
  pickup_status:"ready_for_pickup",payment_status:"unpaid",revision:2,total_price:25,service_fee:0,
  items:[{name:"Kota",quantity:1,unit_price:25,line_total:25}]};

test("only a resolved, authenticated merchant API transition can announce server confirmation",()=>{
 const transition=code.indexOf("await MerchantApi.transitionPickupOrder(order,action,extra);");
 const confirmation=code.indexOf("setConfirmation({orderId:String(order.id),revision:order.revision,action:label});");
 const event=code.indexOf('window.dispatchEvent(new Event("merchant-pickup-order-confirmed"));');
 assert.ok(transition>=0&&confirmation>transition&&event>confirmation);
 const retry=code.indexOf("await MerchantApi.retryPendingPickupOrder(order);");
 const retryConfirmation=code.indexOf('action:"Previous pickup action"');
 assert.ok(retry>=0&&retryConfirmation>retry);
 assert.match(code,/catch\(e\)/);
 assert.match(code,/setError\(e instanceof Error/);
});
test("the confirmation cannot leak to a different order or a newer revision",()=>{
 assert.match(code,/confirmation\.orderId===String\(order\?\.id\)/);
 assert.match(code,/confirmation\.revision===order\?\.revision/);
 assert.match(code,/showServerConfirmation && !busy && !error/);
 assert.match(code,/setConfirmation\(null\)/);
 assert.match(code,/role="status" aria-live="polite"/);
 assert.match(code,/Shop service confirmed:/);
});
test("disabled merchant actions have readable explanations; payment and handover remain separate",()=>{
 assert.match(code,/aria-describedby=\{!canAct \? disabledHintId : undefined\}/);
 assert.match(code,/id=\{disabledHintId\}/);
 assert.match(code,/Payment and actual handover are separate confirmations/);
 assert.match(code,/if\(action==="confirm_payment"\)/);
 assert.match(code,/if\(action==="collect"\)/);
 assert.match(code,/handover_confirmed=true/);
 assert.match(code,/pickupOrderingEnabled\(\)/);
});
test("merchant controls never show an unconfirmed success on their first render",async()=>{
 const bundle=await build({entryPoints:["src/components/PickupOrderActions.tsx"],
  bundle:true,write:false,format:"cjs",platform:"node",packages:"external",
  define:{"import.meta.env":JSON.stringify({VITE_PICKUP_ORDERING_ENABLED:"false"})}});
 const module={exports:{}};
 new Function("require","module","exports",bundle.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
 const {PickupOrderActions}=module.exports;
 const markup=renderToStaticMarkup(React.createElement(PickupOrderActions,{order}));
 assert.match(markup,/Pickup changes are disabled pending database activation/);
 assert.match(markup,/aria-describedby=/);
 assert.doesNotMatch(markup,/Shop service confirmed:/);
 assert.doesNotMatch(markup,/Awaiting handover/);
});
