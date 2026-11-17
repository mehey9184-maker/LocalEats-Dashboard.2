# LocalEats pickup — two-party collection contract (DESIGN REVIEW ONLY)

Status: Product behavior approved 2026-11-17; **NO schema or API changes authorized for Production**.
Tracks [Merchant/API #163](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/issues/163) and [Customer #101](https://github.com/mehey9184-maker/LocalEats-app/issues/101).
Owner's selected model: customer confirms receipt of physical food; merchant separately confirms real payment and physical handover; server closes the pickup only after all required proofs.

## 1. Verified current implementation

- The current reviewed SQL draft (supabase/drafts/pickup_launch_foundation.sql) has statuses pending, preparing, ready_for_pickup, collected, cancelled and a separate payment_status unpaid/paid.
- The current server command path (localeats-api/src/orders/pickupService.ts) runs pickup_order_command with authenticated user ID, UUID command ID, expected revision and idempotency validation.
- The current SQL function accepts merchant collect after paid and a merchant handover_confirmed=true. **It does not require customer confirmation.** Do not label that legacy collect path as two-party completion.
- pickup_order_events currently limits kind to created, accepted, ready, merchant_rejected, customer_cancelled, payment_confirmed, collected. Unique(order_id,kind) means each kind occurs only once; unique(order_id,revision) and unique(order_id,command_id) also apply.
- pickup_push_outbox currently attaches to pickup_order_events, and only the ready action queues customer-device push. Customer's worker currently supports pickup_ready.
- The Customer tracker can display Ready, but has no authorized customer receipt action. The Merchant UI has separate payment confirmation and Food handed over → Collected.
- Production order-write and payment activation remain behind the existing gates. This document proposes changes; none are applied.

## 2. Product-visible stages and precise meanings

1. Order created by authoritative API → Pending. Notify merchant as a hint; shop inbox is canonical.
2. Merchant accepts → Preparing (or rejects → Cancelled with a reason/support path). Customer status must update from verified API, not the push payload.
3. Merchant marks Ready → Ready for pickup. Customer receives a push hint and an accessible one-time ready sheet when a verified order has entered Ready.
4. Customer presses Got it → **acknowledges the Ready message ONLY**. This does not authorize any order mutation, paid status, food receipt, or collection.
5. Customer chooses I know the shop (back to tracking) or Get directions. Direction destination is a verified shop coordinate/address; never trust coordinates, URL, or shop IDs in an unverified push.
6. At the physical counter, merchant records actual cash/card-machine payment; merchant records food physically handed over. Customer presses I received my food only AFTER possession. These are three separate server-verified facts; actions may reach server in any order after Ready.
7. Only after all three facts exist can the API atomically persist Collected. Otherwise retain Ready and show truthful pending confirmations.
8. Confirmed collection updates both apps from API; optional push is only a wake-up hint. Rewards, if enabled in a separately approved phase, may read final paid+collected ledger facts, not notifications.

## 3. Proposed authorization and event contract

Proposed names are NOT deployed schema.

| Action/event | Actor allowed | Required state | Effect |
|---|---|---|---|
| customer_ready_acknowledged | Customer browser only | Verified Ready notification | Dismisses sheet; local per-order presentation state only, **never** collected |
| payment_confirmed | Authenticated shop owner, same order/shop | Ready, actual cash/card terminal payment | Existing server-authoritative paid event |
| customer_receipt_confirmed | Authenticated order customer ONLY | Ready, explicit confirmation of physical food receipt | Add immutable proof event, not Collected by itself |
| merchant_handover_confirmed | Authenticated owner of the order's shop ONLY | Ready, explicit handover confirmation | Add immutable proof event, not Collected by itself |
| collected | Server only, during completion transaction | All three verified facts persisted | Persist Collected exactly once; emit final event |
| support_collection_exception | Approved independent privileged support workflow ONLY | Dead phone/disputed handover; documented evidence and audit | Separate exceptional state/proof review; **never** forge customer event or silently allow merchant override |

- Suggest authenticated endpoint POST /api/v1/orders/:id/confirm-receipt for customer actor; POST /api/v1/merchant/orders/:id/confirm-handover for merchant actor. The existing merchant payment endpoint stays distinct and unchanged unless reviewed.
- Each command needs a server-verified Firebase UID, authorized order relation, command UUID, expected revision, body allowlist and semantic request hash. No browser-supplied actor UID, paid flag, trusted timestamp, status or financial totals.
- Enforce proof uniqueness per order + event kind. Duplicate same command ID and semantic hash is idempotent; conflicting replay is 409. Stale expected revision yields refresh/retry using original persisted command ID where safe.
- Persist receipt/handover proof and evaluate finalization in **one database transaction with order row lock**. The last arriving proof must not cause a double Collected event or lose an event revision. If inserting the final proof and Collected in the same transaction, allocate distinct monotonically increasing revisions and a server actor marker for the final event.
- Customer receipt without payment/handover remains Ready. Payment+merchant handover without customer receipt remains Ready. Only payment+handover+customer receipt yields Collected.
- Cancelled/rejected orders reject all new receipt/handover/payment commands. No approval of in-browser direct database writes.

## 4. Database migration design (not executable in this PR)

The current SQL draft must not be changed in place without a new reviewed migration:
- Extend event-kind constraint for customer_receipt_confirmed and merchant_handover_confirmed while retaining prior values; update event-recipient constraint if new notification kinds require recipients. Do not loosen actor or service-role privileges.
- Preserve unique(order_id,kind), (order_id,revision) and command-ID idempotency. The current event + command function treats collect as unilateral merchant action and must be explicitly retired/gated for genuine pickup records before enabling the new workflow.
- Consider a dedicated append-only proof table if extending event constraints would break existing queue semantics. Any design must prove schema compatibility and independently verified restore on a disposable database.
- Keep outbox queue and notification delivery separate from state transitions; a Firebase 202 or user clicking Got it must never cause state transition. Existing outbox is ready-only; supporting accepted, rejected and collected to customer, plus merchant collection-completed alert, needs explicit per-recipient routing, uniqueness, retry, and owner permissions.
- No customer UID, name, phone, payment information or precise location in public FCM payloads. An opaque event discriminator may wake the app; app then reads an authorized, up-to-date order.
- Include forwards-only/rollback strategies without erasing immutable proofs; never delete real collection evidence on rollback.

## 5. Application UX contract

Customer (preserve existing ShopCard, checkout, menus, typography):
- On verified Ready, display an accessible dismissible notice: Your order is ready for pickup. Buttons: Got it, I know the shop, Get directions.
- Got it must suppress duplicate sheet display by order ID in account-scoped presentation state and remain accessible from the tracker after closing. This state does NOT require a financial/order mutation.
- I received my food is a separate, explicit action at the physical handover, with a confirmation prompt that explains receipt is final evidence.
- When only customer receipt exists, show Awaiting shop payment/handover verification; never show Collected prematurely.
- Get directions uses verified shop coordinates or safely encoded verified address. With missing coordinates, show address/contact and do not fabricate a Google Maps destination. Ask current location permission only on a user navigation action.

Merchant:
- Keep Accept, Reject, Mark Ready and Confirm actual payment.
- Replace Food handed over → Collected with Confirm handover. Show Awaiting customer confirmation if receipt proof is missing. Never allow a merchant-only Collected override.
- Merchant inbox remains authoritative even if FCM misses; new order alert, accepted/ready statuses, customer receipt and final collection are correlated to server-authoritative order IDs.
- Use separate status and payment indicators. Zero payment should not automatically imply paid; no additional charge initiation.

## 6. Dead phone, no-show, offline, dispute and fraud

- Offline customer/merchant confirmation: preserve command ID with safe retry, refresh prior to showing success; no unconfirmed optimistic Collected.
- No-phone situation: show Awaiting customer confirmation and provide a separate privileged support-review request. Support must verify appropriate evidence and log independent approval, reason, approver, timestamp, order revision. It must **not** generate a fabricated customer receipt event.
- Disputes: do not silently change paid/collected facts; create an auditable exception with support resolution and no forged signatures.
- No-show: merchant can see Ready waiting age and contact customer if authorized; do not collect/pay automatically, do not count as completed revenue.
- Prevent a different signed-in customer or shop from confirming. Reject replay across accounts/shops and late requests after cancellation.
- Backstop mobile/Windows notification denials with visible authenticated order status on app focus/online and polling, never reliance on FCM alone.

## 7. Isolated test matrix / launch gate

| Scenario | Expected |
|---|---|
| Got it after Ready | Notice dismissed; still Ready/unpaid or actual paid |
| Customer receipt only | Ready; no collected event |
| Merchant handover only | Ready; no collected event |
| Payment + handover only | Ready; awaits customer |
| Customer receipt + payment only | Ready; awaits handover |
| All three in any arrival order | Exactly one Collected, correct event revisions |
| Duplicate same command | Same receipt, no extra event |
| Changed body or actor with same command | Idempotency conflict |
| Forged customer or different shop | 403, no state mutation |
| Rejected/cancelled/unready order | 409, no payment/handover/collection |
| Parallel confirmations | Serialized, no lost proof or double completion |
| Client disconnected/retry after 30m | Accurate server state, original command semantics preserved |
| Windows notifications denied; PWA closed | Inbox status still correct on reconnect |
| Customer phone unavailable | Audited support path; no fabricated receipt |
| Rewards | Read final server-paid + collected facts only, never push/notice |
| Direct browser DB write | Denied under reviewed rules |
| Real order/payments feature flags off | No real writes during Preview validation |

## 8. Explicit delivery gates

- Phase A Customer browser push diagnostics: draft PR only; owner tests the Preview. No actual Firebase customer test message or order required.
- Phase B1 (this document): review product/security contract, agree DB migration + privileged exception model before writing executable schema.
- Phase B2: develop against disposable isolated staging and synthetic orders only; test API and both UIs together. No production database, Firebase rules, Customer/Merchant main merge or real order activation.
- Phase B3: explicit owner go-live signoff only after CI, isolated manual end-to-end payment/receipt/collection, encrypted backup + independently verified restore, rollback and support procedures.
