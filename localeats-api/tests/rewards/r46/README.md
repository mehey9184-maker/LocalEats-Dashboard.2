# LocalPay R4.6 — disposable PostgreSQL 17 evidence transactions

**Owner-authorised R4.6 testing | 8 November 2026 | TEST-ONLY.** The founder authorised the next disposable PostgreSQL evidence-schema and transaction rehearsal, **not** a real Supabase migration, live order/reward write, finance API, payout, production/preview deployment, merge, or LocalPay public-company launch.

## Why

R4.4 found that real pickup orders and public history cannot prove the full Rewards programme, frozen at-checkout eligibility, independent customer handover, complete refund review or actual cash settlement. R4.5 specified future **private** evidence records and 56/56 synthetic contract tests. R4.6 tests a **scratch PostgreSQL 17 version** of the key invariants across independent database sessions.

## Tested isolated source

- `localeats-api/tests/rewards/r46/trusted-evidence.SYNTHETIC_ONLY.sql` creates `r46_lab` PRIVATE SCHEMA and test-only `r46_browser` NOLOGIN role. Real public `orders`, `pickup_order_events`, `shops`, client checkout and Supabase are **never touched**.
- The separate scratch R4.2 `r42_lab` mock pool is loaded in the same **disposable DB** to guard a synthetic R500/12-person, R25-each pilot reserve. Enrolment atomically calls its protected test function; no real owner account is accessed.
- R4.6's `orders` and `purchase_lines` are separate synthetic records, styled after the real pickup UUID, shop/customer, `items`, status, payment status, intent-hash and revision fields. The **deferred constraint trigger** prevents commit of a Rewards-source order missing a frozen purchase-time eligibility line. Immutable line and event triggers block later rewriting. One order/line is used in this minimal rehearsal; this is not a multi-item production schema.
- The mock merchant payment/collection function writes two unique private event records with correct actor/shop/revision and a **fictional merchant till receipt**. It does **not** check a real Firebase token or independently prove cash/card collection; its argument strings are NOT safe live API inputs.
- A mock customer pickup challenge record stores a SHA-256 **digest rather than a plaintext secret**. The test-only server-function uses a fake secret and test-supplied time. The production design must instead generate a high-entropy random secret, use an appropriate keyed verifier, trusted server time, HTTPS, real customer authentication, throttling, secure user-facing handover and an operational recovery process. A digest alone is not a licence for a PIN-based wallet.
- `consume_mock_challenge` serializes on the challenge row, counts failed guesses *without rolling them back*, rejects expiry and five exhausted attempts, and permits **one single-use consumption receipt** even when two independent PostgreSQL clients race.
- `inspect_candidate` locks the order and reads the private events, immutable purchased units, consent, shop participation, till attestation, consumed challenge and refunds. It produces `PASS_CANDIDATE_REVIEW_ONLY` or a blocking reason, and records a *candidate* with `can_grant=false`, **not a free kota, balance, credit grant, or merchant debt**. Parallel inspections share the same order-row lock.
- `report_mock_refund` also locks the same order and records an append-only pending review. A refund recorded before evaluation blocks a candidate; a refund after a candidate moves that non-financial decision to `review_pending`, not a silent clawback.
- Schema/tables/functions are private, with PUBLIC privileges revoked. These are test-owner-only **SECURITY INVOKER** routines. They are **NOT** RLS design for actual customers/merchants and must never be exposed as PostgREST RPC.
- The runner `run-disposable-r46.sh` fails closed unless `LOCALPAY_R46_ISOLATED=1`, `PGHOST=127.0.0.1`, `PGDATABASE=localpay_r46_disposable`, `PGPORT=5432`, `PGSSLMODE=disable`, exact non-useful synthetic credentials and no PG service / Supabase / hosted DB connection URL overrides. The CI workflow uses a **fresh postgres:17-alpine** container; no network to real financial services or production secrets is needed.

## Acceptance checks

The disposable PG17 runner exercises:

| Financial trust failure | Expected synthetic database result |
| --- | --- |
| Browser attempts to inspect or mint via private SQL | Permission denied |
| Enrolment without R500 synthetic reserve or more than 12 | Existing R4.2 transactional funding gate refuses extra admission |
| Old shop/customer opted-in after order | No retroactive Rewards eligibility |
| Attempt to persist an order without frozen Rewards line in same transaction | Deferred trigger aborts order commit |
| Modify or delete frozen qualifying kota row after checkout | Append-only trigger denies |
| SQL exception before purchase transaction commit | Entire order, snapshot and audit transaction rolled back |
| Different merchant asserts payment and collection for another shop | Rejected |
| Paid+collected status without independent customer challenge | No reward candidate |
| Two concurrent attempts at consuming same challenge | Exactly one succeeds, another rejected; one consumption audit |
| Multiple concurrent read-only evidence decisions | One candidate record, later one idempotent replay, no actual grant |
| Customer guesses challenge repeatedly or uses an expired token | Count attempt failures, enforce cap and expiry |
| Refund arrives before or after candidate inspection, including a real PostgreSQL race | Final active candidate blocked or moved to review; audit preserved |
| Audit/event/refund history rewrite, duplicate receipt | Rejected |
| Correct mock source and empty refunds | Review-only candidate, explicitly `can_grant=false` |

**Note:** One R500 fake funded pool does NOT mean the owner's money actually exists. Its R25 reservation is a *hypothetical* Bronze one-food-item obligation, not Gold/Platinum R80/R150 spendable LocalPay credit. R4.6 is not a completed refund-reversal/accounting process; no grant is ever created.

## R4.6 result and next exit gates

The workflow `.github/workflows/localpay-r46-disposable-evidence-pg17.yml` is **PR-triggered only** and uses a fresh ephemeral Postgres service. Test success must be confirmed at the actual GitHub commit and job log; no unverified run is a pass.

**Not demonstrated:** real `verifyIdToken(token,true)` authentication or shop ownership at action time; a separate true customer-authenticated pickup code/QR journey; cryptographic server-side challenge issuance and trusted clock; real cash/card-machine receipt and payment dispute workflow; actual owner funds or banking; true multi-line existing checkout schema; integrated real Supabase SQL role ownership/RLS; operational bank transfer and physical merchant acknowledgment; legal/POPIA/Consumer Protection Act review; available balance, issuer, subscription settlement, future Gold/Platinum lots or customer UI.

**Recommended next phase, not yet approved:** R4.7 — test an isolated real **server-authentication and pickup-evidence adapter** (Firebase Admin revocation-checked claims and shop ownership bound to a real isolated order fixture, no public production data and no credit writes), or settle the pilot handover verification UX and merchant obligations first. No migration, API mount, data write, deployment or live activation under R4.6.

See: `docs/R45_LOCALPAY_TRUSTED_EVIDENCE_RECORDS_AND_PROCESS_20261108.md`, `LOCAL_EATS_MASTER_PLAN.md`, R4.2–R4.5 test documentation.
