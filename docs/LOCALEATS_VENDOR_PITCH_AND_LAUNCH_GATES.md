# LocalEats — Vendor Pitch Readiness vs Public Launch

**As of:** 2026-11-23 (Africa/Johannesburg)
**Purpose:** Help founder start honest vendor conversations while the technical worker finishes safe pickup launch readiness. **Not a production release authorization or a claim of currently working real orders.**
**Evidence basis:** Connected GitHub checks at Merchant/API draft [#222](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/222), Customer Cloudflare draft [#140](https://github.com/mehey9184-maker/LocalEats-app/pull/140), Super-LocalAdmin [#5](https://github.com/mehey9184-maker/Super-LocalAdmin/pull/5), live Cloudflare CF1 Worker **read-only** binding inspection, current CF2-E local backup HOLD and canonical [Project Memory](LOCALEATS_PROJECT_MEMORY.md).

## CEO readiness estimates (judgmental; not a mathematically observed test score)

| Goal | Working estimate | Honest interpretation |
|---|---:|---|
| **Ready to start vendor pitches / interest gathering** | **75%** | Product concept, customer/merchant interfaces, pickup-only plan and security architecture can be explained and demonstrated where available. A reliable real-phone scripted demo, polished one-page merchant offer and verified live path remain open. The founder may start relationship-building now, **without promising live ordering**. |
| **Ready for real public customer orders** | **50%** | Substantial frontends, design, source-level API contracts and synthetic acceptance exist. **Actual Cloudflare catalogue/checkout API migration, production hosting/DNS, real location, real pickup, push and end-to-end release acceptance are not complete**. A source test PASS does not imply a production order works. |

These percentages are **qualitative milestone planning estimates**, not measured completion of every feature or evidence of an accessible demo. Revise them when new real-world and deployment evidence is available. Do not present numerical readiness percentages to vendors as a reliability SLA.

## What the founder may safely do with vendors now

Start **exploratory meetings** with a narrow pilot offer, explaining that LocalEats is preparing a pickup-first food ordering marketplace in the first local service area. Invite a few willing shop owners to preview the concept, review what their menu could look like and register interest **without claiming a live onboarding/order flow**. The app must not be used for live payments, live orders or unauthorised data capture while the production release gate is closed.

Sample truthful, short discussion:

> “LocalEats is building a simple way for nearby customers to discover your food and prepare pickup orders. We're starting with a small local pilot, and I'm looking for a few vendors who want to help test whether it saves time and brings more orders. The customer and shop dashboard experiences are developed, but public ordering is not live yet. Would you like to see the prototype and tell me how you currently handle orders?”

Avoid claiming a confirmed launch date, number of customers, measured extra sales, working real-time AI, rewards payout, paid discounts or fully approved production integration. Do not quote merchant subscription prices or promotional durations as signed contractual terms until the founder finalizes the commercial offer and legal/operational conditions.

## Minimum viable vendor-pitch demonstration (NO real orders)

1. **Customer side:** Open a safe preview/prototype where available, show approved shop discovery, a visible sample menu and pickup concept; identify any sample data unmistakably as **TEST**. Never pretend the production domain is order-enabled.
2. **Merchant side:** Show original Merchant Dashboard screen layouts and menu/order management **using fake/test content only**. A screenshots/prototype deck is acceptable if the hosted demo is unavailable; do not claim it is a functional production session.
3. **Admin trust:** Explain that shops require approval, pending/archived shops are not public, and merchant/customer records must remain private.
4. **Pickup economics:** Customer pays at shop in the pilot. Merchant commercial terms and any later subscription/free-period details must be documented and approved before signing commitments.
5. **Vendor discovery:** Ask about current order channels, busiest hours, phone access, menu update frequency, acceptance times, pain points and willingness to join a **future pilot**. Only collect contact details with permission and an appropriate privacy notice; do not import real details into isolated synthetic fixtures.
6. **Call to action:** Ask for **interest/permission to follow up**, not a public-ordering signup until real production acceptance.

## Engineer-controlled launch gates (priority order)

| Gate | Current observed state | Required before real orders | Owner |
|---|---|---|---|
| **Safe shop/menu data read** | CF2-B/C/D/E source and disposable CI green; CF2-E hosted permission change **HOLD** because backup not restorable/verified | Secure **current** staging backup and disposable restore, then approved staging-only SQL/postflight, separately approved restricted credential and isolated Cloudflare catalogue connection | AI executes safe steps; founder authorizes hosted changes |
| **Customer + Merchant live hosting** | Static Cloudflare packaging in draft PRs; CF1 deployed API is a 503/denied bootstrap, not a usable ordering backend | Confirm browser/app domain, origin, CORS and API runtime end-to-end in a separately approved staging deployment, then Production promotion under founder approval | AI prepares; founder release approval |
| **Secure real orders** | Server-side pickup security contracts/synthetic tests exist, write flags remain false | Live server-side pricing/idempotency/auth ownership, real checkout → Merchant Accept/Ready → pickup/payment-at-shop with recovery and rollback | AI prepares; consenting human final acceptance |
| **Notifications and availability** | Earlier Windows Chrome push test successes; full live mobile FCM and customer notifications unverified | Verify merchant alert and customer Ready notifications on actual devices, missed-order timeout/retry behavior, and real shop opening/override state | AI + consenting user/device participant |
| **Mobile trust / GPS / data costs** | Historical real GPS timeout/permission issues; responsive layout tests in CI; real device acceptance incomplete | Real phone GPS on mobile data, out-of-4km browse-only, 320/390px clickable UI, install invitation, offline/stale-price guard | Human phone acceptance plus AI |
| **Operational recovery** | Current hosted staging restore point not verified, original Vercel Hobby incident unresolved | Tested backup/restore and rollback, monitoring, rate limits, server CPU/request budget and no secret/data leaks | AI + founder decisions |

**Do not reopen Rider/delivery, online payments, LocalPay payouts, Oracle AI deployment or future rewards for the pickup-first pitch; they are deferred.**

## Next SAFE execution tasks for the AI worker (without founder repetitive work)

- Maintain this vendor pitch/launch checklist with **current evidence only** and publish a founder-ready one-page briefing in a **draft branch**.
- Prepare a **screenshots-only, synthetic-data vendor demo checklist** and find defects in the actual Customer and Merchant UI sources; never infer a deployed preview exists from CI alone.
- Continue Cloudflare read-only source/tests and solve issues independent of the CF2-E backup gate. Avoid staging/Production deployment, domain changes, SQL grants, credentials, spending or PR merges without explicit founder approval.
- Once local Codex verifies a current encrypted staging backup, resume the already **conditionally approved** CF2-E staging-only SQL strictly within that scope and report real postflight results. No additional Hyperdrive/Worker/auth/order activation is implied.
- Keep the [canonical handoff](LOCALEATS_PROJECT_MEMORY.md) and [founder charter](LOCALEATS_FOUNDER_CHARTER.md) updated across chats.

## Source of truth / non-claims

- Merchant/API [draft PR #222](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/222), Customer [draft PR #140](https://github.com/mehey9184-maker/LocalEats-app/pull/140) and Super-LocalAdmin [draft PR #5](https://github.com/mehey9184-maker/Super-LocalAdmin/pull/5) are **not merged or deployed to Production** as these preview features.
- CF1 Cloudflare Worker `localeats-api-cf1-staging` is the same approved bootstrap, with four writes flag OFF.
- The actual CF2-E backup check on 2026-11-23 found Nov 9 SQL and three password-protected archives with encrypted V: **unmounted**; it is still **NOT READY**.
- Progress figures must be revised after accepted browser/mobile/live order evidence; they are not a promise of launch date.
