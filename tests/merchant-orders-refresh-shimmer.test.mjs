import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const orders = read("src/components/OrdersManagement.tsx");
const css = read("src/index.css");
const app = read("src/App.tsx");

test("Orders manual refresh toggles an in-place page shimmer, not a new loading route", () => {
  assert.match(orders, /const \[isRefreshingOrders, setIsRefreshingOrders\] = useState\(false\)/);
  assert.match(orders, /setIsRefreshingOrders\(true\)/);
  assert.match(orders, /setIsRefreshingOrders\(false\)/);
  assert.match(orders, /await Promise\.resolve\(onRefresh\(\)\)/);
  assert.match(orders, /className=\{cn\("space-y-4 relative merchant-pull-surface", isRefreshingOrders && "orders-refresh-surface"\)\}/);
  assert.match(orders, /disabled=\{isRefreshingOrders\} aria-busy=\{isRefreshingOrders\}/);
  assert.match(orders, /\{isRefreshingOrders \? "Refreshing…" : "Refresh"\}/);
  assert.match(orders, /<OperationFeedback/);
});

test("Shimmer remains decorative, uses existing palette, supports dark and reduced motion", () => {
  assert.match(css, /\.orders-refresh-surface \{/);
  assert.match(css, /\.orders-refresh-surface::after \{/);
  assert.match(css, /pointer-events: none;/);
  assert.match(css, /rgba\(255, 84, 0,/);
  assert.match(css, /\.dark \.orders-refresh-surface::after/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /animation: none;/);
  assert.match(css, /@keyframes merchant-orders-refresh-sweep/);
  assert.doesNotMatch(css, /\.orders-refresh-surface[^\n]*display: none/);
});

test("Keep inherited order verification and disabled activation boundaries", () => {
  assert.match(orders, /merchantOrdersConfidence\(ordersReadState, ordersVerifiedAt\)/);
  assert.match(orders, /emptyOrderMessage.title/);
  assert.match(orders, /unverifiedWithoutPreviousOrders \? "—" : <RollingOrderCount value=\{stat.count\} animate=\{ordersConfidence === "verified"\}/);
  assert.match(app, /id="riders-coming-soon-title"/);
  assert.doesNotMatch(app, /<RiderManagement\b/);
});
