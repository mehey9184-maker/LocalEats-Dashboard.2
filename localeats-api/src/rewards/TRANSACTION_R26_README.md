# LocalEats Rewards R2.6 — Trusted Transaction Integration Rehearsal

**SAFE SCOPE: inert server-side library and fake-reader tests. No routes import this, no database adapter exists, no HTTP handler, no Supabase/Production SQL, no rewards/payouts/customer actions.** Tests cannot create real orders or spend money. This is a transaction integration contract for future review, not a runnable Rewards API.

## Existing constraints (source code inspected)

- The pickup API currently uses Firebase Admin verification and server-owned pickup state. The normal merchant authenticateFirebase path does not check revocation; it cannot approve financial actions without stricter middleware.
- R2.4 added read-only evidence validation for collected/paid pickup orders, authenticated registered customers, immutable purchase-time eligible menu lines, programme version, and refund history. It also added read-only owner and Super Admin eligibility checks.
- R2.5 tested synthetic PostgreSQL 17 purchase snapshots, handover and budget races. Its SQL is *not* a migration. The actual Supabase schema does not yet establish those immutable Rewards rows.

## What R2.6 adds

- **financeActor.ts:** strict server-only financial token verification contract. Requires the Firebase Admin decoder to be called with the revocation check explicitly enabled. Missing/invalid bearer tokens, anonymous accounts, missing sign-in providers, malformed user IDs and rejected revoked/disabled tokens fail closed. The callback must be supplied by a real Firebase Admin verifier; a fake verifiedBy value or client JSON does not authenticate an account.
- **transactionRehearsal.ts:** one synthetic serializable unit of work for a whole paid-and-collected order. It loads current campaign funding/version from the same transaction, checks R2.4 purchase and refund evidence, and sends all qualifying lines to one abstract atomic credit method. The implementation must commit or roll back all lines, rank changes, outstanding reward entitlement and owner budget together. There is no real DB writer.
- **Refund hold rehearsal:** R2.4 independent merchant and admin refund proof must be validated within the transaction before appending one hold event; the test store preserves existing entitlements and never creates a merchant chargeback.
- **Financial review only:** separately verified Firebase tokens, active Super Admin/shop owner authority and matching payable evidence are checked inside a transaction. The functions return review candidate data only, not a bank payment, transfer status change or merchant settlement. Amounts come from trusted payable data, never the request body.
- **transactionRehearsal.test.ts:** synthetic in-memory serialized transactions verify 4-kota Bronze, 4+20 whole-order milestone credit, funding rollback on a second line, same-order concurrent retries, inactive/unfunded/version-drift failure, unpaid and refunded orders, verified refund holds, fake reviewer rejection and read-only payment reviews.

## Mandatory missing work for a real service

1. Implement and independently review a server-only, database-backed transaction adapter. It must use one PostgreSQL connection at SERIALIZABLE isolation (or a separately proven equivalent locking/unique-key scheme), share the transaction's consistent order, menu snapshot, refund and funding evidence, and retry serialization failures safely. Merely implementing the TypeScript interface is NOT enough. PostgREST multirequest read-followed-by-write is not a transaction.
2. Real paid-and-collected pickup orders do not yet persist the complete purchase-time Rewards eligibility snapshots. R2.5 synthetic test SQL must never be copied into hosted Supabase by accident. Define actual migration only after security review and owner approval.
3. Financial middleware must wire verifyFinancialActor to real Firebase Admin verifyIdToken(token,true) using the Authorization header supplied by the server HTTP request, not from body or user_metadata; use a newly verified active admin record and merchant ownership record from the same transaction. Guard against transferred shop ownership.
4. The future DB writer must enforce programme budget reservation and idempotent uniqueness within SQL, independent of TypeScript checks, and reject unapproved actors. Payout must require independently validated external bank-proof reconciliation; an admin-entered reference alone must not claim funds arrived.
5. Refund/event integrity, hold release with independent review, cancelled redemptions, immutable accounting ledger, bank returns and partial transfers need separately approved real-world workflows.
6. Keep customer/merchant Rewards UI in Coming soon until the owner approves funding, terms and legal/financial reviews. No retroactive credits for earlier test purchases and no employment guarantee at Platinum.
7. Do not activate online payment or delivery/rider flows. Core pickup launch security and backup/restore tasks proceed independently with Codex.

## Proof level

The CI unit gate proves only that the injected synthetic adapter follows its contract and rejects forged/missing evidence. The PostgreSQL 17 concurrency tests from R2.2-R2.5 separately prove the test schema can serialize these synthetic ledger operations. Neither demonstrates Production Supabase provides a secure authenticated Rewards transaction. No Rewards route/adapter exists; real reward activation remains OFF.
