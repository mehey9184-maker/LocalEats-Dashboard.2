# LocalPay R4.2 — disposable PostgreSQL 17 financial-integrity rehearsal

**Owner authorised R4.2 ISOLATED TESTS ONLY on 8 Nov 2026. No Production, staging Supabase, online payments, real merchant bank transactions, API reward routes, or migrations.** This phase follows the R4.1 23/23 synthetic test suite (see `localeats-api/tests/r41LocalPayFinance.test.mjs`).

## Verified test result (8 November 2026)

**GitHub Actions SUCCESS:** run `42446210782`, job `128625569250` on the test-code commit `55876dcf8dcd4fc767b63483d26f6c449b5bdb6b`. The log confirms the following markers: `R42_POSTGRES_ISOLATION_PASS`, `R42_POSTGRES_CONCURRENT_12_CUSTOMER_CAP_PASS`, `R42_POSTGRES_FORCED_BACKEND_TERMINATION_ROLLBACK_PASS`, `R42_POSTGRES_ONE_TIME_BRONZE_AND_REPLAY_PASS`, `R42_POSTGRES_CONCURRENT_HOLDS_AND_CANCEL_PASS`, `R42_POSTGRES_ONE_R24_FOOD_GIFT_NO_R1_REUSE_PASS`, `R42_POSTGRES_BANK_EVIDENCE_AND_MERCHANT_ACK_PASS`, and `R42_DISPOSABLE_PG17_FINANCIAL_INTEGRITY_PASS`. This is actual scratch-PG17 database processing, not merely parsing SQL. An earlier CI run found the Docker-bridge network address differs from host loopback; the health check was corrected while retaining the **exact client PGHOST=127.0.0.1 safety guard**.

These successful tests do NOT claim any live financial operation or verified external cash transfer. Subsequent documentation-only commits do not alter the successful test code; workflow outcomes for new source commits must be checked separately.

### R5.0 maintenance: deterministic concurrency assertion (8 November 2026)

While checking R5.0's draft cross-app CI, the R4.2 workflow run **42498415198** failed despite **correctly enforcing the 12-customer cap**. The shell runner had an invalid test assumption: following 13 concurrent admissions for 12 funded places, it demanded that a specific racer (`c1`) had won, although any one of the 13 customers may legitimately lose. **Only the test assertion was corrected** in `run-isolated-r42.sh` to select a customer actually committed to the scratch `r42_lab.customers` table and verify replay idempotency. The R4.2 SQL funding lock/cap/ledger and real app/API code are **unchanged**. Corrected GitHub Actions workflow **42498583676**, job **128786177966**, **SUCCESS**, including all concurrency, forced rollback, no double-spend, one-time gift, mock transfer and full reconciliation markers. This is an isolated database test stabilization, not permission to activate money, merge or deploy.

## Scope and safety

- All SQL resides at `localeats-api/tests/rewards/r42/ledger.SYNTHETIC_ONLY.sql` and creates only a brand-new `r42_lab` schema in an ephemeral, localhost-only `localpay_r42_disposable` database.
- A GitHub Actions workflow uses a **fresh postgres:17-alpine CI service**, independent of any Supabase project, with a publicly non-useful, synthetic test credential. A fail-closed shell runner requires `LOCALPAY_R42_ISOLATED=1`, `PGHOST=127.0.0.1`, `PGPORT=5432`, `PGSSLMODE=disable`, the exact disposable database name, and no `DATABASE_URL`/`SUPABASE_URL`/`DIRECT_URL`/PG service overrides.
- The SQL intentionally creates **test-only SECURITY INVOKER** functions, in a schema with PUBLIC privileges revoked. These are NOT safe customer-facing or merchant-facing RPC calls: `p_paid`, `p_collected`, admin strings and bank proof records are **fabricated fixture facts**, not authenticated real-world evidence.
- No SQL files were added to `supabase/migrations`. No live API, client UI, merchant dashboard or Super Admin application code is imported or modified.

## What a passing workflow establishes

| Database failure mode | R4.2 adversarial check |
| --- | --- |
| Double admission / spending more than R500 | 13 independent PostgreSQL clients racing for 12 reservations, enforce exactly 12 × R25 = R300 and R200 buffer |
| Rollback halfway through funding reservation | SQL error following a write rolls back admissions, fund balances and journal |
| Crash after an uncommitted reservation | Terminate an active PostgreSQL back-end before COMMIT, confirm no allocation, then retry safely |
| Duplicate order / eligible units | Two PostgreSQL sessions replay the same 4-unit paid-and-collected fixture; one Bronze grant only, even in a single pickup |
| Fake/unpaid/uncollected/refunded/reward-funded order | Reject; don't count units, grant credits or create merchant payables |
| Concurrent spending of one R25 food gift | Two sessions racing for distinct holds; precisely one succeeds, no negative balance |
| Cancelled credit hold | Restore exact held amount to the original grant and customer-liability bucket |
| Unverified food handover | No merchant payable until separate synthetic server-side handover and payment proof is present |
| Double reimbursement | Parallel capture creates only one merchant payable; R24 gift spends one food item and does not leave a redeemable R1 |
| Money/accounting double-counting | Pool CHECK constraint + `reconcile()` prove outstanding liabilities move reserved → customer → hold → shop payable → recorded external transfer instead of being counted twice |
| Fake owner transfer / reused bank reference | Require separate private bank-evidence fixture, role fixture, exact payable amount, unique bank proof and transfer IDs |
| Wrong merchant acknowledging payment | Wrong shop rejected; correct shop confirms independently after transfer; status only 'sent' before confirmation |
| History forgery / client DB access | Append-only triggers on evidence/journal and untrusted role denied private schema privileges |

Run **only** in isolated CI or a separately created *localhost disposable* PostgreSQL 17 test environment. The GitHub workflow sets the exact safety variables and creates the database. Standard command is `bash localeats-api/tests/rewards/r42/run-isolated-r42.sh`; it refuses other environments.

## Limits, unresolved work and next gate

R4.2 is **independent database-process concurrency testing for the synthetic Bronze-only pilot**, not an integrated LocalPay/real Rewards engine. It still does not authenticate actual Firebase users, validate true persisted pickup events or item eligibility, access real bank statements, provide production hardened database RLS, implement 36-month Gold/Platinum credit lots in PostgreSQL, or test app UI across real devices. The Gold R80 and Platinum R150 food-credit business rules and 36-month carryover policy remain **future-only**. The 12-person R500 cap is a planning ceiling, not evidence that the owner funded a bank account. Existing Rewards R2.1/PG17 rehearsal uses superseded R125/R200 bundles and +40 Platinum; it is untouched and NOT a reliable new-business-rule implementation.

Next R4.3 *proposal* after proven PG17 success: verify server-derived order payment/collection evidence, programme version/merchant participation, bank reconciliation and refund/dispute handling with an isolated adapter and staged role-specific security tests. R4.3 itself also requires owner approval before work. A separate owner decision would still be required for any actual rewards pilot, API implementation, SQL migration, billing, transfer, public LocalPay branding or company incorporation.

Canonical financial-security design: `docs/R4_LOCALPAY_REWARDS_FINANCIAL_SECURITY_AND_FUTURE_COMPANY_20261108.md`; Master Plan R4 workstream; draft Merchant/API PR #124.
