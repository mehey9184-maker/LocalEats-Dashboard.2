import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  projectPublicCatalogShop, projectPublicCatalogMenuItem,
  publicCatalogShopFields,publicCatalogMenuFields,
} from "./publicCatalogProjection.js";

const privateFields={
  owner_id:"private-owner",
  phone:"+27123456789",
  owner_email:"private-owner@example.invalid",
  access_token:"synthetic-token",
  firebase_uid:"private-uid",
  approval_status:"approved",
  approval_reason:"confidential",
  availability_revision:43,
  availability_override_until:"private-internal-scheduler",
  payment_settings:{bank_account:"secret"},
  rider_location:{lat:1,lng:2},
  private_notes:"do not leak",
  service_role_key:"never-a-public-value",
  nested:{any:"secret"},
};

test("N8L public shop projection removes private columns even from a privileged Supabase row",()=>{
  const output=projectPublicCatalogShop({
    ...privateFields,id:"approved-shop",name:"Local shop",
    description:"Fresh kotas",location:"Ivory Park",
    logo_url:"https://cdn.example.invalid/shop.png",
    is_active:false,lat:-25.98,lng:28.2,rating:4.5,
  });
  assert.deepEqual(Object.keys(output).sort(),[
    "description","id","is_active","lat","lng","location","logo_url","name","rating",
  ]);
  assert.equal(output.is_active,false);
  assert.equal(output.phone,undefined);
  assert.equal(output.owner_id,undefined);
  assert.equal(output.availability_revision,undefined);
  assert.equal(output.private_notes,undefined);
  assert.equal(output.service_role_key,undefined);
  assert.equal(output.approval_status,undefined);
});

test("N8L public menu projection strips per-shop private fields and nested customizations",()=>{
  const output=projectPublicCatalogMenuItem({
    ...privateFields,id:"item-1",shop_id:"approved-shop",name:"Kota",
    price:25,is_available:true,customizations:[{private_key:"unknown"}],
    created_at:"internal",
  });
  assert.deepEqual(Object.keys(output).sort(),["id","is_available","name","price","shop_id"]);
  assert.equal(output.price,25);
  assert.equal(output.owner_email,undefined);
  assert.equal(output.customizations,undefined);
  assert.equal(output.created_at,undefined);
});

test("N8L public projection cannot include attacker-controlled nested fields or invalid numbers",()=>{
  const payload=projectPublicCatalogShop({
    id:"shop",name:"Shop",is_active:true,lat:Infinity,lng:NaN,
    story:"S".repeat(8193),description:{toString:()=>"secret"},
    location:["secret"],
  });
  assert.deepEqual({...payload},{id:"shop",name:"Shop",is_active:true});
  assert.deepEqual((publicCatalogShopFields as readonly string[]).includes("owner_id"),false);
  assert.deepEqual((publicCatalogShopFields as readonly string[]).includes("phone"),false);
  assert.deepEqual((publicCatalogMenuFields as readonly string[]).includes("cost_price"),false);
});

test("N8L every existing catalog route must use a public projection",()=>{
  const src=readFileSync(new URL("./catalog.ts",import.meta.url),"utf8");
  assert.match(src,/projectPublicCatalogShop\(shop\)/);
  assert.match(src,/getApprovedShops\(\)\)\.map\(projectPublicCatalogShop\)/);
  assert.match(src,/menuItems\.map\(projectPublicCatalogMenuItem\)/);
  assert.match(src,/\{\.\.\.projectPublicCatalogShop\(shop\),distance_km\}/);
  assert.ok(!src.includes("menu_items: menuItems,"));
  assert.ok(!src.includes("return distance_km<=4 ? [{...shop,distance_km}]"));
});

test("N8L safe public catalog remains GET-only and keeps inactive approved shops visible",()=>{
  const src=readFileSync(new URL("./catalog.ts",import.meta.url),"utf8");
  assert.ok(!/router\.(post|put|patch|delete)\(/.test(src));
  assert.match(src,/router\.get\("\/pickup-shops"/);
  assert.match(src,/router\.get\("\/shops"/);
  assert.match(src,/router\.get\("\/shops\/:shopId\/menu"/);
  assert.match(src,/distance_km<=4/);
  assert.match(src,/getApprovedShops\(\)/);
});
