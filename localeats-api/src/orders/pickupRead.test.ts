import test from "node:test";
import assert from "node:assert/strict";
import {pickupReadQuote,type PickupReadRepository} from "./pickupRead.js";
const request=()=>({contract_version:"pickup-v1",idempotency_key:"11111111-1111-4111-8111-111111111111",shop_id:"s",
 items:[{menu_item_id:"m",quantity:2}],delivery_type:"collection",delivery_schedule_mode:"standard",payment_method:"cash",tip_amount:0,
 customer_details:{name:"Test",phone:"0712345678"},launch_location:{lat:-25.98,lng:28.2}});
const repository=()=>({findShop:async()=>({id:"s",name:"Shop",location:"Ivory Park",archived_at:null,is_active:true,approval_status:"approved",lat:-25.98,lng:28.2,latitude:null,longitude:null}),
 findMenuItems:async()=>[{id:"m",shop_id:"s",name:"Kota",price:32.5,is_available:true}]});
const code=(expected:string)=>(error:any)=>error.code===expected;
test("pickup quote matches tested minor-unit/fingerprint contract using reads only",async()=>{
 const repo=repository();let reads=0;
 const q=await pickupReadQuote({findShop:async id=>{reads++;return repo.findShop();},findMenuItems:async()=>{reads++;return repo.findMenuItems();}},"test-uid",request());
 assert.equal(reads,2);assert.equal(q.total_minor,6500);assert.equal(q.service_fee_minor,0);assert.equal(q.delivery_fee_minor,0);
 assert.match(q.pricing_fingerprint,/^[0-9a-f]{64}$/);
 assert.equal((q as any).order,undefined);
});
test("missing identity, old contracts and client prices fail before catalog reads",async()=>{
 const repo:PickupReadRepository={findShop:async()=>{throw new Error("must not read");},findMenuItems:async()=>{throw new Error("must not read");}};
 await assert.rejects(pickupReadQuote(repo,"",request()),code("UNAUTHORIZED"));
 await assert.rejects(pickupReadQuote(repo,"u",{}),code("PICKUP_CONTRACT_REQUIRED"));
 await assert.rejects(pickupReadQuote(repo,"u",{...request(),total_price:1}),code("UNSUPPORTED_INPUT"));
 await assert.rejects(pickupReadQuote(repo,"u",{...request(),items:[{menu_item_id:"m",quantity:1,options:[{price:1}]}]}),code("UNSUPPORTED_INPUT"));
});
test("archived/offline/out-of-area/out-of-radius shops, invalid contact and prices fail closed",async()=>{
 const base=repository(),shop=await base.findShop();
 for(const [patch,expected] of [[{archived_at:"old"},"SHOP_UNAVAILABLE"],[{is_active:false},"SHOP_UNAVAILABLE"],[{location:"Elsewhere"},"OUTSIDE_PICKUP_PILOT"],[{lat:-26.5},"OUTSIDE_PICKUP_RADIUS"]] as const)
  await assert.rejects(pickupReadQuote({...base,findShop:async()=>({...shop,...patch})},"u",request()),code(expected));
 await assert.rejects(pickupReadQuote(base,"u",{...request(),customer_details:{name:"Test",phone:"bad"}}),code("INVALID_PHONE"));
 await assert.rejects(pickupReadQuote({...base,findMenuItems:async()=>[{id:"m",shop_id:"s",name:"Bad",price:"",is_available:true}]},"u",request()),code("INVALID_SERVER_PRICE"));
 await assert.rejects(pickupReadQuote({...base,findMenuItems:async()=>[{id:"m",shop_id:"s",name:"Gone",price:5,is_available:false}]},"u",request()),code("MENU_ITEM_UNAVAILABLE"));
});
test("database failures never manufacture a quote",async()=>{
 await assert.rejects(pickupReadQuote({findShop:async()=>{throw new Error("database offline");},findMenuItems:async()=>[]},"u",request()),/database offline/);
});
