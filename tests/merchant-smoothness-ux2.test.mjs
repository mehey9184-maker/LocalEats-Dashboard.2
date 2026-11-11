import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const file=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const app=file("src/App.tsx");
const home=file("src/components/DashboardOverview.tsx");
const orders=file("src/components/OrdersManagement.tsx");
const menu=file("src/components/MenuManagement.tsx");

test("UX2 Menu: verified same-shop rows survive refresh failures and never leak across shop/account scope",()=>{
  assert.match(menu,/const userOwnedShops = useMemo\(/);
  assert.match(menu,/shops\.filter\(\(s\) => isShopOwnedByUser\(s, user\)\)/);
  assert.match(menu,/const menuScope = user\?\.id && selectedVerifiedMenuShopId/);
  assert.match(menu,/useLayoutEffect\(\(\) => \{[\s\S]*?activeMenuScopeRef\.current = menuScope;[\s\S]*?setItems\(\[\]\)/);
  assert.match(menu,/if \(activeMenuScopeRef\.current === menuScope\) return/);
  assert.match(menu,/if \(request !== menuRequest\.current \|\| activeMenuScopeRef\.current !== menuScope\) return/g);
  assert.match(menu,/loadedMenuScopeRef\.current = menuScope/);
  assert.equal((menu.match(/setItems\(\[\]\)/g)||[]).length,2);
  assert.match(menu,/if \(hadVerifiedSnapshot\) \{\s+setIsBackgroundSyncing\(true\)/);
  assert.match(menu,/Menu refresh failed\. Showing last verified items\./);
  assert.match(menu,/Menu could not be verified/);
  assert.match(menu,/Retry menu/);
  assert.doesNotMatch(menu,/setItems\(\[\]\);\s+setMenuError\(null\);\s+setIsMenuLoading\(true\)/);
});

test("UX2 App: merchant-level menu has before-paint account switch protection and stale-not-empty failure",()=>{
  assert.match(app,/const menuReadScope=user\?\.id && menuReadShopId/);
  assert.match(app,/useLayoutEffect\(\(\)=>\{\s+\+\+menuReadRequest\.current;\s+setMenuItems\(\[\]\);\s+setMenuReadStatus\(\{scope:menuReadScope,state:"loading"\}\)/);
  assert.match(app,/MerchantApi\.getMenuItems\(menuReadShopId\)/);
  assert.match(app,/if \(request === menuReadRequest\.current\) \{\s+\/\/ Keep last same-scope snapshot;/);
  assert.match(app,/setMenuReadStatus\(\{scope:menuReadScope,state:"failed"\}\)/);
  assert.match(app,/\}, \[menuReadShopId,menuReadScope\]\)/);
  assert.match(app,/orderReadCoordinator\.current\.refresh\(orderReadScope/);
  assert.match(app,/setOrderReadStatus\(previous => \(\{\.\.\.previous,state:"failed"\}\)\)/);
});

test("UX2 Home: memoize existing totals and stock counters without new claims or backend writes",()=>{
  assert.match(home,/const weeklyOrders = useMemo\(/);
  assert.match(home,/startOfWeekTimestamp = getStartOfWeek\(\)\.getTime\(\)/);
  assert.match(home,/const weeklySales = useMemo\(\(\) => weeklyOrders\.reduce/);
  assert.match(home,/const totalSales = useMemo\(\(\) => orders\.reduce/);
  assert.match(home,/const lowStockMenuItems=useMemo\(/);
  assert.equal((home.match(/lowStockMenuItems\.length/g)||[]).length,3);
  assert.match(home,/const kitchenQueueCount=useMemo\(/);
  assert.match(home,/pickupHomeOrders\(allOrders,currentShop\?\.id\)/);
});

test("UX2 Orders: responsive text filtering and memoized board columns preserve status filters",()=>{
  assert.match(orders,/React\.useDeferredValue\(searchTerm\)/);
  assert.match(orders,/React\.useDeferredValue\(customerSearch\)/);
  assert.match(orders,/React\.useDeferredValue\(phoneSearch\)/);
  assert.match(orders,/const preparingDisplayedOrders = useMemo\(/);
  assert.match(orders,/o\.status === "accepted" \|\| o\.status === "preparing"/);
  assert.match(orders,/const readyDisplayedOrders = useMemo\(/);
  assert.match(orders,/o\.status === "ready"/);
  assert.match(orders,/filterStatus === "All" \|\| o\.status === filterStatus/);
  assert.match(orders,/orderTypeFilter === "All" \|\| o\.order_type === orderTypeFilter/);
  assert.match(orders,/isMerchantOrdersFocusedEnabled\(\)/);
  assert.match(orders,/pickupOrderingEnabled\(\)/);
  assert.match(orders,/const filtered = baseOrders\.filter/);
  assert.doesNotMatch(orders,/displayedOrders\.filter\(o => o\.status === "ready"\)/);
  assert.doesNotMatch(orders,/displayedOrders\.filter\(o => o\.status === "accepted" \|\| o\.status === "preparing"\)/);
});

test("UX2 still denies unapproved menu writes and simulated ordering",()=>{
  assert.match(menu,/if \(menuWritesUnavailable\(\)\)/);
  assert.match(menu,/No change was saved/);
  assert.match(orders,/usePreviewFakeOrders\(\)/);
  assert.match(orders,/const isReadOnlyPreview = import\.meta\.env\.VITE_MERCHANT_PREVIEW_READ_ONLY === "true"/);
  assert.match(app,/merchantShopGate\.status === "ready"/);
});
