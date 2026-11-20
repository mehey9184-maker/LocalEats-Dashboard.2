import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validateMerchantMenuForDisplay,validateMerchantMenu} from "../../src/services/merchantMenuPolicy.ts";

const item=Object.freeze({
 id:"kota-1",shop_id:"owned-kota-shop",name:"Kota",price:25,is_available:true,
 image_url:null,created_at:"2026-11-20T09:00:00Z",
 description:null,category:null,stock_quantity:null,
 customizations:[{name:"Atchar"}]
});

test("typed menu preserves API ownership, price, availability and extra catalogue fields",()=>{
 const original=structuredClone(item);
 const [result]=validateMerchantMenuForDisplay([item,item],"owned-kota-shop");
 assert.equal(result.id,item.id);
 assert.equal(result.shop_id,item.shop_id);
 assert.equal(result.price,25);
 assert.equal(result.is_available,true);
 assert.equal(result.created_at,item.created_at);
 assert.equal(result.image_url,"");
 assert.equal(result.category,undefined);
 assert.equal(result.description,undefined);
 assert.deepEqual(result.customizations,item.customizations);
 assert.deepEqual(item,original);
});

test("menu read rejects a cross-shop item and malformed server-required fields",()=>{
 for(const invalid of [
   {...item,shop_id:"foreign-shop"},
   {...item,price:-1},{...item,price:"25"},
   {...item,is_available:"true"},{...item,created_at:undefined},
   {...item,created_at:null},{...item,image_url:{}},
   {...item,stock_quantity:"unknown"},{...item,dietary_tags:["ok",17]},
   {...item,category:42},{...item,id:null}
 ]){
  assert.throws(()=>validateMerchantMenuForDisplay([invalid],"owned-kota-shop"),/invalid menu data/);
 }
 assert.throws(()=>validateMerchantMenuForDisplay([item,{...item,price:30}],"owned-kota-shop"),/conflicting menu items/);
});

test("missing optional photo becomes a blank placeholder, never a synthetic image or price",()=>{
 const [result]=validateMerchantMenuForDisplay([{...item,image_url:undefined}],"owned-kota-shop");
 assert.equal(result.image_url,"");
 assert.equal(result.price,item.price);
 assert.equal(result.stock_quantity,null);
});

test("original generic menu validator keeps existing minimal synthetic contract",()=>{
 const bare={id:"bare",shop_id:"owned-kota-shop",name:"Test",price:10,is_available:true};
 assert.deepEqual(validateMerchantMenu([bare],"owned-kota-shop"),[bare]);
});

test("Merchant API typed menu read stays authenticated, shop-scoped and read-only",()=>{
 const api=readFileSync(new URL("../../src/services/MerchantApi.ts",import.meta.url),"utf8");
 const start=api.indexOf("static async getMenuItems(");
 const end=api.indexOf("static async getOrders(",start);
 assert.ok(start>0&&end>start);
 const block=api.slice(start,end);
 assert.match(block,/Promise<MenuItem\[\]>/);
 assert.match(block,/this\.getMerchantShop\(\)/);
 assert.match(block,/String\(shop\.id\) !== String\(shopId\)/);
 assert.match(block,/!uid \|\| auth\.currentUser\?\.uid !== uid/);
 assert.match(block,/validateMerchantMenuForDisplay\(data\.menu_items, shop\.id\)/);
 assert.doesNotMatch(block,/method:\s*["'](?:POST|PUT|PATCH|DELETE)["']|upload|setAvailability/);
});
