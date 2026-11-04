import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  merchantMenuCategories,
  merchantMenuCategoryName,
  merchantMenuMatchesCategory,
  merchantMenuFiltersActive,
  menuWritesUnavailable,
} from "../src/services/merchantMenuPolicy.ts";

const component=readFileSync(new URL("../src/components/MenuManagement.tsx",import.meta.url),"utf8");
const api=readFileSync(new URL("../src/services/MerchantApi.ts",import.meta.url),"utf8");

test("category tabs reflect only verified menu categories, never invented presets",()=>{
  assert.deepEqual(merchantMenuCategories([]),["All"]);
  assert.deepEqual(merchantMenuCategories([
    {category:"Kotas"},{category:" Drinks "},{category:"drinks"},{category:""},
    {category:null},{category:"Breakfast"},{category:"Kotas"}
  ]),["All","Breakfast","Drinks","General","Kotas"]);
  assert.equal(merchantMenuCategoryName(null),"General");
  assert.equal(merchantMenuCategoryName("  "),"General");
  assert.equal(merchantMenuCategoryName(" Local Food "),"Local Food");
  assert.match(component,/useMemo\(\(\) => merchantMenuCategories\(items\), \[items\]\)/);
  assert.doesNotMatch(component,/const defaultCats = \[/);
});

test("category selection is case-insensitive and unknown categories display as General",()=>{
  assert.equal(merchantMenuMatchesCategory(" KOTAS ","Kotas"),true);
  assert.equal(merchantMenuMatchesCategory("Drinks","Kotas"),false);
  assert.equal(merchantMenuMatchesCategory(undefined,"General"),true);
  assert.equal(merchantMenuMatchesCategory(null,"All"),true);
  assert.match(component,/merchantMenuMatchesCategory\(item.category,filterCategory\)/);
  assert.match(component,/merchantMenuCategoryName\(item.category\)/);
  assert.match(component,/aria-pressed=\{filterCategory === cat\}/);
});

test("empty results never claim missing inventory when active filters excluded items",()=>{
  assert.equal(merchantMenuFiltersActive("","All"),false);
  assert.equal(merchantMenuFiltersActive("  ","All"),false);
  assert.equal(merchantMenuFiltersActive("","Kotas"),true);
  assert.equal(merchantMenuFiltersActive(" Kota ","All"),true);
  assert.match(component,/const hasActiveFilters = merchantMenuFiltersActive\(searchTerm, filterCategory\)/);
  assert.match(component,/items.length > 0 && hasActiveFilters \? "No matching menu items" : "No menu items found for this shop"/);
  assert.match(component,/No items match your current search or category/);
  assert.match(component,/Clear search and category/);
  assert.match(component,/setSearchTerm\(""\); setFilterCategory\("All"\)/);
  assert.match(component,/menuError \? \([\s\S]*?Retry loading menu[\s\S]*?\) : filteredItems.length === 0 \? \(/);
});

test("shop switching resets filters and selection and still validates ownership",()=>{
  assert.match(component,/const selectMenuShop = useCallback/);
  assert.match(component,/userOwnedShops.find\(shop => String\(shop.id\) === String\(shopId\)\)/);
  assert.match(component,/if \(!verified\) return;/);
  assert.match(component,/setSelectedShopId\(verified.id\);\s*setSearchTerm\(""\);\s*setFilterCategory\("All"\);\s*setSelectedItems\(\[\]\)/);
  assert.match(component,/onClick=\{\(\) => selectMenuShop\(shop.id\)\}/);
  assert.match(component,/onClick=\{\(\) => selectMenuShop\(s.id\)\}/);
  assert.match(component,/if \(filterCategory !== "All" && !categories.includes\(filterCategory\)\) setFilterCategory\("All"\)/);
  assert.match(api,/Menu shop ownership could not be verified/);
  assert.doesNotMatch(component,/All My Stores \(/);
});

test("original menu cards and disabled writes remain intact",()=>{
  assert.equal(menuWritesUnavailable(),true);
  assert.match(component,/rounded-2xl md:rounded-\[2rem\]/);
  assert.match(component,/getOptimizedCloudinaryUrl\(imageUrl\)/);
  assert.match(component,/MenuItemPhoto key=/);
  assert.match(component,/Menu is read-only in this Preview/);
  assert.match(component,/disabled=\{menuWritesUnavailable\(\)\}/);
  assert.match(component,/disabled=\{isSaving \|\| menuWritesUnavailable\(\)\}/);
  assert.match(component,/aria-label="Search this shop's menu"/);
});
