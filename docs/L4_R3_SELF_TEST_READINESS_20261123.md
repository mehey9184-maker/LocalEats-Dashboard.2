# LocalEats L4-R3 — Founder-owned pickup self-test: evidence and cutover gates

Date: 23 November 2026 (Africa/Johannesburg).
**Decision: real orders HARD OFF; no new outside restaurant required.**
This is a release-readiness record on the *existing draft* first-shop PR #218. It is **not** a go-live or a migration approval.

## 1. Real first-shop test scope
Use only the genuine My-Kota shop and a separate consenting signed-in customer, under the founder's supervision, once the other gates pass. Do not recruit another merchant just to test the service. Start with the existing single-UID, single-shop controlled pickup on current main; do **not** switch on this draft's broader multi-customer public pilot first. Real GPS, real shop opening, actual payment and physical handover are not emulated.

## 2. Reusable offline and CI evidence
Existing production-shaped pickup service model tests already ran 90 virtual days, 180 virtual days, and 2,500 fictional orders across 25 fake shops and 25 fake customers. They inject duplicate checkout, committed-response loss, denied cross-account access and failed pushes. They do **not** prove hosting capacity, Firebase delivery or a real order.
- Draft PR #218 commit `d163b5a` includes the existing three-volume synthetic runner in its first-shop source CI. All production database, Firebase and deployment credentials are blanked for this specific job step. `PICKUP_WRITES_ENABLED=false` remains at job level.
- Draft PR #218 commit `1194c75` corrects an independence flaw: the former `(i*7)%25` / `(i*13)%25` indices visited only 25 merchant/customer *pairs*; the customer now rotates every 25 orders and an assertion requires **625 pairs**.
- A standalone Node.js pairing proof checked 900, 1,800 and 2,500 synthetic orders, covering all 625 pairs and all 25 customers per shop. **This is not a completed compiled-service 2,500-order test at the new SHA.**
- GitHub did not return a new successful PR-triggered workflow run for the modified head. Vercel staging deployment status reported account-blocked; this is a hosting failure, not a pickup-test result. Don't label CI PASS yet.

## 3. 17-item read-only database capability probe (performed 23 Nov)
Reproducible, **SELECT-only** SQL file: `localeats-api/tests/pickup/l4-r3-readonly-db-capability.sql`. It checks six named pickup RPCs and eleven important column names, with no user or order rows read.

| Target | Named capabilities present | Missing |
| --- | --- | --- |
| Isolated `LocalEats-Profile-Staging` (`rgpbdajhlrwfmhopzgzk`) | **10/17** | `shops.pickup_payment_methods`; `merchant_set_pickup_payment_methods`, `pickup_create_order`, `pickup_order_command`, `pickup_claim_push`, `pickup_finish_push`, `pickup_push_sendable` |
| Primary `LocalEats` Production (`phdjumtqkooyppxozqsi`) | **17/17** | No names absent |

**Important:** Presence does not mean semantic equivalence, correct grants/RLS, working authentication or restore completeness. Staging has the order/event/outbox tables, but cannot execute the standard pickup transaction using these missing SQL functions. No schema changes were made. Do not connect synthetic or real orders to Production to work around this deficiency.

### Safe resolution path
1. Preserve a fresh, independently restorable encrypted private database backup. Record proof without uploading SQL or secrets to GitHub/chat.
2. Review the exact Production SQL function dependencies, indexes, triggers, service-role permissions, `shops.pickup_payment_methods`, and staging's differences. Do **not** blindly replay old draft migrations or overwrite staging data. Plan forward-only/reversible schema alignment.
3. Test the reviewed delta in a compatible disposable PostgreSQL 17 environment with fake shops/orders and explicit RLS/role checks; then, after verified backup and review, migrate only the selected isolated staging project, never Production for a rehearsal.
4. Run the same SELECT-only capability check and full negative/positive SQL tests. A 17/17 name check alone is insufficient to accept staging.

## 4. Cloudflare commercial-hosting readiness
- Existing Cloudflare Pages Customer and Merchant original-UI previews are static, isolated, and ordering-disabled.
- Existing `localeats-api-cf1-staging` Worker is GET/OPTIONS public health/catalogue only; source check found `/health` and two catalogue endpoints but **no `/api/v1/orders`**. It has read-only and pickup/availability/payment/profile-write-disabled settings. It is not yet the LocalEats pickup backend.
- Current LocalEats API main mounts an Express application in `localeats-api/src/server.ts`; auth uses `firebase-admin`, storage uses Supabase server credentials, and push uses Firebase Admin messaging. Cloudflare supports Express with Node compatibility, **but these specific modules and per-request secrets/token verification need an isolated compatibility and security test** before considering a port safe.
- An actual Cloudflare staging API must use **different isolated credentials** and deny all write verbs with a server-side hard gate. Validate strict allowed Origins, no cookies/secret logs, no wildcard CORS, quota fail-closed behavior, order route auth, 4km server calculations, idempotent retries, and Firebase push fallback. A Worker rate-limit or deploy failure must never silently route writes to unsafe legacy APIs.
- Existing Vercel Hobby deployment block and noncommercial restriction are separate from source-CI. Do not upgrade to paid hosting without founder agreement.

## 5. Controlled My-Kota real pickup acceptance (later)
Prerequisites: a verified backup+restore; a commercial-compliant, consistent Customer/Merchant/API deployed build; source/CI and hosted no-write smoke passes; all necessary staging SQL functions validated; correct live Firebase project and Auth/FCM device; My-Kota owner confirms accurate R25 item, operating hours/payment methods, and opens **effective** availability; one consenting non-anonymous customer physically within the genuine 4km radius.
Only then admit a **single server-only designated customer UID** for **My-Kota only**, under a short monitored test window. Verify quote > one order > owner inbox and background push **plus reliable polling fallback** > accept > ready > pay at actual counter > physical handover > collected > durable account-isolated history, and pause/rollback. Do not auto-enable the public pilot after one unverified synthetic result. Rider, LocalPay, delivery, online checkout and subscriptions remain OFF.

## 6. Merge and verification guard
Existing draft PR #218 is currently behind merged Merchant/API main and GitHub reports `mergeable=false`. The branch differs from main in pickup middleware, orders, catalog and historical documentation, so **do not merge or force-rebase it blindly**. Preserve these source-only test changes and reconcile against newer reviewed main in one integration pass. No additional small PRs were created here.

**What the founder must do later:** a private fresh backup/compatible independent restore, real devices/accounts, confirm their own My-Kota shop ready and opened, supervise the actual pickup. **No outside restaurant or new paid subscription needed for current synthetic preparation.**
