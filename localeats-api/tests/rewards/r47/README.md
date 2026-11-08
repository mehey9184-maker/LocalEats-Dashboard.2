# LocalPay R4.7 — Isolated Authentication & Pickup-Evidence Adapter Tests

**8 November 2026 | Founder authorised R4.7 TESTING ONLY.** No real Firebase project, live token, real customer/order, Supabase connection, SQL migration, Rewards payout, merchant bank transfer, Production change, Preview deployment, UI redesign, or merge.

## Confirmed GitHub Actions evidence (8 November 2026)

**R4.7 isolated workflow SUCCESS:** run **42493117407**, job **128769557110** at test-source commit `a3b68097b90f4962e74554a8da66e19cc8fa3d2e`. GitHub Node test report: **49 tests, 49 passed, 0 failed**. The 49 include 41 deliberately invalid evidence-record variants, independent simulated merchant and customer auth, wrong token, revoked/anonymous/unknown identities, repeated read-only inspections, rejected browser financial claims and a **passing test that DETECTS the still-unfixed omission of `checkRevoked=true`** in the current pickup middleware. Initial CI setup was blocked by a mistyped pinned `setup-node` action SHA; a later run reached tests but exposed a broken fixture mutation harness (41 cases stopped at missing bundle). Both were corrected; the final 49 tests exercised their intended rejection paths. **This pass proves contract behaviour with injected fake tokens and mock order records, NOT live Firebase cryptography or verified bank/cash events.**

## What this phase actually exercises

R4.6 established transaction/unique constraint safety against mock PostgreSQL evidence. R4.7 now imports **existing compiled LocalEats API functions** into a separate inert module `localeats-api/tests/rewards/r47/authenticatedPickupEvidence.mjs`:

- `src/rewards/financeActor.ts` → actual `verifyFinancialActor`, which calls injected `verifyIdToken(token,true)` and rejects absent, malformed, revoked (according to the fake verifier) and anonymous tokens. **The injected verifier is synthetic**; it does not perform cryptographic Firebase Admin verification or contact Firebase.
- `src/orders/pickupService.ts` → actual `merchantCommandReceipt` validates persisted pickup command ID, order ID, merchant actor and revision.
- `src/rewards/trustedEvidence.ts` → actual dormant `verifyCollectedKotaEvidence` produces a read-only purchased-kota **candidate**, never a credit or payout.
- The R4.7 test-only facade models **two distinct actor actions** (merchant confirming order and customer confirming separate pickup code) using two FAKE Firebase tokens and ONE hypothetical private, read-only, consistent order snapshot. This is a **rehearsal abstraction**, **NOT** a proposed single HTTP request collecting both users' bearer tokens. A real implementation must independently authenticate each action at its own time, persist attribution, and later verify the sealed event trail without holding a second user's token.

The test verifies an approved merchant's `shops.owner_id`, shop validity/participation at purchase, actual private event actors and unique revision/command identifiers, current customer UID and registration, independently consumed **mock** customer pickup proof with expiry and one-use receipt, immutable non-reward-funded original purchase line, complete refund history and absence of test/simulated/delivery ordering. The returned object always has **`canGrant:false`, `canReserve:false`, `canReimburse:false`, `canActivate:false`, `canReadProduction:false`**. No API route imports this module, no DB writer is available and no backend or Firebase credentials are used.

## Critical pre-existing security gap discovered in production pickup middleware

**`localeats-api/src/middleware/authenticateFirebase.ts` currently calls `authAdmin.verifyIdToken(token)`, *without* `true` for `checkRevoked`.** This validates an ID token's cryptographic validity when Firebase Admin is configured but does not request the explicit revocation check needed for a financial authorization gate. By contrast, the test-only `financeActor.ts` deliberately calls the injectable verifier as `verifyIdToken(token,true)`.

R4.7 includes a **source-contract regression** that detects the missing revocation argument in the current pickup middleware. A green R4.7 test therefore **documents an open live-path blocker**, not that revocation checking has been fixed. This phase **does not edit that middleware**, existing pickup authentication, payment endpoint or real shop authorization. Any future change requires separate owner approval, careful performance/latency consideration, deployment/testing in a genuinely isolated Firebase+API environment and review of all affected Customer/Merchant flows.

Additional gap: current ordinary pickup `collect` verifies `handover_confirmed:true` supplied by the merchant; it does **not** prove that a separate, server-authenticated customer consumed a genuine one-time pickup challenge. Token/session strings and `synthetic-server-consumed-authenticated-customer-code` labels in the test are only assertions about fabricated records, never independent real proofs of handover. Merchant `payment_confirmed` remains a physical-shop attestation and cannot independently prove cash/card-terminal settlement.

## How to test safely

- Run `cd localeats-api && npm run test:r47`. It compiles the existing TypeScript API and executes only the R4.7 Node tests with a fake verifier and in-memory reader. The suite is also appended to the existing API `npm test` (which compiles then runs existing API tests).
- CI is `.github/workflows/localpay-r47-auth-evidence-isolated.yml`, **PR-triggered only**, all activation switches false. Uses no Supabase/PostgreSQL service and no Firebase Admin credentials.
- The test attempts invalid/expired/revoked simulated sessions, forged/wrong-shop merchant, swapped customer, payment and collection command replay, missing purchase-time eligibility, a fake merchant handover checkbox, absent independent customer-code proof, refunds, and source-reader outages. Repeated read-only inspections never write balances.
- Authentication failure must occur **before** private DB reads. The same merchant and customer UID cannot satisfy two independent roles.
- Read-only evidence should be fetched in a single consistent server transaction with appropriate separate stored owner and customer event evidence, not assembled from public order GET data or browser input.

## Known remaining prerequisites

- Actual (not injected) `Firebase Admin verifyIdToken(token,true)` verification including revoked/disabled users, authenticated shop-owner lookup and historical merchant/customer event permissions.
- Proof of physical cash/card settlement or review controls, a genuine server-generated independent customer pickup challenge/replay prevention, actual original eligible item snapshot at checkout, frozen programme opt-in and comprehensive refund/dispute history on the real pickup contract.
- Production-safe database RLS/private financial roles, proper time/actor-bound replay, merchant/customer consent/terms, actual R500 ring-fenced backing, South African legal and privacy/regulatory assessment.
- Future Gold R80 and Platinum R150 spendable LocalPay food-credit lots remain inactive/unfunded under the R500 Bronze-only plan. No real payments, customer credits, merchant payouts or wallet exist.

**R4.7 exit is only a contract-tested, inert authenticated-evidence boundary and a documented live middleware gap.** No deployment, SQL migration, merge or financial activation is approved. Future R4.8 could be a separate **founder-approved security remediation design** for the revocation gap and an emulator-isolated end-to-end event-provenance test, *not* an automatic merge or change to Production. Source hierarchy: `LOCAL_EATS_MASTER_PLAN.md`, this README, `docs/R45_LOCALPAY_TRUSTED_EVIDENCE_RECORDS_AND_PROCESS_20261108.md`, R4.4/R4.6 notes.
