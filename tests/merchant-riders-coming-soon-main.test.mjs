import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

test("Riders remains in the original sidebar and is a static Coming Soon page", () => {
  assert.match(app, /\{ id: "riders", label: "Riders", icon: Bike \}/);
  assert.match(app, /id="riders-coming-soon-title"/);
  assert.match(app, />Coming Soon<\/h1>/);
  assert.match(app, /Rider management is not available yet/);
  assert.doesNotMatch(app, /import \{ RiderManagement \}/);
});

test("Riders route cannot open pairing, dispatch or any interactive rider controls", () => {
  const start = app.indexOf('{activeTab === "riders" && (');
  const end = app.indexOf('{activeTab === "payments" && (', start);
  assert.ok(start >= 0 && end > start, "Riders must remain before Payments");
  const route = app.slice(start, end);
  assert.match(route, /<section aria-labelledby="riders-coming-soon-title"/);
  assert.doesNotMatch(route, /<RiderManagement\b|onClick=|onChange=|onSubmit=|<button\b|supabase|fetchConnections|requestRider|sendRiderNudge/);
});

test("Only the Riders route is locked; existing Orders page remains wired", () => {
  assert.match(app, /onRequestRider=\{requestRider\}/);
  assert.match(app, /onDispatchToRider=\{dispatchOrderToRider\}/);
});

test("Merchant Orders cannot send a rider nudge or show a nudge success message", () => {
  const orders = readFileSync(new URL("../src/components/OrdersManagement.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(app, /nudge_rider|sendRiderNudge|LocalEats Courier Nudge/);
  assert.doesNotMatch(orders, /sendRiderNudge|Wake to Tip|Rider nudged successfully/);
  assert.match(orders, /<PickupOrderActions\s+order=/);
});

test("L1C-3: Orders queue comes first and secondary settings are collapsed", () => {
  const orders = readFileSync(new URL("../src/components/OrdersManagement.tsx", import.meta.url), "utf8");
  assert.match(orders, /More tools/);
  assert.match(orders, /showDesktopActions &&/);
  assert.match(orders, /<details className="bg-surface-container-lowest/);
  assert.match(orders, /Notification settings & order limit/);
  assert.doesNotMatch(orders, /Status Dropdown:/);
  assert.doesNotMatch(orders, /across all delivery channels/);
  assert.match(orders, /<PreviewFakeOrderTrigger/);
  assert.equal((orders.match(/<PreviewFakeOrderCard key=\{order\.id\}/g) ?? []).length, 4);
  assert.match(orders, /disabled=\{isReadOnlyPreview\}/);
});

test("L1C-3: incoming fake order enters the four Kanban columns without changing real counts", () => {
  const orders = readFileSync(new URL("../src/components/OrdersManagement.tsx", import.meta.url), "utf8");
  assert.match(orders, /SimulateIncoming\(soundAlerts\)/i);
  assert.match(orders, /usePreviewFakeOrders\(\)/);
  assert.match(orders, /<PreviewFakeOrderTrigger/);
  assert.equal((orders.match(/<PreviewFakeOrderCard key=\{order\.id\}/g) ?? []).length, 4);
  assert.match(orders, /displayedOrders\.length === 0 && \(viewMode !== "active" \|\| fakeOrders\.length===0\)/);
  assert.match(orders, /\{displayedOrders\.length\} Real/);
  assert.match(orders, /\+\{fakeOrders\.length\} FAKE/);
  assert.doesNotMatch(orders, /\[\.\.\.orders,\.\.\.fakeOrders\]|\[\.\.\.fakeOrders,\.\.\.orders\]/);
});

test("L1C-3: simulator and fake card never persist or notify real services", () => {
  const fixture = readFileSync(new URL("../src/components/PreviewFakeOrders.tsx", import.meta.url), "utf8");
  const guard = readFileSync(new URL("../src/services/merchantPreviewSimulator.ts", import.meta.url), "utf8");
  assert.match(guard, /VITE_MERCHANT_PREVIEW_READ_ONLY === "true"/);
  assert.match(guard, /VITE_MERCHANT_FAKE_ORDERS_ENABLED === "true"/);
  assert.match(guard, /VITE_PICKUP_ORDERING_ENABLED !== "true"/);
  assert.match(guard, /location\.hostname/);
  assert.match(guard, /\.vercel/);
  assert.match(fixture, /FAKE-L1C3-/);
  assert.match(fixture, /TEST ONLY/);
  assert.match(fixture, /setFakeOrders\(/);
  assert.match(fixture, /600\)/);
  assert.match(fixture, /pickupCommand\(order,action,extra\)/);
  assert.match(fixture, /pickup_status:"ready_for_pickup"/);
  assert.match(fixture, /onSimulate=\{\(action,extra\)=>onDemoAction/);
  for (const unsafe of [/\bfetch\s*\(/, /\bMerchantApi\b/, /\bsupabase\b/, /\bgetApiAuthHeaders\b/, /\bonUpdateStatus\b/, /\bonDeleteAllOrders\b/, /\blocalStorage\b/, /\bsessionStorage\b/, /\bsendPushNotification\b/]) {
    assert.doesNotMatch(fixture, unsafe);
  }
});

test("L1C-3: actual pickup buttons are shared; simulated actions cannot invoke MerchantApi", () => {
  const actions = readFileSync(new URL("../src/components/PickupOrderActions.tsx", import.meta.url), "utf8");
  assert.match(actions, /const simulated=!!onSimulate && isMerchantPreviewSimulatorEnabled\(\)/);
  assert.match(actions, /FAKE-L1C3-/);
  assert.match(actions, /const canAct=simulated \|\| pickupOrderingEnabled\(\)/);
  assert.match(actions, /const pending=simulated \? false : MerchantApi\.hasPendingPickupCommand\(order\)/);
  assert.match(actions, /if\(simulated\) \{/);
  assert.match(actions, /await onSimulate!\(action,extra\)/);
  assert.match(actions, /\} else \{\s*await MerchantApi\.transitionPickupOrder\(order,action,extra\)/);
  assert.match(actions, /TEST ONLY: Simulate a cash\/card payment/);
  assert.match(actions, /TEST ONLY: Simulate food handover/);
});

test("L1C-3: two uploaded KDS layouts are selectable and remembered per shop", () => {
  const orders=readFileSync(new URL("../src/components/OrdersManagement.tsx",import.meta.url),"utf8");
  const focused=readFileSync(new URL("../src/components/OrdersFocusedWorkspace.tsx",import.meta.url),"utf8");
  const board=readFileSync(new URL("../src/components/OrdersStyleBoard.tsx",import.meta.url),"utf8");
  assert.ok(orders.includes("isMerchantOrdersFocusedEnabled()"));
  assert.ok(!orders.includes("if (import.meta.env.VITE_MERCHANT_ORDERS_FOCUSED_UI"));
  assert.ok(orders.includes("localeats.merchant.orders.style.v1.shop"));
  assert.ok(focused.includes("A · Expediter"));
  assert.ok(focused.includes("B · Compact"));
  assert.ok(focused.includes('aria-label="Choose your Orders style"'));
  assert.ok(focused.includes("localStorage.setItem(styleStorageKey,choice)"));
  assert.ok(focused.includes("localStorage.getItem(key)"));
  assert.ok(focused.includes("<OrdersStyleBoard"));
  assert.ok(board.includes('data-style={style}'));
  assert.ok(board.includes('style==="expediter"'));
  assert.ok(board.includes('style==="compact"'));
  assert.ok(board.includes("md:grid-cols-2 2xl:grid-cols-4"));
});

test("L1C-3: large test batches are bounded and mobile lanes do not overflow", () => {
  const focused=readFileSync(new URL("../src/components/OrdersFocusedWorkspace.tsx",import.meta.url),"utf8");
  const board=readFileSync(new URL("../src/components/OrdersStyleBoard.tsx",import.meta.url),"utf8");
  const fake=readFileSync(new URL("../src/components/PreviewFakeOrders.tsx",import.meta.url),"utf8");
  assert.ok(board.includes("visibleByLane"));
  assert.ok(board.includes("pending:6,preparing:6,ready:6,fulfilled:6"));
  assert.ok(board.includes("slice(0,visibleByLane[lane.key])"));
  assert.ok(board.includes("Show 6 more"));
  assert.ok(board.includes('role="tablist" aria-label="Mobile kitchen lane"'));
  assert.ok(board.includes("min-w-0"));
  assert.ok(!board.includes("w-[400px]"));
  assert.ok(!board.includes("min-h-[500px]"));
  assert.ok(fake.includes("const simulateBatch=()=>"));
  assert.ok(fake.includes("Array.from({length:24}"));
  assert.ok(fake.includes(".slice(0,60)"));
  assert.ok(focused.includes("Test busy queue · +24 FAKE orders"));
  assert.ok(fake.includes('variant?:"expediter"|"compact"'));
});

test("L1C-3: fake and real order authority stay separate across both layouts", () => {
  const orders=readFileSync(new URL("../src/components/OrdersManagement.tsx",import.meta.url),"utf8");
  const focused=readFileSync(new URL("../src/components/OrdersFocusedWorkspace.tsx",import.meta.url),"utf8");
  const board=readFileSync(new URL("../src/components/OrdersStyleBoard.tsx",import.meta.url),"utf8");
  const fake=readFileSync(new URL("../src/components/PreviewFakeOrders.tsx",import.meta.url),"utf8");
  assert.ok(focused.includes('realOrders.map(order=>({kind:"real"'));
  assert.ok(focused.includes('activeFake.map(order=>({kind:"fake"'));
  assert.ok(focused.includes("onDemoAction={onDemoAction}"));
  assert.ok(orders.includes("renderRealOrder={renderOrderCard}"));
  assert.ok(board.includes('entry.kind==="fake"'));
  assert.ok(board.includes("<PreviewFakeOrderCard"));
  assert.ok(board.includes("renderRealOrder(order,index)"));
  assert.ok(board.includes("<PickupOrderActions order={order}"));
  assert.ok(!focused.includes("onDeleteAllOrders"));
  assert.ok(!focused.includes("Clear all real orders"));
  assert.ok(fake.includes("onSimulate={(action,extra)=>onDemoAction"));
  assert.ok(focused.includes("localStorage.setItem(styleStorageKey,choice)"));
  assert.ok(!fake.includes("localStorage"));
  assert.ok(!fake.includes("sessionStorage"));
  for(const file of [board,fake]){
    for(const bad of ["fetch(","MerchantApi.","supabase.","sendPushNotification(","window.dispatchEvent("])
      assert.ok(!file.includes(bad),"No order/API/notification write transport in display code: "+bad);
  }
});

test("L1C-3: misleading live payment, delivery and POS claims from mockups are excluded", () => {
  const board=readFileSync(new URL("../src/components/OrdersStyleBoard.tsx",import.meta.url),"utf8");
  const focused=readFileSync(new URL("../src/components/OrdersFocusedWorkspace.tsx",import.meta.url),"utf8");
  for(const bad of ["Pickup Checkout Active","Real card/instant EFT payments are live","Direct POS link 0 dropped packets","Accept All New","Webhooks operational","Hand Over to Rider"]){
    assert.ok(!board.includes(bad));
    assert.ok(!focused.includes(bad));
  }
});

test("L1C-3 polish: compact tickets have high-contrast text and a single-line item summary",()=>{
  const fake=readFileSync(new URL("../src/components/PreviewFakeOrders.tsx",import.meta.url),"utf8");
  const board=readFileSync(new URL("../src/components/OrdersStyleBoard.tsx",import.meta.url),"utf8");
  assert.ok(fake.includes("font-headline font-extrabold text-slate-900"));
  assert.ok(fake.includes("1× {order.product_name}"));
  assert.ok(fake.includes('data-style={variant}'));
  assert.ok(fake.includes("rounded-xl px-3 py-2.5 space-y-1.5"));
  assert.ok(fake.includes("<PickupOrderActions order={order} compact"));
  assert.ok(!fake.includes("Never printed, sent, charged or stored."));
  assert.ok(board.includes("font-headline font-extrabold"));
  assert.ok(board.includes("compact={!roomy}"));
});

test("L1C-3 polish: Accept and Reject share one safe action row",()=>{
  const actions=readFileSync(new URL("../src/components/PickupOrderActions.tsx",import.meta.url),"utf8");
  assert.ok(actions.includes('className="flex w-full items-center gap-2 min-w-0"'));
  assert.ok(actions.includes('"Accept & Prep"'));
  assert.ok(actions.includes("label===\"Reject\""));
  assert.ok(actions.includes("Reject fake order (reason required)"));
  assert.ok(actions.includes("w-11 shrink-0 border border-slate-200"));
  assert.ok(actions.includes("bg-orange-500 hover:bg-orange-600 text-white"));
  assert.ok(actions.includes("bg-emerald-600 hover:bg-emerald-700 text-white"));
  assert.ok(actions.includes("aria-label={reject ?"));
  assert.ok(actions.includes("const reason=window.prompt"));
  assert.ok(actions.includes("await onSimulate!(action,extra)"));
  assert.ok(actions.includes("await MerchantApi.transitionPickupOrder(order,action,extra)"));
  assert.ok(actions.includes("!canAct"));
});

test("L1C-3 polish: changed fake orders use memo and lower-priority list updates",()=>{
  const fake=readFileSync(new URL("../src/components/PreviewFakeOrders.tsx",import.meta.url),"utf8");
  assert.ok(fake.includes("memo(function PreviewFakeOrderCard"));
  assert.ok(fake.includes("const onDemoAction:PreviewTestPickupAction=useCallback("));
  assert.ok(fake.includes("startTransition(()=>setFakeOrders(next))"));
  assert.ok(fake.includes("itemsRef.current=next"));
  assert.ok(!fake.includes("MerchantApi.transitionPickupOrder"));
  assert.ok(!fake.includes("supabase."));
  assert.ok(!fake.includes("sendPushNotification"));
});

test("L1C-3 notes: customer instructions are visible before Accept in both order styles",()=>{
  const board=readFileSync(new URL("../src/components/OrdersStyleBoard.tsx",import.meta.url),"utf8");
  const fake=readFileSync(new URL("../src/components/PreviewFakeOrders.tsx",import.meta.url),"utf8");
  const notes=readFileSync(new URL("../src/components/OrderCustomerNote.tsx",import.meta.url),"utf8");
  const policy=readFileSync(new URL("../src/services/merchantPickupPolicy.ts",import.meta.url),"utf8");
  assert.ok(board.includes("<OrderCustomerNote order={order} compact={!roomy}/>"));
  assert.ok(fake.includes("<OrderCustomerNote order={order} compact={!roomy}/>"));
  assert.ok(fake.includes('notes:number%4===1?"No atchar":undefined'));
  assert.ok(notes.includes("Special request"));
  assert.ok(notes.includes('aria-label="Customer preparation instructions"'));
  assert.ok(notes.includes("whitespace-pre-wrap break-words"));
  assert.ok(notes.includes("if(orderNote)return [orderNote];"));
  assert.ok(notes.includes("typeof item.notes"));
  assert.ok(policy.includes("const itemNotes="));
  assert.ok(policy.includes("const notes=itemNotes"));
  assert.ok(board.indexOf("<OrderCustomerNote order={order}")<board.indexOf("<PickupOrderActions order={order}"));
  assert.ok(fake.indexOf("<OrderCustomerNote order={order}")<fake.indexOf("<PickupOrderActions order={order}"));
  for (const code of [notes,board,fake]) {
    assert.ok(!code.includes("dangerouslySetInnerHTML"));
    assert.ok(!code.includes("innerHTML="));
  }
});

test("L1C-3 notes: customer instructions are not stored or sent by the fake-ticket component",()=>{
  const fake=readFileSync(new URL("../src/components/PreviewFakeOrders.tsx",import.meta.url),"utf8");
  const notes=readFileSync(new URL("../src/components/OrderCustomerNote.tsx",import.meta.url),"utf8");
  for (const src of [fake,notes]) {
    for (const forbidden of ["MerchantApi.transitionPickupOrder","sendPushNotification(","localStorage.setItem(","fetch(","supabase."]) {
      assert.ok(!src.includes(forbidden),"No note or fake-order network write: "+forbidden);
    }
  }
});

test("L1C-3 release: history has an accessible Show more action beyond 24 orders",()=>{
  const board=readFileSync(new URL("../src/components/OrdersStyleBoard.tsx",import.meta.url),"utf8");
  assert.ok(board.includes("const [visibleHistory,setVisibleHistory]=useState(24)"));
  assert.ok(board.includes("allEntries.slice(0,visibleHistory)"));
  assert.ok(board.includes("allEntries.length>shown.length"));
  assert.ok(board.includes("setVisibleHistory(count=>count+24)"));
  assert.ok(board.includes("Show 24 more history orders"));
  assert.ok(!board.includes("Showing first 24 history records. Use search or date filters"));
});

test("L1C-3 release: expanding real pickup details does not duplicate action controls",()=>{
  const board=readFileSync(new URL("../src/components/OrdersStyleBoard.tsx",import.meta.url),"utf8");
  assert.ok(board.includes("pickup && !expanded ?"));
  assert.ok(board.includes("!pickup && !expanded ?"));
  assert.ok(board.includes("expanded&&<div"));
  assert.ok(board.includes("renderRealOrder(order,index)"));
  assert.equal((board.match(/<PickupOrderActions order=\{order\}/g)??[]).length,1);
});

test("L1C-3 release: live presentation is separate from fake Preview",()=>{
  const orders=readFileSync(new URL("../src/components/OrdersManagement.tsx",import.meta.url),"utf8");
  const guard=readFileSync(new URL("../src/services/merchantPreviewSimulator.ts",import.meta.url),"utf8");
  assert.ok(orders.includes("isMerchantOrdersFocusedEnabled()"));
  assert.ok(guard.includes('VITE_MERCHANT_ORDERS_FOCUSED_UI === "true"'));
  assert.ok(guard.includes('window.location.hostname === "dashboard.localeatssa.co.za"'));
  assert.ok(guard.includes('VITE_PICKUP_ORDERING_ENABLED !== "true"'));
  assert.ok(guard.includes("inReviewPreview || onApprovedMerchantProduction"));
  assert.ok(guard.includes('VITE_MERCHANT_PREVIEW_READ_ONLY === "true"'));
  assert.ok(guard.includes('VITE_MERCHANT_FAKE_ORDERS_ENABLED === "true"'));
  assert.ok(guard.includes("window.location.hostname"));
});

test("L1C-3 release: fake-only controls are absent from live owner workspace",()=>{
  const focused=readFileSync(new URL("../src/components/OrdersFocusedWorkspace.tsx",import.meta.url),"utf8");
  const board=readFileSync(new URL("../src/components/OrdersStyleBoard.tsx",import.meta.url),"utf8");
  const simulator=readFileSync(new URL("../src/services/merchantPreviewSimulator.ts",import.meta.url),"utf8");
  assert.ok(focused.includes("const isTestPreview=isMerchantPreviewSimulatorEnabled()"));
  assert.ok(focused.includes("isTestPreview&&<button"));
  assert.ok(focused.includes("isTestPreview&&<p"));
  assert.ok(focused.includes("!pickupOrderingEnabled()"));
  assert.ok(!focused.includes("onDeleteAllOrders"));
  assert.ok(!focused.includes("Clear all real orders"));
  assert.ok(board.includes('allEntries.some(e=>e.kind==="fake")'));
  assert.ok(simulator.includes('VITE_MERCHANT_FAKE_ORDERS_ENABLED === "true"'));
  assert.ok(simulator.includes('^local-eats-dashboard-2-6m8o-'));
});

test("L1C-4: each verified alert shakes only its destination navigation icon",()=>{
  const hook=readFileSync(new URL("../src/hooks/usePageNotificationAttention.ts",import.meta.url),"utf8");
  const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
  assert.ok(hook.includes('new_order:"orders",inventory_low:"menu",rider:"riders"'));
  assert.ok(hook.includes('marketing:"marketing",payment:"payments",settings:"settings"'));
  assert.ok(hook.includes('orders.filter(o=>o.status==="pending")'));
  assert.ok(hook.includes('ordersFresh'));
  assert.ok(hook.includes('menuFresh'));
  assert.ok(hook.includes('scopeRef.current!==scope'));
  assert.ok(hook.includes('previous && [...pending].some(id=>!previous.has(id))'));
  assert.ok(hook.includes('previous && [...lowStock].some(id=>!previous.has(id))'));
  assert.ok(hook.includes('orderBaseline.current=null'));
  assert.ok(hook.includes('stockBaseline.current=null'));
  assert.ok(app.includes("usePageNotificationAttention({"));
  assert.ok(app.includes('orderReadStatus.state==="fresh"'));
  assert.ok(app.includes('menuReadStatus.state==="ready"'));
  assert.ok(app.includes('lowStockMenuCount>0 ? lowStockMenuCount : null'));
});

test("L1C-4: accessible nav wiggle is finite and respects reduced motion",()=>{
  const css=readFileSync(new URL("../src/index.css",import.meta.url),"utf8");
  const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
  const hook=readFileSync(new URL("../src/hooks/usePageNotificationAttention.ts",import.meta.url),"utf8");
  assert.ok(css.includes("@keyframes localeats-nav-notice-wiggle"));
  assert.ok(css.includes("560ms ease-in-out 2"));
  assert.ok(css.includes("(prefers-reduced-motion: no-preference)"));
  assert.ok(css.includes("(prefers-reduced-motion: reduce)"));
  assert.ok(hook.includes('window.matchMedia?.("(prefers-reduced-motion: reduce)")'));
  assert.ok(hook.includes("const ANIMATION_MS=1150"));
  assert.ok(hook.includes("timers.current.delete(page)"));
  assert.ok(app.includes('localeats-nav-notice-wiggle'));
  assert.ok(app.includes("desktop-"));
  assert.ok(app.includes("mobile-more-"));
  assert.ok(app.includes("mobile-drawer-"));
  assert.ok(app.includes("mobile-"));
  assert.ok(hook.includes("last!==activeTab"));
  assert.ok(hook.includes("stopPage(activeTab as AttentionPage)"));
});

test("L1C-4: notification shake demo is preview-only, and alerts are truthful",()=>{
  const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
  const center=readFileSync(new URL("../src/components/NotificationCenterSidePanel.tsx",import.meta.url),"utf8");
  const preview=readFileSync(new URL("../src/services/merchantPreviewSimulator.ts",import.meta.url),"utf8");
  assert.ok(app.includes("onPreviewTestNotice={isMerchantPreviewSimulatorEnabled()"));
  assert.ok(app.includes("pulseNavNotice(topic)"));
  assert.ok(center.includes("Preview only · Test page icon animation"));
  assert.ok(center.includes("This only shakes an icon. It does not create a notification or order."));
  assert.ok(center.includes('["new_order","Orders"]'));
  assert.ok(center.includes('["inventory_low","Menu"]'));
  assert.ok(center.includes('["payment","Payments"]'));
  assert.ok(preview.includes('VITE_MERCHANT_PREVIEW_READ_ONLY === "true"'));
  assert.ok(preview.includes('VITE_MERCHANT_FAKE_ORDERS_ENABLED === "true"'));
  assert.ok(!center.includes("Your storefront is fully active and connecting to nearby riders."));
  assert.ok(!center.includes('time: "5m ago"'));
  assert.ok(!center.includes('time: "Just now"'));
  for(const code of [center,hookRead()]) {
    for(const unsafe of ["fetch(","MerchantApi.","supabase.","sendPushNotification("])
      assert.ok(!code.includes(unsafe),"Nav animation must not send data: "+unsafe);
  }
  function hookRead(){return readFileSync(new URL("../src/hooks/usePageNotificationAttention.ts",import.meta.url),"utf8");}
});

test("P3.1 payment page cannot settle money or fabricate financial PDF records",()=>{
  const pay=readFileSync(new URL("../src/components/PaymentHistory.tsx",import.meta.url),"utf8");
  for(const forbidden of [
    'localeats_settled_cod_orders','toggleCodSettlement','Mark Settled',
    'Settled & Cleared','PENDING HANDOVER','Courier Handshake',
    'generateFinancialAndCodReport','Export Financial PDF',
    'jsPDF','autoTable(','localStorage.setItem(','supabase.from('
  ])assert.ok(!pay.includes(forbidden),"P3.1 must not contain unsupported settlement or export: "+forbidden);
  assert.ok(pay.includes("This page cannot mark a transaction paid, received or settled."));
  assert.ok(pay.includes("not cash receipts, bank statements or proof of settlement"));
  assert.ok(pay.includes('role="note"'));
});

test("P3.1 order payment flags are read-only and strictly from fresh verified owned shop API",()=>{
  const pay=readFileSync(new URL("../src/components/PaymentHistory.tsx",import.meta.url),"utf8");
  const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
  assert.ok(pay.includes("ordersVerified=false"));
  assert.ok(pay.includes("const verified=shopVerified && ordersVerified && !!currentShop"));
  assert.ok(pay.includes("String(currentShop.id)===String(shopId)"));
  assert.ok(pay.includes("String(order.shop_id)===String(shopId)"));
  assert.ok(pay.includes('order.delivery_type==="collection"'));
  assert.ok(pay.includes("if(!verified)return []"));
  assert.ok(pay.includes("Order API: marked paid"));
  assert.ok(pay.includes("Not independent payment proof"));
  assert.ok(pay.includes("Verified order information unavailable"));
  assert.ok(pay.includes("No pickup orders in the verified result"));
  assert.ok(!pay.includes("from \"../lib/supabase\""));
  assert.ok(!pay.includes('from("payments")'));
  assert.ok(app.includes('ordersVerified={merchantShopGate.status==="ready"'));
  assert.ok(app.includes('orderReadStatus.state==="fresh"'));
  assert.ok(app.includes('orderReadScope==='));
});

test("P3.1 billing copy is honest, pickup-first, and no live payment features are enabled",()=>{
  const pay=readFileSync(new URL("../src/components/PaymentHistory.tsx",import.meta.url),"utf8");
  assert.ok(pay.includes("Pickup-first · Customers pay at the shop."));
  assert.ok(pay.includes("Online checkout and merchant payouts are not active."));
  const plans=readFileSync(new URL("../src/components/MerchantSubscriptionPlans.tsx",import.meta.url),"utf8");
  assert.ok(pay.includes("<MerchantSubscriptionPlans"));
  assert.ok(plans.includes("Billing is not active"));
  assert.ok(plans.includes("Planned three-month free introductory period"));
  assert.ok(plans.includes("Not available for purchase yet"));
  assert.ok(pay.includes('role="group" aria-label="Payment sections"'));
  assert.ok(pay.includes('aria-pressed={tab==="pickup"}'));
  assert.ok(pay.includes('aria-pressed={tab==="billing"}'));
  assert.ok(pay.includes("shopId: string | number;"));
  assert.ok(!pay.includes('role="tabpanel"'));
  assert.ok(pay.includes("pickupOrders.slice(0,limit)"));
  assert.ok(pay.includes("setLimit(n=>n+20)"));
  assert.ok(!pay.includes("cash-on-delivery"));
  assert.ok(!pay.includes("voucher redemptions"));
  assert.ok(!pay.includes("payment handover"));
});

test("P3.2 planned Free/Plus/Pro/Premium cards show correct prices without collecting money",()=>{
  const plans=readFileSync(new URL("../src/components/MerchantSubscriptionPlans.tsx",import.meta.url),"utf8");
  const pay=readFileSync(new URL("../src/components/PaymentHistory.tsx",import.meta.url),"utf8");
  for(const tier of ['{id:"free",name:"Free",price:0}','{id:"plus",name:"Plus",price:199}','{id:"pro",name:"Pro",price:399}','{id:"premium",name:"Premium",price:499}']){
    assert.ok(plans.includes(tier),"Missing approved plan: "+tier);
  }
  assert.ok(pay.includes("<MerchantSubscriptionPlans shop={currentShop} verified={"));
  assert.ok(plans.includes("Your current plan"));
  assert.ok(plans.includes("Billing is not active"));
  assert.ok(plans.includes("Tier benefits and launch dates are not finalized"));
  assert.ok(plans.includes("Not available for purchase yet"));
  assert.ok(!plans.includes("onCheckout"));
  assert.ok(!plans.includes("onActivateSubscription"));
  assert.ok(!plans.includes("Mark as paid"));
  for(const term of ["fetch(","supabase.","MerchantApi.","localStorage.setItem(","window.dispatchEvent("]){
    assert.ok(!plans.includes(term),"No write-capable subscriptions in P3.2: "+term);
  }
});

test("P3.2 expiry countdown requires explicit timezone-aware API date; no fabricated trial",()=>{
  const plans=readFileSync(new URL("../src/components/MerchantSubscriptionPlans.tsx",import.meta.url),"utf8");
  const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
  const home=readFileSync(new URL("../src/components/DashboardOverview.tsx",import.meta.url),"utf8");
  assert.ok(plans.includes("typeof value!==\"string\""));
  assert.ok(plans.includes("Date.parse(value)"));
  assert.ok(plans.includes("shop.subscription_status===\"trial\""));
  assert.ok(plans.includes("shop.trial_end_date"));
  assert.ok(plans.includes("shop.subscription_expires_at"));
  assert.ok(plans.includes("Expiry date awaiting confirmation"));
  assert.ok(plans.includes("Africa/Johannesburg"));
  assert.ok(plans.includes("setInterval(()=>setNow(Date.now()),1000)"));
  assert.ok(plans.includes("window.clearInterval(interval)"));
  assert.ok(plans.includes('aria-label={t.elapsed?'));
  assert.ok(!plans.includes("shop.created_at"));
  assert.ok(!plans.includes("shop.next_payment_date"));
  assert.ok(app.includes("parsePlanExpiry(currentShop.trial_end_date)"));
  assert.ok(!app.includes("30 * 24 * 60 * 60 * 1000"));
  assert.ok(!app.includes("Default to a 30-day trial"));
  assert.ok(home.includes('"Not verified"'));
  assert.ok(home.includes('"See Payments"'));
  assert.ok(!home.includes('"Active Plan"'));
  assert.ok(!home.includes('"Professional"'));
});

test("P3.2 countdown sample is isolated to the no-write branch Preview",()=>{
  const plans=readFileSync(new URL("../src/components/MerchantSubscriptionPlans.tsx",import.meta.url),"utf8");
  assert.ok(plans.includes('VITE_MERCHANT_PREVIEW_READ_ONLY==="true"'));
  assert.ok(plans.includes('VITE_PICKUP_ORDERING_ENABLED!=="true"'));
  assert.ok(plans.includes('VITE_PAYMENTS_PLAN_DEMO_ENABLED==="true"'));
  assert.ok(plans.includes('window.location.hostname'));
  assert.ok(plans.includes('SAMPLE ONLY · Not this shop\'s subscription'));
  assert.ok(plans.includes('data-testid="sample-subscription-countdown"'));
  assert.ok(plans.includes('"verified-plan-clock"'));
  assert.ok(plans.includes('data-testid="subscription-expiry-unverified"'));
  assert.ok(plans.includes("Expiry does not automatically suspend the shop."));
  assert.ok(plans.includes("later, separately approved backend phase"));
});

test("P3 final: shop-scoped pickup read does not coerce unknown settlement facts",()=>{
  const pay=readFileSync(new URL("../src/components/PaymentHistory.tsx",import.meta.url),"utf8");
  assert.ok(pay.includes("shopId: string | number;"));
  assert.ok(pay.includes("String(currentShop.id)===String(shopId)"));
  assert.ok(pay.includes("String(order.shop_id)===String(shopId)"));
  assert.ok(pay.includes('order.delivery_type==="collection"'));
  assert.ok(pay.includes('aria-label="Payment sections"'));
  assert.ok(!pay.includes('role="tab"'));
  assert.ok(!pay.includes('role="tabpanel"'));
  assert.ok(!pay.includes("Mark Settled"));
});

test("P3 final release: no plan or pickup payment label without authenticated current-shop ownership",()=>{
  const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
  const pay=readFileSync(new URL("../src/components/PaymentHistory.tsx",import.meta.url),"utf8");
  const plans=readFileSync(new URL("../src/components/MerchantSubscriptionPlans.tsx",import.meta.url),"utf8");
  assert.ok(app.includes('shopVerified={merchantShopGate.status==="ready"'));
  assert.ok(app.includes('currentShop.owner_id===user.id'));
  assert.ok(app.includes('&& !!user?.id'));
  assert.ok(pay.includes("shopVerified=false"));
  assert.ok(pay.includes("const verified=shopVerified && ordersVerified"));
  assert.ok(pay.includes('verified={shopVerified && !!currentShop'));
  assert.ok(plans.includes('planFromVerifiedShop(verified?shop:undefined)'));
  assert.ok(plans.includes('Owned shop not yet verified'));
});

test("P3 final UI: Free is an introductory mode, not something a merchant needs to purchase",()=>{
  const plans=readFileSync(new URL("../src/components/MerchantSubscriptionPlans.tsx",import.meta.url),"utf8");
  assert.ok(plans.includes('plan.id==="free"?"Introductory offer · launch date pending":"Not available for purchase yet"'));
  assert.ok(plans.includes('text-xs text-on-surface-variant leading-5'));
  assert.ok(plans.includes('min-h-10 rounded-lg'));
  assert.ok(plans.includes('grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'));
});

test("Settings S1: eliminate client-side PAN/CVV capture, fake vault confirmation and storage",()=>{
  const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
  const helper=readFileSync(new URL("../src/services/legacyBillingSafety.ts",import.meta.url),"utf8");
  for(const unsafe of [
    "billingDetails","setBillingDetails","selectedInvoice","setSelectedInvoice",
    'localStorage.getItem("localeats_billing_details")',
    'localStorage.setItem("localeats_billing_details"',
    "cardholderName: string","cardNumber: string","cvv: string",
    "Securely Link Card","Card linked securely to Yoco vault",
    "PCI-DSS Secure","Yoco/Peach tokenization vault"
  ])assert.ok(!app.includes(unsafe),"Unsafe legacy billing code still mounted: "+unsafe);
  assert.ok(app.includes("purgeLegacyBillingDraft()"));
  assert.ok(helper.includes('window.localStorage.removeItem("localeats_billing_details")'));
  for(const unsafe of ["getItem(","setItem(","JSON.parse(","console.","fetch(","supabase.","MerchantApi."])
    assert.ok(!helper.includes(unsafe),"Never read, forward or log legacy card data: "+unsafe);
  assert.ok(helper.includes("return false;"));
  assert.ok(app.includes("legacyBillingCleanupFailed&&("));
  assert.ok(app.includes("This browser blocked automatic removal"));
});

test("Settings S1: subscription UI follows approved plans and fails closed without owned shop",()=>{
  const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
  assert.ok(app.includes('settingsCategory === "billing"'));
  assert.ok(app.includes("<MerchantSubscriptionPlans"));
  assert.ok(app.includes('verified={merchantShopGate.status==="ready"'));
  assert.ok(app.includes("currentShop?.owner_id===user.id"));
  assert.ok(app.includes("&& !!user?.id"));
  assert.ok(app.includes('setActiveTab("payments")'));
  assert.ok(app.includes("No verified subscription invoices available"));
  assert.ok(app.includes("No card linking or recurring subscription payments are available yet"));
  for(const fabricated of [
    "100% Lifetime Discount","permanent 50% discount",
    "LocalEats Lite","LocalEats Growth",
    "Early Partner Plan","INV-2026-003",
    "INV-2026-002","INV-2026-001",
    "Paid in full. Your card ending in","Invoice Receipt"
  ])assert.ok(!app.includes(fabricated),"No invented billing/discount claims: "+fabricated);
});

test("Settings S1: inactive bank-payout status is honest; the remaining Settings tabs stay intact",()=>{
  const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
  assert.ok(app.includes("Bank payouts aren't active for the pickup-first pilot."));
  assert.ok(app.includes("Not active"));
  assert.ok(!app.includes("Manage your bank account for weekly payouts."));
  for(const id of ["account","storefront","operations","preferences"])
    assert.ok(app.includes(`id: "${id}"`),"Missing essential Settings category: "+id);
  for(const id of ["delivery","hardware","billing","diagnostics"])
    assert.ok(app.includes(`settingsCategory === "${id}"`),"Future Settings source must remain available: "+id);
  assert.ok(app.includes('settingsCategory === "preferences"'));
  assert.ok(app.includes('settingsCategory === "storefront"'));
  assert.ok(app.includes('settingsCategory === "account"'));
});

test("Settings S2 shows four owner-friendly categories only, with safe accessible navigation",()=>{
  const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
  const start=app.indexOf('<nav aria-label="Merchant settings sections"');
  const end=app.indexOf('].map(category => {',start);
  assert.ok(start>=0 && end>start,"Settings section navigation is present");
  const nav=app.slice(start,end);
  const ids=[...nav.matchAll(/\{ id: "([^"]+)", label: "([^"]+)"/g)]
    .map(m=>[m[1],m[2]]);
  assert.deepEqual(ids,[
    ["storefront","My Shop"],
    ["operations","Opening Hours"],
    ["preferences","Notifications & Appearance"],
    ["account","My Account"],
  ]);
  assert.ok(app.includes('useState<string>("storefront")'));
  assert.ok(app.includes('aria-current={selected ? "page" : undefined}'));
  assert.ok(app.includes('min-h-14 px-3 py-2.5'));
  for(const hidden of ["Delivery","Printing & Hardware","Database Diagnostics","Billing & Subscription","Account & Staff"]){
    assert.ok(!nav.includes('label: "'+hidden+'"'),"Hidden feature appears in navigation: "+hidden);
  }
});

test("Settings S2 keeps future modules dormant rather than deleting source or allowing access via nav",()=>{
  const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
  assert.ok(app.includes('settingsCategory === "future-operations"'));
  assert.ok(app.includes('settingsCategory === "future-staff"'));
  assert.ok(app.includes('settingsCategory === "future-riders"'));
  assert.ok(app.includes('settingsCategory === "future-banking"'));
  assert.ok(app.includes('settingsCategory === "delivery"'));
  assert.ok(app.includes('settingsCategory === "hardware"'));
  assert.ok(app.includes('settingsCategory === "diagnostics"'));
  assert.ok(app.includes('settingsCategory === "billing"'));
  assert.ok(app.includes('settingsCategory === "operations" && (\n                      <SimpleOpeningHours'));
  assert.ok(app.includes('settingsCategory === "account" && ('));
  assert.ok(app.includes("App Walkthrough Tour"));
  assert.ok(app.includes("Payments & Plans"));
  assert.ok(app.includes('currentShop?.owner_id===user.id'));
  assert.ok(app.includes("Shop information is being verified."));
  assert.ok(app.includes("Change your shop name, photos and address in Storefront Profile."));
  const storefront=app.slice(app.indexOf('settingsCategory === "storefront" && ('),app.indexOf('settingsCategory === "account" && (',app.indexOf('settingsCategory === "storefront" && (')));
  assert.ok(!storefront.includes("<LocationSyncIndicator"),"Technical GPS sync controls should not clutter owner Settings");
  assert.ok(app.includes('onClick={()=>setActiveTab("payments")}'));
  assert.ok(app.includes("Sound Alerts") && app.includes("Push Notifications") && app.includes("Dark Mode"));
  assert.ok(app.includes("Sign Out"));
});

test("Settings S2 opening-hours overview cannot claim a fake save or send direct database writes",()=>{
  const view=readFileSync(new URL("../src/components/SimpleOpeningHours.tsx",import.meta.url),"utf8");
  const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
  assert.ok(view.includes('data-testid="settings-s2-opening-hours"'));
  assert.ok(view.includes('verified && !!shop'));
  assert.ok(view.includes('typeof shop?.is_active==="boolean"'));
  assert.ok(view.includes("It does not mean that real customer ordering has been activated."));
  assert.ok(view.includes("The old hours form did not save to the verified shop schedule."));
  assert.ok(view.includes("No hours or shop status will be changed from this page."));
  assert.ok(view.includes("Shop status cannot be confirmed until your authenticated shop profile is verified."));
  assert.ok(app.includes('currentShop?.owner_id===user.id'));
  assert.ok(app.includes('verified={merchantShopGate.status==="ready"'));
  assert.ok(app.includes('currentShop?.owner_id===user.id'));
  for(const prohibited of ["supabase","MerchantApi.","fetch(","localStorage.","setItem(","window.print(","onChange=","<input",">Save Hours<"]){
    assert.ok(!view.includes(prohibited),"Read-only overview cannot mutate shop data: "+prohibited);
  }
});

test("Settings icon polish: four recognisable icons, consistent tiles, visible selected state",()=>{
  const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
  const begin=app.indexOf('<nav aria-label="Merchant settings sections"');
  const end=app.indexOf('});',begin);
  const nav=app.slice(begin,end>begin?end:begin+3500);
  for(const [section,icon] of [
    ["storefront","Store"],["operations","CalendarClock"],
    ["preferences","BellRing"],["account","UserRound"]
  ]){
    assert.ok(nav.includes(`id: "${section}"`) && nav.includes(`icon: ${icon}`),
      "Section icon mismatch: "+section+" => "+icon);
  }
  assert.ok(nav.includes('"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl'));
  assert.ok(nav.includes('size={21} strokeWidth={2.2}'));
  assert.ok(nav.includes('selected ? "bg-white/20 text-on-primary" : category.iconTone'));
  assert.ok(nav.includes('aria-current={selected ? "page" : undefined}'));
  assert.ok(nav.includes('focus-visible:outline'));
  assert.ok(nav.includes('min-h-14'));
  assert.ok(!nav.includes("animate-spin"),"Do not endlessly animate nav icons");
});

test("Settings icon polish: sound and push have distinct descriptive icons",()=>{
  const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
  const prefs=app.slice(app.indexOf('settingsCategory === "preferences" && ('),app.indexOf('settingsCategory === "account" && (',app.indexOf('settingsCategory === "preferences" && (')));
  const sound=prefs.slice(prefs.indexOf('Sound Alerts')-370,prefs.indexOf('Sound Alerts')+60);
  const push=prefs.slice(prefs.indexOf('Push Notifications')-370,prefs.indexOf('Push Notifications')+60);
  assert.ok(sound.includes('<Volume2 size={21} strokeWidth={2.2}'));
  assert.ok(push.includes('<BellRing size={21} strokeWidth={2.2}'));
  assert.ok(!sound.includes('<ArrowRight size={20}'));
  assert.ok(!push.includes('<ArrowRight size={20}'));
  assert.ok(prefs.includes("darkMode ? <Moon size={21}"));
  assert.ok(prefs.includes("<Sun size={21}"));
  assert.ok(prefs.includes("setSoundAlerts(nextState)"));
  assert.ok(prefs.includes("requestPushPermissions("));
  assert.ok(prefs.includes("setDarkMode(!darkMode)"));
});

test("Settings icon polish: opening-hours symbols match navigation, no behavior changes",()=>{
  const view=readFileSync(new URL("../src/components/SimpleOpeningHours.tsx",import.meta.url),"utf8");
  assert.ok(view.includes('<CalendarClock size={21} strokeWidth={2.2}'));
  assert.ok(view.includes('<Store size={21} strokeWidth={2.2}'));
  assert.ok(view.includes('verified && !!shop'));
  assert.ok(!view.includes("supabase."));
  assert.ok(!view.includes("fetch("));
  assert.ok(!view.includes("onChange="));
});
