# LocalPay R4.2 — disposable PostgreSQL 17 financial-integrity rehearsal

**Owner authorised R4.2 ISOLATED TESTS ONLY on 8 Nov 2026. No Production, staging Supabase, online payments, real merchant bank transactions, API reward routes, or migrations.** This phase follows the R4.1 23/23 synthetic test suite (see `localeats-api/tests/r41LocalPayFinance.test.mjs`).

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
