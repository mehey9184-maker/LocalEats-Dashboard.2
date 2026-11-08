# LocalEats R4.3 — Merchant-owned legacy payment access: staging preparation

**8 November 2026 | Stacked DRAFT review on R4.2 branch | NO Production or hosted database writes.**

## Ground truth, read-only primary catalog and current source
- **Actual primary schema types**: public.payments.shop_id is nullable bigint; public.shops.id is text, shops.owner_id is text. This is NOT a verified payment-to-current-shop foreign-key relationship. Non-numeric shop IDs cannot be converted into legacy bigint by guessing. The R4.2 synthetic fixture wrongly required shop_id NOT NULL; this stacked review corrects its fixture and static expectation to match the observed nullable primary column.
- **Actual current live policy (unchanged)**: public.payments RLS policy "Payments access" grants ALL to authenticated using true with check true. Grant/policy hardening was proven only in disposable R3.9/R4.2 databases. Production permission remediation remains blocked pending caller inventory, verified backend and safe staging.
- **Existing API merchant auth**: localeats-api/src/middleware/authenticateFirebase.ts calls Firebase Admin verifyIdToken(token) without explicitly setting checkRevoked to true. Its existing merchant/shop route scopes shops by verified uid. Any *future* payment-history endpoint must independently confirm revocation and server-side shop ownership; this review DOES NOT change the existing middleware or install an endpoint.
- **Legacy PaymentHistory**: src/components/PaymentHistory.tsx uses a Firestore-compatible local facade for payments and localStorage for a visually settled COD status. This does NOT establish a real Supabase payment-history read or reliable server-confirmed settlement. Do not use client localStorage as financial evidence. An unmounted legacy component still requires audit before any future exposure.

## What this R4.3 PR actually tests
1. A synthetic Node-only payment-read **contract model**, not a deployed route: the fake Firebase verifier must be invoked with revocation checking; a fake UID resolves exactly one active approved owned shop; cross-merchant reads and client-submitted shop/role/user selectors fail.
2. The legacy numeric-ID bridge **fails closed** on unsupported text IDs such as shop-my-kota-ivory-park, leading zeros, out-of-range bigint/JS integers, missing, multiple, suspended or archived shops. We do not assume all real shops are numeric.
3. If a fake backend returns another merchant's payment row, response generation fails instead of leaking it. Only allowlisted payment fields are returned. DB failures report unavailable, not fake zero history.
4. The existing R4.2 disposable PostgreSQL 17 rehearsal now adds R4.3 SQL cases: merchant A vs B, cross-merchant denial, archived shop, nonnumeric/leading-zero shop ID and nullable orphan payment. All extra fake records are rolled back before R4.2's schema-only recovery; original pickup tests still run.
5. No real Firebase token, Supabase client, deployed SQL migration or hosted staging credentials are needed. GitHub Actions code is scoped to test-only files and documentation.

## Required work *before* hosted staging or a Production policy change
- Request separate owner approval and check free-tier constraints before creating a **new isolated pickup staging environment**. The current LocalEats-Profile-Staging project only has a profiles table; do not overwrite or repurpose it.
- Obtain a **schema-only, access-controlled** inventory of effective public tables, views, RPCs, triggers, grants, extensions and migration history without copying personal data. Reconcile all differences from R3.6 recovered pickup SQL and any missing baseline objects. Do not claim a complete clone on the basis of this mock lab.
- Identify active callers of public.payments, including Super Admin, legacy dashboard, exports, third-party integrations and Firestore facade. Do not remove live grants until their intended behaviors are verified or replaced.
- Design and test a **server-only, Firebase-verifiable and revocation-aware** merchant payment-history endpoint that resolves shop membership from the database (never user_metadata, browser shop_id or self-asserted role). Handle legacy bigint/text ID bridge by an explicitly reviewed mapping or report the legacy data unavailable. Owner-scope the query at the source, use bounded pagination and allowlisted response fields, and deny cross-shop reads.
- Independently verify full, encrypted restore and roll-forward fail-safe behavior; run actual hosted staging authorization and real-device FCM tests only with separate approval and isolated fixtures.
- Keep all real ordering, Rewards, rider/delivery, subscription billing and online payment capture disabled.

## Owner acceptance
This is a **review-only stack** above R4.2 PR #121, not an independent merge to main. R4.1 #120 and Merchant Settings #119 also remain drafts. A successful R4.3 workflow certifies its offline fake-ID and SQL scenarios, **not** real Firebase revocation, actual payment ownership mapping, full Production-schema parity, a completed hosted staging deployment or safe Production permissions.

Follow launch issue #73. Any actual connected-database writes, hosted staging resource creation, merges or Production changes require distinct explicit approval.
