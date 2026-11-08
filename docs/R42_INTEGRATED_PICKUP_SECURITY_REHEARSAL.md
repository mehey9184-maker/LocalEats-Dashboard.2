# LocalEats R4.2 — integrated pickup/security rehearsal (review only)

**8 November 2026 — DRAFT. No Production or hosted database writes.**

## Owner decision and scope

The owner requested R4.2 after all five Merchant Settings P1 Preview checks passed. R4.1 PR #120 and Merchant Settings PR #119 are separate drafts; R4.2 neither merges nor activates them. R4.2 runs only Docker PostgreSQL 17 inside a credential-free GitHub Actions runner. No new hosted project, paid dependency, actual Firebase send, external order, payment or Vercel Production change.

**This is NOT the full effective Production schema, NOT a hosted staging deployment, and NOT certification of live pickup compatibility.** The R34 synthetic legacy fixture deliberately omits deployed objects, extensions, Auth, Storage, unrelated RLS policies and external consumers. The four R3.6 recovered pickup SQL statements represent recorded applied migration statements, not a full schema export.

## What R4.2 adds

R3.6 recovered the applied pickup statements; R3.9 tested a broad payment policy in a small separate fake schema. R4.2 combines them in **one disposable database**:
- R34 synthetic prerequisite shops, menu and orders, followed by all four unmodified recovered applied pickup migration statements.
- Real SQL tests for fake customer checkout, Merchant Accept/Ready, zero-fee pickup, fake push queue, explicit payment confirmation, collection, idempotency and shop payment-method restrictions.
- Two additional fake numeric-ID shops and legacy payment records with the observed type mismatch: payments.shop_id is bigint while shops.id is text. Numeric text IDs are only a synthetic compatibility example.
- The R3.9 REVIEW_ONLY SQL template, rendered only for the ephemeral database's fake roles.
- A second empty database restoring the first database's schema-only backup and checking RLS, grants and protected pickup functions.

## Test expectations

1. Source archive provenance and historical pickup replay pass.
2. Before hardening, a fake authenticated role sees two fake shops' payments, reproducing the insecure modeled policy.
3. A changed policy fails the preflight without modifying grants or payment records.
4. After hardening, anon and authenticated cannot SELECT, INSERT, UPDATE or DELETE payment rows or impersonate service_role.
5. A synthetic service-role shop-scoped query returns one fake merchant's payment, but **this is NOT a production API or proof of correct Firebase owner authorization**.
6. After policy hardening, an additional fake R25 cash pickup persists as pending/unpaid with R0 fees and no delivery or rider, while earlier orders/events remain.
7. Schema-only restore has zero synthetic data and preserves restricted grants, RLS and protected pickup RPCs.

## Explicit limits and remaining release blockers

- Only test fixtures/scripts and documentation changed. No deployable SQL was put in supabase/migrations, and the R3.9 permission template remains review-only.
- No Production or hosted database writes. The Docker database has no published network ports and is destroyed after CI.
- Existing LocalEats-Profile-Staging is **profiles only**; it is NOT a pickup-schema staging clone. A hosted complete staging environment needs separate resource/cost approval, sanitized schema and independent isolation checks.
- Production's broad payments policy, public rider_notifications policy and callable privileged rider functions are not fixed here.
- A real rollout still requires Super Admin/legacy caller inventory, owner-scoped Firebase-authenticated payment-history API, verified legacy ID mapping, secure full backup/restore, like-for-like staging negative API tests, and explicit owner approval.
- **Real FCM delivery remains unverified**. R4.1's mock sends cannot certify real-device receipts, token rotation, delivery latency or offline recovery.
- Customer and full Merchant acceptance, order safety, actual payment confirmation and isolated pilot tests remain open.
- Pickup only, pay at shop; no Riders, Delivery, Rewards, subscription billing, online payment, or live ordering activation.

## Acceptance and links

Exact-head CI and scoped file review required. PR remains draft and unmerged. Green CI advances only offline risk evidence, not a certified launch percentage; ~60% remained the previous unweighted estimate.

References: Merchant Settings PR #119; R4.1 #120; security rehearsal #118; launch issue #73; R3.6 recovered SQL manifest; https://supabase.com/docs/guides/database/postgres/row-level-security .
