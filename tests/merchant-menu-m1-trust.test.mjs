import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  validateMerchantMenu,
  menuWritesUnavailable,
  merchantMenuStockKnown,
  merchantMenuStockLabel,
  merchantMenuLowStock,
  merchantMenuOutOfStock
} from "../src/services/merchantMenuPolicy.ts";

const menu=readFileSync(new URL("../src/components/MenuManagement.tsx",import.meta.url),"utf8");
const api=readFileSync(new URL("../src/services/MerchantApi.ts",import.meta.url),"utf8");
const catalog=readFileSync(new URL("../localeats-api/src/routes/catalog.ts",import.meta.url),"utf8");

test("unknown API stock never becomes unlimited, zero or a low-stock alarm",()=>{
  for (const value of [undefined,null,"0","",-2,NaN,Infinity,4.2]) {
    assert.equal(merchantMenuStockKnown(value),false);
    assert.equal(merchantMenuStockLabel(value),"Stock tracking unavailable");
    assert.equal(merchantMenuLowStock(value),false);
    assert.equal(merchantMenuOutOfStock(value),false);
  }
  assert.equal(merchantMenuStockLabel(-1),"Stock: Unlimited");
  assert.equal(merchantMenuStockLabel(12),"Stock: 12");
  assert.equal(merchantMenuStockLabel(0),"Stock: 0");
  assert.equal(merchantMenuLowStock(4),true);
  assert.equal(merchantMenuLowStock(5),false);
  assert.equal(merchantMenuOutOfStock(0),true);
  assert.equal(merchantMenuOutOfStock(1),false);
  assert.match(menu,/merchantMenuLowStock\(item.stock_quantity\)/);
  assert.match(menu,/merchantMenuOutOfStock\(item.stock_quantity\)/);
  assert.match(menu,/merchantMenuStockLabel\(item.stock_quantity\)/);
  assert.doesNotMatch(menu,/item.stock_quantity === null \|\| item.stock_quantity === -1 \? "∞"/);
  const publicFields=catalog.match(/const PUBLIC_MENU_FIELDS = "([^"]+)"/)?.[1] ?? "";
  assert.equal(publicFields.includes("stock_quantity"),false);
  assert.equal(publicFields.includes("dietary_tags"),false);
});

test("unapproved menu writes remain blocked and visually disabled without replacing the cards",()=>{
  assert.equal(menuWritesUnavailable(),true);
  assert.equal((menu.match(/disabled=\{menuWritesUnavailable\(\)\}/g)||[]).length,5);
  assert.match(menu,/disabled=\{isSaving \|\| menuWritesUnavailable\(\)\}/);
  assert.match(menu,/disabled\s+title="Menu scanning and import are not yet available"/);
  assert.match(menu,/type="button"\s+disabled=\{menuWritesUnavailable\(\)\}\s+title="Adding menu items/);
  assert.match(menu,/title="Menu editing is not activated in this Preview"/);
  assert.match(menu,/title="Availability changes are unavailable/);
  assert.match(menu,/title="Bulk menu actions are unavailable/);
  assert.doesNotMatch(menu,/onClick=\{\(\) => setEditingPriceId\(item.id\)\}/);
  assert.match(menu,/if \(menuWritesUnavailable\(\)\) \{ toast.error\("Menu is read-only/);
  assert.match(menu,/rounded-2xl md:rounded-\[2rem\]/);
  assert.match(menu,/getOptimizedCloudinaryUrl\(imageUrl\)/);
  assert.match(menu,/MenuItemPhoto key=/);
  assert.match(menu,/Available" : "Unavailable"/);
});

test("API failure is not mistaken for a shop with no menu items",()=>{
  assert.match(menu,/if \(!shop\) throw new Error\("No verified shop is available/);
  assert.match(menu,/const rows = await MerchantApi.getMenuItems\(shop.id\)/);
  assert.match(menu,/setMenuError\(error instanceof Error \? error.message : "Unable to load menu\."\)/);
  assert.match(menu,/isMenuLoading \? \([\s\S]*?\) : menuError \? \([\s\S]*?Menu could not be loaded[\s\S]*?Retry loading menu[\s\S]*?\) : filteredItems.length === 0 \? \(/);
  assert.match(menu,/No menu items found for this shop/);
  assert.doesNotMatch(menu,/No menu items found across your stores/);
  assert.match(api,/return validateMerchantMenu\(data.menu_items, shop.id\)/);
});

test("All Stores no longer shows a first-store-only inventory total",()=>{
  assert.doesNotMatch(menu,/All My Stores \(/);
  assert.doesNotMatch(menu,/View All Stores/);
  assert.match(menu,/setSelectedShopId\(userOwnedShops\[0\].id\)/);
  assert.match(menu,/selectedShopId === "all" \? userOwnedShops\[0\]/);
  assert.match(api,/getMerchantShop\(\)/);
});

test("menu is presented in merchant language, not internal developer/unsupported feature claims",()=>{
  assert.match(menu,/>Menu Management</);
  assert.match(menu,/View your verified menu items, availability and prices. Editing is not activated./);
  assert.match(menu,/Search menu items by name, description or category/);
  assert.match(menu,/Search active/);
  assert.doesNotMatch(menu,/Fuse Indexed|Instant Fuse.js|SWR Active|Manage your food items, instant stock/);
  assert.match(menu,/Menu is read-only in this Preview/);
});

test("merchant menu shop scoping rejects foreign and invalid API rows",()=>{
  const row={id:"m1",shop_id:"owned",name:"Kota",price:29.5,is_available:true};
  assert.deepEqual(validateMerchantMenu([row,row],"owned"),[row]);
  assert.throws(()=>validateMerchantMenu([row],"foreign"),/invalid menu data/);
  assert.throws(()=>validateMerchantMenu([{...row,price:NaN}],"owned"),/invalid menu data/);
  assert.throws(()=>validateMerchantMenu([{...row,is_available:"yes"}],"owned"),/invalid menu data/);
  assert.throws(()=>validateMerchantMenu([row,{...row,price:100}],"owned"),/conflicting menu items/);
});
