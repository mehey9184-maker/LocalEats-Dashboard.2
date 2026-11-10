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
