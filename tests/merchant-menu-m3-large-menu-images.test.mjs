import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {MERCHANT_MENU_PAGE_SIZE,merchantMenuNextVisibleCount,menuWritesUnavailable} from "../src/services/merchantMenuPolicy.ts";

const menu=readFileSync(new URL("../src/components/MenuManagement.tsx",import.meta.url),"utf8");
const pkg=JSON.parse(readFileSync(new URL("../package.json",import.meta.url),"utf8"));

test("old react-window list props cannot silently break menus with 21 or more items",()=>{
 assert.match(pkg.dependencies["react-window"],/^\^2\./);
 assert.doesNotMatch(menu,/itemCount=\{|itemSize=\{|<VirtualizedList|const VirtualRow|List as any/);
 assert.match(menu,/grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4/);
 assert.match(menu,/filteredItems\.slice\(0,visibleCount\)\.map\(\(item\) => renderItemCard\(item\)\)/);
 assert.match(menu,/Show more items/);
});

test("large menus reveal successive bounded batches, not a fixed-size clipped list",()=>{
 assert.equal(MERCHANT_MENU_PAGE_SIZE,24);
 assert.equal(merchantMenuNextVisibleCount(24,25),25);
 assert.equal(merchantMenuNextVisibleCount(24,48),48);
 assert.equal(merchantMenuNextVisibleCount(24,73),48);
 assert.equal(merchantMenuNextVisibleCount(48,73),72);
 assert.equal(merchantMenuNextVisibleCount(72,73),73);
 assert.equal(merchantMenuNextVisibleCount(73,73),73);
 assert.equal(merchantMenuNextVisibleCount(-4,60),24);
 assert.equal(merchantMenuNextVisibleCount(24,0),0);
 assert.equal(merchantMenuNextVisibleCount(NaN,50),24);
 assert.match(menu,/visibleCount < filteredItems.length/);
 assert.match(menu,/setVisibleCount\(count=>merchantMenuNextVisibleCount\(count,filteredItems.length\)\)/);
 assert.match(menu,/Showing \{Math.min\(visibleCount, filteredItems.length\)\} of \{filteredItems.length\} items/);
});

test("filter, shop and fresh menu reads reset batch view",()=>{
 assert.match(menu,/useEffect\(\(\) => \{ setVisibleCount\(MERCHANT_MENU_PAGE_SIZE\); \}, \[selectedShopId,searchTerm,filterCategory\]\)/);
 assert.match(menu,/const request = \+\+menuRequest.current;\s*setVisibleCount\(MERCHANT_MENU_PAGE_SIZE\);\s*setItems\(\[\]\)/);
 assert.match(menu,/setSelectedShopId\(verified.id\);\s*setSearchTerm\(""\);\s*setFilterCategory\("All"\)/);
 assert.match(menu,/menuError \? \([\s\S]*?Retry loading menu[\s\S]*?\) : filteredItems.length === 0 \? \(/);
});

test("failed remote menu photos fall back without changing original card layout or labels",()=>{
 assert.match(menu,/const MenuItemPhoto:/);
 assert.match(menu,/const \[failed,setFailed\]=useState\(false\)/);
 assert.match(menu,/if\(failed \|\| isPlaceholderImage\(imageUrl\)\)return <FoodPlaceholder size=\{44\} \/>/);
 assert.match(menu,/onError=\{\(\)=>setFailed\(true\)\}/);
 assert.match(menu,/src=\{getOptimizedCloudinaryUrl\(imageUrl\)\}/);
 assert.match(menu,/loading="lazy"/);
 assert.match(menu,/MenuItemPhoto key=\{\`\$\{item.id\}:\$\{item.image_url \?\? ""\}\`\}/);
 assert.match(menu,/relative h-36 bg-surface-container rounded-xl flex items-center justify-center overflow-hidden shrink-0/);
 assert.match(menu,/merchantMenuStockLabel\(item.stock_quantity\)/);
});

test("M3 remains read only and preserves approved item controls and accessibility",()=>{
 assert.equal(menuWritesUnavailable(),true);
 assert.match(menu,/disabled=\{menuWritesUnavailable\(\)\}/);
 assert.match(menu,/disabled=\{isSaving \|\| menuWritesUnavailable\(\)\}/);
 assert.match(menu,/Menu is read-only in this Preview/);
 assert.match(menu,/aria-label="Search this shop's menu"/);
 assert.match(menu,/merchantMenuCategories\(items\)/);
 assert.doesNotMatch(menu,/onClick=\{\(\) => setEditingPriceId\(item.id\)\}/);
});
