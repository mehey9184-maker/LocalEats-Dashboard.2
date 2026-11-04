import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { merchantPullDistance } from "../src/hooks/useMerchantPullToRefresh.ts";

const read = file => readFileSync(new URL("../" + file, import.meta.url), "utf8");
const orders = read("src/components/OrdersManagement.tsx");
const home = read("src/components/DashboardOverview.tsx");
const feedback = read("src/components/ui/OperationFeedback.tsx");
const rolling = read("src/components/ui/RollingOrderCount.tsx");
const pull = read("src/hooks/useMerchantPullToRefresh.ts");
const css = read("src/index.css");
const menu = read("src/components/MenuManagement.tsx");
const app = read("src/App.tsx");

test("M1: 95% tactile press is opt-in, disabled-safe and respects reduced motion", () => {
  assert.match(css, /\.merchant-tap-feedback:not\(:disabled\):active/);
  assert.match(css, /transform: scale\(0\.95\)/);
  assert.match(css, /cubic-bezier\(0\.18, 1\.55, 0\.4, 1\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(orders, /merchant-tap-feedback/);
  assert.match(home, /merchant-tap-feedback/);
  assert.match(menu, /merchant-tap-feedback/);
  assert.match(menu, /disabled=\{isSaving \|\| menuWritesUnavailable\(\)\}/);
});

test("M1: mobile pull has 35% resistance, requires document top and skips nested scrollers", () => {
  assert.equal(merchantPullDistance(-30), 0);
  assert.equal(merchantPullDistance(100), 35);
  assert.equal(merchantPullDistance(500), 64);
  assert.match(pull, /window\.scrollY > 1/);
  assert.match(pull, /overflow-x-auto, \.overflow-y-auto/);
  assert.match(pull, /\[draggable="true"\]/);
  assert.match(pull, /touchmove", move, \{ passive: false \}/);
  assert.match(pull, /if \(event\.cancelable\) event\.preventDefault\(\)/);
  assert.match(pull, /const trigger = dragging && ready/);
  assert.match(orders, /useMerchantPullToRefresh\(!loading && !isRefreshingOrders, handleRefreshOrders\)/);
  assert.match(orders, /Release to refresh orders/);
});

test("M1: only verified order counters roll and unknown counts remain hidden", () => {
  assert.match(rolling, /useReducedMotion\(\)/);
  assert.match(rolling, /if \(!animate \|\| reducedMotion\)/);
  assert.match(rolling, /Array\.from\(digits\)/);
  assert.match(rolling, /Math\.min\(index \* 0\.045, 0\.25\)/);
  assert.match(orders, /unverifiedWithoutPreviousOrders \? "—" : <RollingOrderCount/);
  assert.match(orders, /animate=\{ordersConfidence === "verified"\}/);
  assert.match(home, /animate=\{canRollOrderCounts\}/);
});

test("M1: existing drag-and-drop reorders locally with 5% lift and layout easing", () => {
  assert.match(orders, /scale: isDragging \? 1\.05 : 1/);
  assert.match(orders, /layout: \{ duration: 0\.35, ease: \[0\.22, 1, 0\.36, 1\] \}/);
  assert.match(orders, /handleReorderPendingOrders\(draggedPendingId, order\.id\)/);
  assert.match(orders, /localStorage\.setItem\(pendingSortStorageKey, JSON\.stringify\(updated\)\)/);
  assert.match(orders, /Priority saved on this device/);
});

test("M1: card expands with 350ms ease-out and never changes order authority", () => {
  assert.match(orders, /animate=\{\{ height: "auto", opacity: 1 \}\}/);
  assert.match(orders, /transition=\{\{ duration: 0\.35, ease: \[0\.22, 1, 0\.36, 1\] \}\}/);
  assert.match(orders, /whileTap=\{\{ scale: 0\.95 \}\}/);
  assert.match(orders, /readState=\{ordersReadState\} verifiedAt=\{ordersVerifiedAt\}/);
});

test("M1: circle draws first, then tick only for confirmed shared success", () => {
  assert.match(feedback, /status === "success" && !reduceMotion/);
  assert.match(feedback, /motion\.circle/);
  assert.match(feedback, /motion\.path/);
  assert.match(feedback, /duration: 0\.24/);
  assert.match(feedback, /delay: 0\.22/);
  assert.match(feedback, /aria-live=\{status === "error" \? "assertive" : "polite"\}/);
  assert.match(app, /id="riders-coming-soon-title"/);
  assert.doesNotMatch(app, /<RiderManagement\b/);
});
