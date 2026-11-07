# LocalEats Rewards R3.0 — Secure identity boundary and narrow private transaction executor

**7 November 2026. TEST-ONLY / INERT.** This work is **not** a Supabase migration, Firebase integration, external payment, bank API, production feature, HTTP route or connected database operation. It must not be applied to any connected Supabase project, including the profile-only staging project. The isolated SQL is loaded only by the disposable PostgreSQL 17 Docker runner with no published ports or hosted credentials. All orders, identities, money and menus are fake.

## Why R3.0 matters

Earlier R2.6 read-only financial proof checked that a caller appeared to be a Firebase token verified with revocation checking, and R2.8/R2.9 established disposable PostgreSQL credit and budget accounting. The missing security control was a sharply bounded **server-only execution role**: the future API should not hold broad SQL table-write privileges or trust browser-supplied identities, amounts or eligibility flags.

The real merchant Firebase middleware currently uses `authAdmin.verifyIdToken(token)` without `checkRevoked=true`. This may remain appropriate for normal routes, but **must not authorize money-related Rewards operations**. The R3.0 branch does not change that middleware or activate an endpoint.

## Two separate trust boundaries

**A. Firebase identity + financial REVIEW only (TypeScript):**

- `secureExecutorR30.ts` defines a server-startup-only factory that captures the injected `verifyIdToken(token,true)` implementation. On every review, the **server-observed Authorization header**, rather than request body/merchant field/user_metadata, is passed to the R2.6 Firebase actor parser.
- The parser requires a nonanonymous Firebase provider and rejects missing/invalid/revoked/disabled/mock-expired tokens when the injected verifier throws. Tests verify `checkRevoked=true` is always passed. Expiry and token signature are responsibilities of a **real** Firebase Admin `verifyIdToken`; mocks do not prove either security property.
- A read-only, consistent transaction reader obtains the current payable and independent admin/merchant authority from the trusted store, after token verification. A real database adapter still **does not exist**. Role downgrade, merchant ownership transfer, stale payable status, wrong amount or existing transfer cause an error.
- The only returned object is a frozen *review candidate*: `mode: review-only`, `canSettlePayment: false`. No funds move; there is no receipt update, transfer record, refund write or credit method in this interface. The caller can never supply an arbitrary `VerifiedFirebaseActor` to the exported review method.
- `secureExecutorR30.test.ts` uses a simulated Firebase verifier and fake transaction reader; it is not a test against the user's Firebase project or Supabase. The configuration injection is trusted at server startup and must never be controlled by an HTTP request.

**B. Narrow PostgreSQL execution capability (disposable synthetic lab):**

- `executor-r30.SYNTHETIC_ONLY.sql` creates two unexposed schemas `r30_source` and `r30_private` plus **NOLOGIN, non-superuser, NOBYPASSRLS** roles: `r30_finance_owner`, `r30_api_executor`, `r30_browser`, `r30_merchant`.
- The source tables contain fake server-created pickup orders, immutable purchase eligibility/quantity snapshots, immutable paid/collected commands and reviewed refund notices. Only the synthetic **fixture owner** inserts source rows; the backend executor cannot invent or alter them.
- Finance owner has **SELECT only on trusted source**, and limited SELECT/INSERT/UPDATE on its private ledger. RLS is enabled and **FORCE RLS** applied throughout, with policies scoped to the NOLOGIN finance owner. The finance owner cannot log in with a password and the API executor has no membership allowing `SET ROLE` to it.
- The private function `r30_private.credit_verified_pickup(uuid)` is a deliberately bounded exception to the general preference for SECURITY INVOKER: it is `SECURITY DEFINER` with a fixed `search_path=pg_catalog`, owned by the restricted finance owner (not postgres or service_role), in an unexposed schema, and `EXECUTE` is granted **only** to the NOLOGIN backend executor. `PUBLIC` has no schema/table/function privileges. This pattern still requires independent security review before any real use.
- The function accepts **only an order UUID**. It reads source identity, non-test status, collected/paid state, immutable original lines, chronological command events, verified absence of refunds and a program funding row under `FOR UPDATE`. It never accepts a client-supplied UID, menu, price, eligibility bit, rank, actor or payout reference. It atomically credits new qualifying kota units and reserves a R25 Bronze entitlement only if budget permits; a failed budget reservation rolls back all writes. Replay is idempotent.
- **No merchant payable/transfer/settlement/hold release exists in the SQL function.** R2.8 remains the separate synthetic multi-tier accounting rehearsal; R3.0 intentionally focuses on restricted execution and Bronze integrity. The real app is still pickup-only, pay-at-shop.

## What CI proves

The shared runner first executes all earlier R2.2–R2.9 regression tests, then R3.0's SQL:
- Program is disabled by default even for valid synthetic evidence.
- Missing order, guest, test account, unpaid, uncollected and previously refunded orders cannot earn.
- A true paid-and-collected synthetic order with 4 eligible kota units earns exactly 1 funded R25 grant; retry adds zero, and total reserved liability equals outstanding grants.
- Test introspection verifies dedicated roles have NOLOGIN/NOBYPASSRLS, source/private tables have FORCE RLS, the definer owner is **not** postgres, and `search_path` is pinned.
- Real PostgreSQL `SET ROLE` tests confirm browser/merchant cannot call the private credit function; backend executor cannot SELECT or UPDATE the ledger or source, manufacture a credit, or assume the owner role. Finance owner cannot INSERT fake pickup evidence.
- Two independent restricted backend sessions race for one funded Bronze grant. Exactly one can reserve R25; the loser fails without partially writing credits/progress. Source purchase proof is append-only, and the private budget still reconciles.
- Separate API node:test cases exercise revoked and anonymous identities, forged metadata, role removal, shop ownership changes, transfer proof mismatch and read-only outcomes.

All SQL roles are non-login but **can be entered by the Docker test superuser via SET ROLE**; this tests permissions, not real password, JWT, OAuth or Supabase API reachability.

## Remaining blockers / threat model

1. The privileged R3.0 function can process *any already-valid synthetic order ID*. If deployed as an RPC without a trusted internal caller and rate limits, a compromised backend could trigger eligible credits early or repeatedly. **Do not expose this function to PostgREST**. The future order transition must produce a strictly verified, idempotent command in a private queue or controlled server-owned transaction, and the executor should enforce that command's provenance. This SQL is not a live application integration.
2. No actual read-only `RewardsTransactionalReader`, narrowly privileged database pool or Firebase Admin wired adapter exists. TypeScript mocks can be forged by malicious server code; they are a test of the expected contract, not cryptographic proof.
3. Only Firebase Admin can verify signature, issuer, audience, expiration, revocation and disabled user status against the configured project. **Future production code must use `verifyIdToken(token,true)` and server-managed Auth, never user_metadata**, and must enforce current merchant owner and active Super Admin within one consistent transaction.
4. R3.0's source orders omit real menu-shop history and programme-version participation, and the synthetic database is not an exact production DDL replica. The real checkout still lacks immutable Rewards snapshots. Do not retroactively reward historical/test purchases.
5. For real money-related operations, verify independent bank/cash refund proof, customer/merchant dispute rights, bounded retry for `40001`/`40P01`, bank settlement confirmation and immutable payables. An admin-typed bank reference is **not** proof of payment.
6. A different superuser/role with membership in the finance owner can bypass the intended boundary; audit Postgres role grants, default privileges, schema exposure, function owner, extensions, and backup/restore after every migration. Consider a dedicated non-exposed server connection with very narrow credentials; no production service_role secret in frontend.
7. R2.7 raised separate Production security concerns: permissive `public.payments` authenticated ALL policy and anonymous-callable public SECURITY DEFINER functions. They remain outside this PR and require a coordinated, staged, reversible fix before pickup public launch.

## Release gates and next phase

**Merge R3.0 only** if the dedicated PostgreSQL 17 finance role/concurrency gate and full Merchant/API release gate pass at the exact commit; verify only test code, SQL, docs and test registration changed. Merging test code into main automatically triggers the Merchant Vercel build, but **must not activate Rewards**.

**R3.1 suggestion:** design a truly server-owned order transition outbox and a revocation-checked Firebase integration adapter, first with an isolated fake database pool and read-only Preview harness. A real pickup-capable staging environment, an approved migration, owner-funded Reward terms, independent security and financial review, and owner consent are all prerequisites before any hosted Supabase change or Rewards activation. No rider, delivery, online payment or subscriptions in this phase.
