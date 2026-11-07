# LocalEats Rewards R3.2 — Authenticated Worker Contract, Failed Event Recovery and Exact Pickup Ordering

**Status:** 8 November 2026, **synthetic tests and inert TypeScript only**. No real Supabase migration, Firebase project connection, merchant payment, customer Rewards write, live worker, new HTTP route, exposed RPC, online payment or Rider/Delivery. All SQL named `SYNTHETIC_ONLY` must run **only** in disposable PostgreSQL 17. The existing R2–R3.1 tests remain unchanged and run first.

## What was VERIFIED in the real connected database (read-only)

Supabase main PostgreSQL 17 function `public.pickup_order_command(...)` was read through `pg_catalog.pg_get_functiondef` using **SELECT only**. The existing function:
- uses `SECURITY INVOKER`, restricts `current_user` to `service_role`/`postgres`, and has no `anon` or `authenticated` EXECUTE grant;
- locks the actual `public.orders` row `FOR UPDATE`, resolves the current shop owner, verifies the expected revision and actor, validates pickup-only transitions and a normalized command hash;
- for `confirm_payment`, requires ready-for-pickup and unpaid; for `collect`, requires ready-for-pickup, paid, and confirmed handover;
- **UPDATEs the orders row first**, setting its new status, payment and revision, then **INSERTs into `public.pickup_order_events`**; both happen in the **same function transaction**, and a failed event insert rolls back the update;
- currently inserts into the existing push outbox when an order is marked **ready**, not a Rewards outbox on collect.

This confirms the synthetic R3.1 trigger's **update-before-insert assumption** matches the live function's order. It does **not** authorize modifying that function or prove all of its triggers, error paths, existing dependent tables, functions and schema constraints match a test schema. R3.2 mirrors only the essential ordering and guards.

## 1. Isolated PostgreSQL 17 test schema and worker lifecycle

The independent `r32_pickup` and `r32_private` test schemas contain fabricated orders, original menu/Rewards checkout proofs, command events, future programme budget, private outbox, synthetic credit receipts and a dead-letter audit.

- The synthetic `r32_pickup.command()` follows the verified live ordering: lock order, validate current merchant/expected revision and paid-at-shop pickup transitions, update the order, then insert the event. The attached trigger enqueues only if **the final collected state and its original checkout proof agree**, the programme was active at purchase, the merchant actor matches, payment precedes collection, and the customer is registered and non-test.
- **Rewards OFF does not block pickup.** Orders collected before the Rewards programme starts remain ineligible, even after the programme becomes active. Guest, test, missing original proof, unenrolled or unapproved shop, invalid item and forged actor cannot create an outbox pointer.
- The worker `r32_worker` is NOLOGIN, non-superuser and NOBYPASSRLS. It can execute only three private functions: `claim_next()`, `fail_job(order,lease,code)` and `consume_job(order,lease)`. It has no direct source/order/outbox/financial table access and no ability to assume the private function owner role.
- Each claim obtains a new database-generated **random UUID lease token** and 30-second expiration, with `FOR UPDATE SKIP LOCKED` preventing simultaneous double-claim. **A stale lease token cannot consume a newer lease.** Invalid error strings cannot be persisted as accepted failure types.
- Transient failures schedule increasing backoff; the third failure, a permanent invalid-proof failure, or exhaustion of three expired leases places the event in a **private dead-letter state** with an audit row. A dead-letter event is never automatically reprocessed. This is **not** an operator redrive interface, which will need independent approval and reason logging.
- `consume_job` rechecks the persisted paid+collected command order, merchant actor, immutable checkout eligibility, registered/non-test identity, programme funding and original start date, and absence of reviewed refunds **inside the same locked database transaction** as a unique per-order synthetic credit receipt, R25 budget reservation and outbox `consumed` status. No caller can specify customer, price, units, reward amount or shop approval in this function. This proves a single **test Bronze receipt only**—not the full multi-tier R2.8 production design.
- A synthetic fault table causes an exception **after** reservation and receipt creation but **before** marking the event consumed. PostgreSQL rolls back the entire failed transaction, leaving neither a customer credit nor budget reservation; a fenced retry can later complete without double credit.
- Two different genuine orders racing for one funded R25 cap produce exactly one receipt and one consumed event, with no partial loser ledger change.

**IMPORTANT:** The test worker role is entered using `SET SESSION AUTHORIZATION r32_worker` from the disposable PostgreSQL test superuser. Role switching proves local privileges but does not constitute network authentication, credential security, a cloud-worker identity or real token revocation. The database function owner is a NOLOGIN, non-superuser, FORCE RLS-protected role in the private schema. Real service credentials must be separately provisioned, rotated and locked down.

## 2. Separate internal-worker authentication contract (inert TypeScript)

`internalWorkerAdmissionR32.ts` defines a *startup-configured*, no-route, no-network HMAC-SHA256 signed envelope verifier. It is **not** a real worker implementation or an API endpoint.

- An internal worker uses a server-owned secret key of at least 32 bytes to sign a versioned, fixed-audience message binding issuance time, high-entropy nonce, order UUID, collected command UUID and random lease UUID. The verifier uses constant-time signature comparison, a 30-second replay window, 5-second clock-skew allowance, and a **mandatory durable atomic nonce store interface** (test store is in-memory only).
- Changing any order/command/lease/timestamp or signing with the wrong key is rejected. A reused nonce fails even across two test verifier instances sharing the same mock nonce store. If the nonce store fails, admission fails closed.
- Verification returns only a frozen `worker-admitted-only` intent with `canCredit:false`, `canPayout:false`, `canAcknowledge:false`. **There is deliberately no runnable credit, SQL call, bank action or payout method.**
- Firebase Admin continues to identify human customers and merchants. An internal worker identity is **not** a Firebase customer bearer token, and spoofed user metadata must never be treated as service identity. This HMAC design is exploratory; a real deployment may prefer workload identity/mTLS with a private job runner and independently reviewed key management.

The contract needs a **real private nonce store with atomic uniqueness and expiry**, authenticated worker enrollment/key rotation, destination request binding and rate limits before any online use. A replay-resistant signed envelope by itself does not authorize financial action.

## 3. Test scope and remaining blockers

- The dedicated GitHub Actions workflow runs all R2–R3.1 tests, then R3.2 outbox source/authority assertions, actual role-denial checks, crash rollback, lost-lease fencing, poison dead letter, bounded retries, competing budget and transaction rollback. The API regression workflow compiles and runs the inert HMAC admission tests. The exact PR head and all changed filenames are reviewed before merge.
- This is an **at-least-once queue** with a **unique, atomic test financial receipt**. It does not promise exactly-once processing across real service/network/bank systems. No real debit or merchant payable is created.
- Production still has no permanent Rewards purchase-time eligibility snapshot, private ledger, authenticated job-runner or key/nonce store, and the database has no Rewards outbox trigger. The separate profile-staging project is not a pickup-capable staging environment. **Never copy these synthetic SQL files into Supabase SQL Editor, migrations, or Production.**
- The real `pickup_order_command` SQL was inspected read-only but is NOT modified here. A future additive Rewards checkout/transition migration needs a transactionally verified, exact deployed-schema test copy, backup/restore plan and explicit owner approval. Core pickup correctness, notifications and customers must not be disrupted by a reward-side failure.
- The R2.7 core launch security triage—broad `public.payments` authenticated ALL RLS policy and anonymously executable custom SECURITY DEFINER functions—remains separate. These tests do not remediate Production permissions.
- Reward budgets, Silver/Gold cap and terms, appeals/reviewed refund source, shop opt-in, independent merchant reimbursement controls and audits still require owner/security/accounting approval.

**Recommended R3.3:** Threat model the actual deployable integration boundary and a *dedicated, pickup-capable Preview/staging instance* with fully reproducible source DDL, backup/restore, secret management and real Firebase Admin verification. Until approved, keep all Rewards **Coming Soon** and pickup-only public launch independent.

**Progress context:** The R3.2 test suite advances the Rewards **design/tests** workstream, not the real Rewards launch. The core pickup launch's previous ~60% figure is a historical working estimate requiring a separate fresh check; no percentage should be raised simply because this synthetic outbox passed.

Reference: [PostgreSQL 17 transaction isolation](https://www.postgresql.org/docs/17/transaction-iso.html), [PostgreSQL explicit locks](https://www.postgresql.org/docs/17/explicit-locking.html), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase Data API security](https://supabase.com/docs/guides/api/securing-your-api).
