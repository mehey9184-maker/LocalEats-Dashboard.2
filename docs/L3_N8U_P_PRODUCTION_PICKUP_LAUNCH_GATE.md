# L3-N8U-P — Production pickup launch gate and limited-beta decision

**Date:** 2026-11-20 (Africa/Johannesburg). **Status:** **HOLD PUBLIC ORDERING**; source-only API auth fix prepared in this draft PR. This is the user's requested fast-track Production readiness assessment, **not** approval to enable Production pickup writes, modify existing orders, create Firebase accounts, charge customers, merge, send live push, or change deployed Firebase rules.

## Owner's goal and minimum release scope
Release the currently public LocalEats Customer and Merchant sites for an **invited, limited pickup beta**, rather than prolong staging-only work. Customers browse shops and prices, place an order for **physical pickup**, owners receive/accept/prepare it, customers get a ready notification, pay **at the shop** (cash/card machine), and collect food. Keep delivery/riders, online payment, LocalPay, live rewards and subscriptions out of beta. Preserve existing UI, Install App and notification opt-in affordances. Allow feedback and incremental updates **after** the order/ownership/payment safety gates pass.

**Recommended rollout:** public browse/feedback immediately where read-only flows already work; subsequently **2–3 approved shops and 10–20 invited customers** on the real Production system only after the end-to-end acceptance gates pass. Avoid a broad public ordering flag flip as a substitute for a reviewed limited beta.

## 1. Immutable Production deploy snapshot

Connected Vercel inspection of **actual aliases** (not draft previews):
| Surface / production alias | State | Vercel Git SHA | Current Production order flag |
|---|---|---|---|
| Customer: `www.localeatssa.co.za` and apex | READY | `d5680332d391d9aa497d10ff047c839242b2d62f` (`main`) | `VITE_PICKUP_ORDERING_ENABLED=false` |
| Merchant: `dashboard.localeatssa.co.za` | READY | `a5168ccbbb37643a58ad4202c72b65dd43149c2e` (`main`) | `VITE_PICKUP_ORDERING_ENABLED=false` |
| LocalEats API: `localeats-api.vercel.app` | READY | `a5168ccbbb37643a58ad4202c72b65dd43149c2e` (`main`) | `PICKUP_WRITES_ENABLED=false` |

Merchant availability writes are also `false` at Production Vercel. Read-only Vercel API project-environment verification confirmed **Production `FIREBASE_PROJECT_ID` exactly equals `localeats-5e26e`**, and **Production `SUPABASE_URL` exactly equals `https://phdjumtqkooyppxozqsi.supabase.co`**. These are non-secret project identifiers; no Admin credential, email, private key, ID token or service-role key was revealed. The Firebase **Admin service-account credential validity/actual trusted identity and hosted revoked-token behavior remain unverified**. Owner Firebase Console screenshots identify intended Production project `localeats-5e26e` and **named** Firestore DB `ai-studio-localeatsvendord-a61b068b-3029-4d93-ba41-626b03a23bbe`; **Production published Firestore rules were not inspected during this gate**. Do not copy staging `localeats-staging/(default)` deny-all rules into the named Production Firestore database.

**Unmerged integration:** Customer draft [#123](https://github.com/mehey9184-maker/LocalEats-app/pull/123) holds N8O pickup launch security/UI integration; Merchant/API draft [#210](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/pull/210) and its base draft #208 hold staging-only hardening. Those are NOT the public deployed versions.

## 2. Production Supabase — read-only factual inventory

Isolated Production Supabase project `phdjumtqkooyppxozqsi` was queried read-only (no SQL writes, migrations, deletes, RPC calls or account data). Aggregate results:
- **9 shops**, **7 menu items**, **1 pre-existing pickup-contract collection order**, **5 pickup events for that one order**, **0 push-outbox rows**. This existing Production history is **not disposable** and must not be deleted in a test cleanup.
- Existing Production tables: `shops`, `menu_items`, `orders`, `pickup_order_events`, `pickup_push_outbox`, `pickup_push_subscriptions`.
- Production SQL functions: `pickup_create_order`, `pickup_order_command`, `pickup_claim_push`, `pickup_finish_push`, plus order validation triggers. Functions are **SECURITY INVOKER**, with **no `EXECUTE` for `anon` or `authenticated` roles**, and permitted `service_role`. The API must authenticate an actual Firebase ID token and pass actor UID from verified claims; a browser-supplied UID is not authoritative.
- Existing `public.orders` has RLS enabled. The order/event/push-related six named row triggers are enabled: `guard_pickup_order`, `pickup_payment_method_before_insert`, `pickup_shop_availability`, `require_pickup_fact_event`, `guard_pickup_event`, `guard_pickup_push_recipient`. This **does not** prove transitions, recipient delivery and outbox scheduler work end to end.
- Read-only function definition confirms `pickup_create_order` rejects non-service credentials, has an advisory lock and checks matching idempotency key/intent; `pickup_order_command` compares verified caller UID with customer/owner and requires expected revision. Avoid assuming these static checks alone replace a signed-in acceptance test.

Supabase Security Advisor returned: 16 `rls_enabled_no_policy` INFO findings (including orders/events/outbox; RLS no policy normally denies client access, consistent with server-only API model), 1 `rls_disabled_in_public` ERROR on PostGIS-supplied `public.spatial_ref_sys`, and a public-schema PostGIS extension warning with 3 externally executable PostGIS `st_estimatedextent` SECURITY DEFINER overloads; Supabase Auth leaked-password feature warning (LocalEats current public login is Firebase, not demonstrated as Supabase Auth). **Do not blindly alter PostGIS or grant broad row policies.** Review exposure and extension requirements before general public launch:
- https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public
- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## 3. Critical discrepancy in the deployed Production API (RELEASE BLOCKER)

At immutable Production API SHA `a5168cc`, `localeats-api/src/middleware/authenticateFirebase.ts` calls **`authAdmin.verifyIdToken(token)`** without Firebase revocation/disabled-account check. The newer, unmerged staging branch calls `verifyIdToken(token,true)` and validates the UID; therefore earlier staging 8/8 token tests are NOT Production-runtime evidence.

**This draft only** backports the reviewed revocation-aware middleware with injectable verifier, maximum bearer length and validated UID; it preserves the `Bearer fb-` client contract, distinguishes anonymous claims and returns generic 401 without leaking provider exceptions. New offline tests cover signature-valid vs rejected/revoked/disabled, malformed/raw bearer, bad UID, anonymous identity. The backport is **not deployed or merged**, and no Firebase tokens or real credentials were used.

## 4. Test-only pickup gate will block unrestricted public beta (RELEASE BLOCKER)

Deployed Production `localeats-api/src/middleware/controlledPickup.ts` has `CONTROLLED_PICKUP_SHOP="shop-my-kota-ivory-park"` and requires the server-only `PICKUP_TEST_CUSTOMER_UID` to match exactly. `src/routes/orders.ts` enforces `assertControlledPickup` for pickup order creation/transitions, and quote `can_submit` remains limited even when the top-level pickup write flag is on. **Flipping `PICKUP_WRITES_ENABLED=true` alone does not launch general pickup ordering**, and risks inconsistent claims if frontend flags are enabled independently.

The correct rollout is a new reviewed **server-side, multi-merchant beta allowlist or pilot eligibility policy**, with authenticated customer IDs, approved active shops, configured caps/rate limits, current availability, atomic server-authoritative pricing, 4 km or owner-approved geography, idempotency and strict merchant ownership preserved. Do **not** remove the controlled gate or replace it with a blanket allow. First prove one isolated owned-identity order/accept/ready/payment confirmation/collection, then authorize a narrow Production beta feature flag rollout and monitor.

## 5. PWA installation and notification gate

Existing Customer and Merchant repositories contain PWA and Firebase Messaging code; previous owned Windows Chrome tests showed browser/OS notifications for controlled tests. A production FCM HTTP v1 enabled screen or functioning **test** notification is **not** proof of live customer→merchant order notification.

Require these targeted acceptance checks on the intended *public* domains, ordinary mobile and desktop devices:
1. Customer places one paid-at-shop test pickup (after separate activation approval) and Merchant sees the order promptly **even if push is denied or dropped**. Merchant new-order notification and Customer ready notification delivered to **owned devices**, with Firebase provider acceptance, browser receipt and OS-display stages separately recorded. Verify no duplicate retries and no private order data reaches another account.
2. Notification permission is **user opt-in**, never forced ON by default; ask after meaningful actions (post-checkout where applicable). If denied, order status remains in-app and the owner can still accept/prepare.
3. Merchant Install App CTA visible when eligible, hidden if installed; Customer invitation after successful purchase/review flow, `Maybe later` cooldown per latest approved UX. Handle browsers lacking native install prompts with honest instructions, not a fake success.
4. Confirm the existing original shop/menu/card UI, checkout total, safe-area/bottom navigation at 320/390px and logged-out/closed shop states; do not change UI solely to satisfy source tests.

**Do not enable push job scheduler or send any messages to real users without a separate approved test window.**

## 6. Minimum go/no-go criteria and safe sequence

- **Gate A — Production identity + rules:** verify exact deployed Firebase Admin service account project and Cloud Firestore *Production named DB* published Rules, Auth enabled providers and shop owner mapping; no secrets exported. Pass revoked account, changed account, 2-user cross-shop access test on disposable/owned identities.
- **Gate B — API + DB under safe test conditions:** merge reviewed auth hardening only after CI and owner sign-off, prove Production API matches deployed commit, verify approved shop/menu and all effective write flags. Restore-test backup and do a **single controlled test** only after separate authorization to create live resources.
- **Gate C — Atomic pickup lifecycle:** quote from server; reject R0.01/client-edited price; repeat identical idempotency key; deny owner B; accept→ready→record paid at shop→hand over; reject late/duplicate states, confirm full event/receipt history. Explicitly preserve pre-existing 1 Production order and 5 events.
- **Gate D — Notify/install:** owned-device FCM, fallback polling, permission denial, PWA prompts, original UI/mobile accessibility and zero unexpected Production cross-user disclosure.
- **Gate E — Limited launch controls:** approved shop allowlist, maximum order/customer cohort, rate limits, outage/timeout recovery, owner pause/kill switch and monitoring of missed/expired orders; business support and refund/complaint process at shop.
- **Gate F — Public beta authorization:** after A–E pass and **separate explicit owner go/no-go**, deploy tested frontend+API commit using Production-specific config, enable minimum scoped flags, invite 2–3 shops/10–20 customers. Keep delivery, online payments, rewards, LocalPay and paid subscriptions OFF. Review results, then expand.

**Rollback:** immediately pause new order creation via server kill switch; preserve all persisted orders and let the owner fulfil/refund existing commitments; revert Production application deployment to verified release and restore only relevant flags. Never wipe Production history to roll back a beta.

## 7. Decision / actual actions in L3-N8U-P

**Decision today: HOLD public order creation.** Existing domains can be promoted as *browse/feedback only* if their current UI truthfully indicates ordering is unavailable. This is not a recommendation to block general feedback or postpone low-risk polish.

**Performed:** read-only Vercel deploy/env audit; read-only Production SQL aggregate, DDL/ACL/trigger checks and Supabase Security Advisor; checked immutable Production API source and currently unmerged PRs; backported **one revocation-aware auth middleware source file to a dedicated draft branch**, added offline regressions and a dedicated CI workflow, prepared this AI-readable launch gate.

**Not performed:** Production API/Customer/Merchant deployment, Production flag changes, merges, database writes/deletes/DDL/RPC commands, Firebase Rules publication, account creation, real orders/notifications/payments or PWA install. Last verified: 2026-11-20. **GitHub Actions L3-N8U-P offline API auth preflight passed:** TypeScript compilation; **13/13** targeted authentication/pickup-gate tests; **231/231** full existing API regression tests, **0 failures**, in a credential-free GitHub runner, at source commit `1b2025996ed8a4f2f35ce1516d038c18ddd5c03d`. This is not a successful hosted login/order test. The existing Merchant CI and other automatic checks must be read separately, and the draft remains unmerged.
