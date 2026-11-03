import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {merchantReceiptLineAmount} from "../src/services/merchantOrdersTrust.ts";

const orders=readFileSync(new URL("../src/components/OrdersManagement.tsx",import.meta.url),"utf8");
const alerts=readFileSync(new URL("../src/components/DispatchAlertModal.tsx",import.meta.url),"utf8");

test("item receipt lines never reuse the order total when unit price is missing",()=>{
  assert.equal(merchantReceiptLineAmount(12.5,2),"R 25.00");
  assert.equal(merchantReceiptLineAmount(0,1),"R 0.00");
  for(const [price,qty] of [[null,1],[undefined,3],[-4,1],[4,0],[8,1.3],[8,Infinity],["",1],[NaN,1]]) {
    assert.equal(merchantReceiptLineAmount(price,qty),"Amount unavailable");
  }
  assert.equal((orders.match(/safeReceiptHtml\(merchantReceiptLineAmount\(p, q\)\)/g)||[]).length,2);
  assert.match(orders,/merchantReceiptLineAmount\(price, quantity\)/);
  assert.match(orders,/merchantReceiptLineAmount\(p, q\)/);
  assert.doesNotMatch(orders,/Number\(order\.total_price\) \|\| 0/);
  assert.doesNotMatch(orders,/R\{Number\(printingOrder\.total_price \|\| 0\)\.toFixed\(2\)\}/);
});

test("embedded order chat is not a direct browser database access path",()=>{
  const chat=orders.slice(orders.indexOf("const ChatWindow"),orders.indexOf("export const OrdersManagement"));
  assert.match(chat,/In-app chat is unavailable in this Preview/);
  assert.match(chat,/verified order-participant API/);
  assert.doesNotMatch(chat,/supabase|chat_messages|OrderService|subscribeWithAuthGuard|onSubmit=/);
});

test("rider ratings, pairing shortcuts and delivery PIN do not bypass server workflow",()=>{
  assert.match(orders,/Rider rating is unavailable until the authorized API supports saving it/);
  assert.doesNotMatch(orders,/OrderService\.rateRider\(|submitRiderRating\(/);
  assert.doesNotMatch(orders,/NoLinkedRiderModal|LOCAL-EATS-PASS/);
  assert.doesNotMatch(orders,/PIN: \{order\.delivery_pin\}/);
  assert.match(orders,/onTabChange\("riders"\)/);
  assert.match(orders,/Device delivery is not guaranteed|device delivery is not guaranteed/);
});

test("manual message composer cannot forge delivery or expose customer data through QR service",()=>{
  assert.doesNotMatch(alerts,/qrserver\.com|Total to Collect|R\$\{amount\}|123456|25-35/);
  assert.doesNotMatch(alerts,/localStorage\.setItem|localStorage\.getItem|saveQueuedAlerts|getQueuedAlerts/);
  assert.match(alerts,/QR sharing unavailable in this Preview/);
  assert.match(alerts,/Recorded order status:/);
  assert.match(alerts,/Recorded order total:/);
  assert.match(alerts,/This message does not assign an order or disclose customer information/);
  assert.match(alerts,/Draft saved in this tab only. Nothing has been sent/);
  assert.match(alerts,/SMS charges may apply/);
  assert.doesNotMatch(alerts,/Message dispatched via Native Share/);
});

test("a second order opens with fresh recipient, message and no stale customer text",()=>{
  assert.match(alerts,/const previousComposerScope = useRef<string \| null>\(null\)/);
  assert.match(alerts,/if \(previousComposerScope\.current === scope\) return/);
  assert.match(alerts,/setRecipientType\(nextRecipient\)/);
  assert.match(alerts,/setMessageText\(generateTemplateText\(nextRecipient\)\)/);
  assert.match(alerts,/setCustomPhone\\(\\"\\"\\)/);
  assert.match(alerts,/^\s*const handleCopyText = async \(\) => \{/m);
  assert.match(alerts,/await navigator\.clipboard\.writeText\(messageText\)/);
});
