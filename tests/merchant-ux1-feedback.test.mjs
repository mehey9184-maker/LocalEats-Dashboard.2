import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (name) => readFileSync(new URL("../" + name, import.meta.url), "utf8");
const feedback = read("src/components/ui/OperationFeedback.tsx");
const overlay = read("src/components/ui/SavingOverlay.tsx");
const home = read("src/components/DashboardOverview.tsx");
const orders = read("src/components/OrdersManagement.tsx");
const menu = read("src/components/MenuManagement.tsx");
const app = read("src/App.tsx");

test("UX1: shared statuses are accessible and never simulate an upload percentage", () => {
  assert.match(feedback, /"idle" \| "loading" \| "success" \| "error" \| "unverified"/);
  assert.match(feedback, /if \(status === "idle"\) return null/);
  assert.match(feedback, /role=\{status === "error" \? "alert" : "status"\}/);
  assert.match(feedback, /aria-live=\{status === "error" \? "assertive" : "polite"\}/);
  assert.match(feedback, /aria-atomic="true"/);
  assert.match(feedback, /motion-reduce:animate-none/);
  assert.match(feedback, /onRetry && \(status === "error" \|\| status === "unverified"\)/);
  assert.doesNotMatch(feedback, /setTimeout|progress=|Math\.random|100%/);
});

test("UX1: existing save state no longer blocks the whole app", () => {
  assert.match(overlay, /<OperationFeedback/);
  assert.match(overlay, /status=\{isSaving \? "loading" : "success"\}/);
  assert.match(overlay, /pointer-events-none fixed/);
  assert.doesNotMatch(overlay, /role="alertdialog"|fixed inset-0|bg-black\/60/);
  assert.match(app, /<SavingOverlay isSaving=\{isSaving\} isSuccess=\{isSaveSuccess\} \/>/);
});

test("UX1: Home refresh success requires a newly verified Orders API read", () => {
  assert.match(home, /setRefreshFeedback\("loading"\)/);
  assert.match(home, /setRefreshFeedback\("unverified"\)/);
  assert.match(home, /setRefreshFeedback\("error"\)/);
  assert.match(home, /ordersReadState === "confirmed" && ordersVerifiedAt !== null/);
  assert.match(home, /ordersVerifiedAt > verificationBeforeRefresh/);
  assert.match(home, /<OperationFeedback/);
  assert.match(home, /disabled=\{isManualRefreshing\}/);
});

test("UX1: Orders refresh never treats a resolved promise as proof of freshness", () => {
  assert.match(orders, /const \[orderRefreshFeedback, setOrderRefreshFeedback\]/);
  assert.match(orders, /setOrderRefreshFeedback\("loading"\)/);
  assert.match(orders, /setOrderRefreshFeedback\("unverified"\)/);
  assert.match(orders, /ordersReadState === "confirmed" && ordersVerifiedAt !== null/);
  assert.match(orders, /ordersVerifiedAt > verifiedBeforeRefresh/);
  assert.match(orders, /disabled=\{isRefreshingOrders\} aria-busy=\{isRefreshingOrders\}/);
  assert.match(orders, /<OperationFeedback/);
  assert.match(orders, /aria-label="Orders workspace"/);
  assert.doesNotMatch(orders, /onClick=\{onRefresh\}/);
});

test("UX1: Menu reflects pending upload/save and errors without turning on writes", () => {
  assert.match(menu, /if \(menuWritesUnavailable\(\)\) \{ toast\.error\("Menu is read-only/);
  assert.match(menu, /setMenuSaveError\(errMsg\)/);
  assert.match(menu, /setMenuSaveError\(errorMsg \|\| "Unable to save the menu item\."\)/);
  assert.match(menu, /<OperationFeedback/);
  assert.match(menu, /isUploadingImage \? "Uploading menu photo…" : "Saving menu item…"/);
  assert.match(menu, /disabled=\{isSaving \|\| menuWritesUnavailable\(\)\}/);
});

test("UX1: Riders remains a Coming Soon page; no new rider action mounted", () => {
  assert.match(app, /id="riders-coming-soon-title"/);
  assert.doesNotMatch(app, /<RiderManagement\b/);
});
