# LocalEats R4.4 — Merchant payment-history backend contract (review-only)

**8 November 2026 | Draft, stacked on R4.3 | No Production or hosted database writes.**

## Context and original launch task

Make LocalEats ready for a pickup-only, pay-at-shop pilot, with reliable Customer/Merchant workflows and future Super-LocalAdmin review. Do not redesign the original UI, launch Riders/Delivery, activate online card payments, subscriptions, Rewards, or write live orders. Keep Production changes and merges subject to separate owner approval.

## What R4.4 really implements

A compiled TypeScript **server-only payment-history service contract** at
localeats-api/src/payments/merchantPaymentHistoryR44.ts with a fake-dependencies Node test suite. This is intended to be the authorization and output-validation core of a future server-owned GET payment-history endpoint, **NOT a mounted Express route**. No Customer/Merchant component calls it and it cannot be reached in any Vercel or Production API build.

Every request to the service must:
1. Reject client-controlled owner, shop, role, status, limit and other filters. The only optional input is bounded page offset, multiples of 50 and at most 5000.
2. Require a Firebase-shaped bearer token to be verified by a server-provided Firebase Admin verifier with revocation check explicitly enabled. Anonymous identities are denied.
3. Resolve exactly one **currently active, approved, unarchived** shop using the verified Firebase UID; no user-metadata, unverified token role, browser shop ID or local cache may establish ownership.
4. Look up an **explicitly verified legacy mapping** (owner UID, current shop text ID, legacy bigint ID, fixed provenance) via a server-only adapter. Never infer one from numeric-looking current shop IDs or string casts. Preserve the bigint as text to avoid Number precision loss. An absent, altered, out-of-range or unsupported mapping fails closed.
5. Call a **server-only** payment repository with that mapped ID, fixed page size 51 and scope enforced in the query. Then verify every returned row—including the 51st lookahead row—has the exact mapped legacy ID. Invalid, null-shop, cross-shop or malformed financial rows fail closed rather than returning partial data.
6. Return only a minimal allowlist of ID, amount-as-decimal-string, status, payment method and timestamp. Never echo transaction metadata, PII or raw payment rows. The service never writes to payments or claims payment collected.
7. Return a page of up to 50 with a truthful next offset when available. At the bounded maximum, a still-truncated page yields a distinct unavailable error rather than implying that financial history is complete.

## R4.4 test environment

- Fake A and B merchants, fake revocation-checked Firebase Admin verifier, fake shop ownership, verified mapping adapter, and fake payment repository.
- Tests include cross-shop authorization denial, revocation, malformed bearer, anonymous session, missing/suspended/multiple shops, forged role/query/shop filters, legacy bigint precision, missing mapping, DB errors, corrupt row and lookahead-row leakage, controlled 50-item paging, no false completeness.
- Combined with existing R4.3/ R4.2 disposable PostgreSQL 17 synthetic recovery tests in CI. No Firebase token or live FCM is sent, and no Supabase credentials are required.
- Full API compile and existing API regressions must pass on the exact branch commit. Tests cannot certify actual Firebase configuration, real account ownership, live payments or database integration.

## Known blockers and owner gates

This R4.4 service is deliberately **not wired to a route** because the authoritative legacy shop-to-payment mapping does not exist as a verified, approved source. Primary metadata shows payments.shop_id is nullable bigint and shops.id is text. An exact numeric-looking text ID is NOT proof of data lineage. Introducing a new mapping table, staging clone or production SQL is outside current permission.

An actual later endpoint still needs:
- An independently reviewed, isolated pickup-schema staging project or equivalent no-production-data environment. The existing LocalEats-Profile-Staging project has profiles only and cannot be claimed as such.
- Evidence-based mapping migration/provenance and a server-only data adapter that binds the mapped ID to the query, orders payment rows safely, and uses a bounded result page.
- A real Firebase Admin identity verifier with checkRevoked=true integrated exclusively for this endpoint, HTTPS auth/CORS/read-only/negative HTTP tests, audit-safe logs and rate limiting.
- Full consumer inventory (Merchant Dashboard Firestore-compat payment history, localStorage COD handover controls, Super-LocalAdmin, exports, any legacy consumers). No browser payments access should be restored to make outdated UI work.
- Dedicated staging backup/restore, payment and pickup regression results, real-device FCM acceptance, and separate owner approval for a Production migration, merge or activation.

**The broad Production payments policy is still insecure and unchanged.** Rider-notifications and privileged rider RPC permission findings are separate blockers. Public ordering stays off.

## Decision

Review the draft stacked PR and exact CI. Green tests prove only the **unmounted service contract and synthetic staging scenarios**. Do not merge automatically, create a hosted resource, change live roles/permissions or claim public launch complete. The overall ~60% launch-readiness figure is an older unweighted planning estimate and cannot be raised from tests alone.
