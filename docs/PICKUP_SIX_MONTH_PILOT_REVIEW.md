# Six-month pickup pilot review

## Scope and evidence

The approved pilot uses 2,500 fictional orders, 25 fictional customers and 25 fictional merchants across 181 virtual days, from 11 November 2026 through 10 May 2027. This is an accelerated calendar simulation. All dates, account identities, order choices, notification failures and payments in the simulation are test inputs.

The volume run invokes the compiled pickup pricing, create and command services with a memory-backed repository and RPC fixture. It does not measure production capacity, Firebase delivery, real customer satisfaction or human behaviour. The chosen cancellation, rejection and no-show frequencies are scenario assumptions. Weekend traffic has twice the allocation weight of weekdays. That produced 10 to 22 orders per virtual day across all shops.

The separate PostgreSQL walkthrough uses actual Express routes, Customer and Merchant client adapters, reviewed SQL functions, database triggers and synthetic identities. It proves the transaction and receipt contracts independently of the memory model. It covers both cash and card-machine payments, including selecting cash at checkout and confirming an actual card-machine payment at the counter.

The browser walkthrough renders the actual pickup tracking, Customer history and shared Merchant action components at 320 and 390 px. Its network and Merchant adapter are controlled test fixtures. It verifies visible state, confirmation dialogs, original-command retry, keyboard receipt expansion and receipt-read recovery. Actual Merchant adapter replay and receipt validation have separate tests.

The walkthrough screenshots and local runners are saved in the Codex workspace. The reproducible volume test and PostgreSQL assertions are committed with this report.

## Results

- 2,500 unique order IDs and 2,500 merchant inbox entries.
- 2,125 collected orders, including 1,115 cash and 1,010 card-terminal handovers.
- 125 Customer cancellations, 125 Merchant rejections and 125 Ready orders left unpaid.
- 166 payment-method changes at the counter and 304 deliberately late collections.
- 278 duplicate checkout attempts reused the existing order.
- 225 order submissions recovered after injected failures, including 147 lost committed responses and 83 precommit failures. These categories can overlap within the same recovered submission.
- 73 payment and 93 handover confirmations recovered after deliberately lost committed acknowledgments. Replays retained the original command and did not duplicate payment or collection events.
- 3,125 forbidden cross-account operations and 2,250 invalid handover attempts were rejected.
- 204 Ready pushes were deliberately marked undelivered by the fixture. The authorized inbox retained the corresponding updates. This number describes injected failures and provides no delivery-rate estimate.
- All memory fixtures were cleared. The separate disposable loopback PostgreSQL cluster was stopped and removed. No cloud accounts, real payments, business data or notification sends were created.

The existing 90-day and 180-day scenarios also pass after extending the test. The simulation fixture's Merchant rejection result was corrected to cancelled, matching the actual SQL transition and merchant_rejected event.

## Customer concerns and changes

### “I selected cash, but paid by card. Where is my receipt?”

Order History previously showed a total and completion status without the confirmed payment facts. Collected pickup cards now have View pickup receipt. Opening it makes an authenticated order-detail read. Amount and method come from the payment_confirmed event, and collection time comes from the collected event.

The receipt checks the order, account, shop and revision before displaying facts. A failed read offers Retry receipt. Changing account or order discards the old request. Legacy or incomplete evidence displays unavailable details instead of manufacturing a receipt.

### “The order finished, but I cannot tell when I collected it.”

The receipt now shows the recorded collection timestamp. It uses the device's locale and timezone for display and retains the server timestamp in the time element.

### “I missed the Ready alert.”

The existing 12-minute in-app Ready reminder, ten-minute snooze and opt-in new-shop alerts within 4 km remain unchanged. The volume fixture exercises a persistent inbox despite notification failure. Background cloud delivery still needs the separately authorized device test after staging login has been verified.

## Shop Owner concerns and changes

### “The customer paid. What must I do next?”

Paid Ready orders now show Paid · Awaiting handover. Confirm handover is the primary action. The existing explicit physical-handover confirmation remains required. The server still requires payment before collection.

### “The connection dropped. Do I confirm the handover again?”

An unresolved handover shows Retry handover confirmation and a message explaining that it checks the original confirmation. The saved, account-scoped command is replayed. New handover actions remain unavailable until that outcome is resolved. Recovery remains reachable on the completed-board card if a refreshed server state already moved the order out of Ready.

### “The order is in the board, but its pickup action is disabled.”

The fallback Pending, Preparing and Ready board lanes used legacy action controls for pickup cards. Those collection cards now use the existing shared PickupOrderActions, including the original activation and authenticated-command gates.

## Verification status

Customer receipt tests cover authenticated transport, payment-method changes, missing proof, invalid amounts and cross-account/order/shop/revision rejection. Merchant tests cover the paid Ready state, disabled activation and receipt-validated replay after lost response.

- Customer regression suite passed all 136 tests after the history follow-up. Customer TypeScript passed.
- Merchant root regression suite passed all 141 tests after the unpaid follow-up.
- Complete API regression suite passed all 231 tests with localhost access.
- The 90-day, 180-day and 2,500-order volume tests all passed.
- Customer and Merchant production-style builds passed with pickup ordering disabled.
- The real PostgreSQL journey passed the cash and card-machine receipt assertions, duplicate-order protection, cross-account checks, independent payment and handover, refresh and history.
- The component browser journey passed at 320 and 390 px, including receipt retry, keyboard expansion, original-command handover recovery and absence of horizontal overflow.
- A separate history browser journey loaded all 101 orders, retried a failed page, rejected a foreign-account page and discarded a pending response after switching accounts.

Merchant TypeScript still reports the same 50 diagnostics as its base after normalizing workspace paths and moved line numbers. Merchant ESLint reports 191 errors and 22 warnings, compared with 192 errors and 22 warnings on the base. A green Vite build does not establish clean typechecking.

Browser screenshots preserve the fixture receipt and the two Merchant states. [Customer receipt](pickup-pilot-evidence/customer-receipt-320.png), [paid and awaiting handover](pickup-pilot-evidence/merchant-paid-320.png), [unconfirmed handover recovery](pickup-pilot-evidence/merchant-retry-320.png).

The follow-up screenshots show [the oldest history card after paging](pickup-pilot-evidence/older-history-320.png) and [the expanded unpaid pickup guidance](pickup-pilot-evidence/merchant-follow-up-320.png).

## Further improvements

1. Customer history pagination is implemented in the follow-up changes. Load older orders reads authenticated 50-row pages using timestamp and ID. HTTP tests cover 101 owned orders, identical timestamps, a newer order arriving during paging, invalid cursors and foreign accounts. The endpoint filters to collection orders before applying its limit. The Customer retains the cursor from its unfiltered recent feed, so a recent feed containing delivery records can still reach older pickups. The browser covers 49 recent pickups with a legacy row, a recent feed containing only legacy rows, failed reads, retry, duplicate prevention and switching accounts while a page is pending. The history API must deploy before the updated Customer, otherwise older-history reads offer recovery.
2. Unpaid Ready follow-up is implemented in the follow-up changes. Compact and expanded tickets expose the 30-minute last-update advisory and optional check-then-call guidance. Paid, collected, fake and missing-time orders cannot trigger that advisory. Calls are offered only for validated phone values on actual collection orders. Follow-up guidance is advisory while payment and collection remain server-confirmed actions.
3. Consider an optional Customer receipt acknowledgment for disputes. Merchant handover remains the current authoritative completion action. This pilot does not add a mandatory Customer confirmation.
4. Verify genuine staging authentication, session restoration, device-token ownership and minimized-Chrome notification delivery before a physical shop pilot. Real Firebase delivery and till reconciliation require separate evidence.
5. Run a separately scoped peak-load test if needed. Twenty-two daily orders distributed across 25 shops is a resilience scenario, not peak kitchen throughput.

## Release state

Customer receipt and Merchant handover changes remain separate draft branches. Existing install/icon and Firebase staging drafts are preserved. Ordering, payments, Production, database schemas and cloud notification sending remain under their existing approval gates.
