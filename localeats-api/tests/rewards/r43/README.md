# LocalPay R4.3 — Trusted payment and pickup evidence, scratch PG17 only

**8 November 2026 | Owner-authorised isolated testing only. NOT live payment verification, public LocalPay Rewards, a database migration, a Production update, a merge, or a bank transfer.**

## Purpose

R4.1 tested an isolated single-process synthetic reward ledger. R4.2 tested independent PostgreSQL 17 connection locking, budget invariants and payout-idempotency using invented evidence. **R4.3 focuses on the missing *evidence source* boundary**: an order can qualify for a one-time free Bronze kota only if private server-held facts support the order, customer, approved participating shop, payment at the shop, physical handover, eligible bought line and lack of refund.

The existing inert TypeScript `localeats-api/src/rewards/trustedEvidence.ts` and its unit tests already validate read-only evidence bundles; they are **not connected to live pickup records** and cannot authenticate an arbitrary object passed in by the frontend. The R4.3 work is a **separate scratch PostgreSQL 17 source-fixture simulation** under `localeats-api/tests/rewards/r43/`, using the existing R4.2 **scratch** ledger for one-time financial state changes. Nothing is imported by Production source.

## Source files and safety

- `trusted-source.SYNTHETIC_ONLY.sql`: creates private `r43_lab` schema, mock customers, shop ownership/participation, mock Firebase-verified sessions, server order facts, immutable checkout item snapshots, mock merchant payment/collected commands, separately recorded customer handover-code verification, refund reviews and an append-only credit audit. All fictional.
- `credit_from_verified_source(order_id)`: a **private SECURITY INVOKER scratch test function** taking only an order ID, then deriving shop, customer, quantity, payment/collection flags, programme version and item qualification from persisted fixtures. There is NO browser-controlled `paid`, `collected`, `customer_id`, price or `shop_id` parameter. Only after validation does it call the R4.2 test-only transaction function, whose untrusted direct access remains REVOKED.
- `run-trusted-evidence-r43.sh`: rejects any environment other than a newly created local `localpay_r43_disposable` PG17 database on `127.0.0.1`, with a synthetic-only username/password and no Supabase/DB connection URL, host address override or PG service override. It uses separate `psql` processes for replay and refund-vs-credit races.
- `.github/workflows/localpay-r43-trusted-evidence-pg17.yml`: PR-only GitHub Actions job with **fresh postgres:17-alpine** service and activation flags false. It creates `localpay_r43_disposable` and checks that no R4.3 finance migration/API route exists.

Do not run against a persistent staging/Production DB or copy `SECURITY INVOKER` scratch functions into an exposed SQL RPC.

## Tested rejection cases

**23 invalid persisted synthetic orders** are expected to fail: unpaid; not collected; simulated; test record; delivery; programme not open at purchase; revoked merchant token; browser-declared "verified" session; wrong merchant/shop; missing payment command; missing handover command; reversed event revisions; missing customer code; wrong customer; wrong shop; code declared via request body; unverified pickup code; any refund review; reward-funded item; wrong-shop menu snapshot; client-authored menu snapshot; and non-qualifying item.

Additional tests reject a suspended/unparticipating shop, anonymous or unregistered customer, changes to immutable pickup events/line snapshots/customer code evidence, unknown orders and any untrusted database role trying to claim/mint credits. A valid synthetic order containing four purchased kotas in one genuine-looking pickup can be processed concurrently by two *different* PostgreSQL connections and still generates **exactly one** Bronze entitlement, not one per request. Refund opened **after** a grant blocks subsequent automatic crediting, while preserving the already-earned entitlement pending fair human review.

The final adversarial case runs **refund reporting and crediting at the same time** against the same order-row lock. Either the refund is recorded first and crediting is rejected, or crediting completes first and the immediately following refund opens review. Both outcomes must preserve audit and fund invariants. The tests do not claim a final refund clawback or consumer dispute policy exists.

## Critical limitations / mandatory next gates

1. **Mock tokens are NOT actually Firebase-verified**. Their `firebase-admin-revocation-checked` marker is a fabricated database fixture, NOT a cryptographic signature or a real `verifyIdToken(token, true)` call. Real API middleware must independently verify identity, active shop ownership, permissions and revocation, then read recorded state from server-controlled tables in one consistent transaction. Do not trust browser user metadata or frontend payload role/UID claims.
2. **Mock payment status does NOT independently prove that a merchant received cash or a card-terminal payment.** A trustworthy payment-at-shop confirmation must be authenticated, shop-scoped, auditable and supported by operational controls/dispute handling. The separate code/correlated handover evidence is also a fabricated server record; actual short-lived code verification, brute-force controls, customer consent and failure recovery have not been built.
3. Item eligibility must be derived from actual checked-in immutable order/menu snapshots, genuine non-reward-funded purchases and participating shops **at purchase time**. The SQL fixture can check those facts when seeded, but does not prove a Production system recorded them correctly. A frozen test row is not automatically a valid upstream event.
4. The R4.2 scratch ledger accepts invented `paid/collected` parameters in its **private test-only internal function**. The R4.3 facade prohibits these inputs at its outer boundary, but **neither SQL module is authorized to be exposed** to Customer, Merchant, Super Admin or real Supabase.
5. The system has not performed real cash-funding proof, bank-statement reconciliation, refund reversals, eligibility after partial refunds, full SQL row-security design, API auth adapters, cross-service transaction outbox, correct legacy production status compatibility, customer UI, reward-credit liability actuals, Gold R80/Platinum R150 active credit, 36-month customer-facing expiry or South African legal clearance. A CI PASS does not imply these are solved.
6. R4.3 still relates to the **planned R500 / max 12 enrolled / up-to-R25 one-time Bronze food-item** pilot; Gold and Platinum remain future-only and unfunded. No customer wallet, deposits, transfers, cash-out, online payments or independent LocalPay company exists.

**Follow-up proposal, NOT approved:** R4.4 could test a genuine read-only adapter boundary against the actual isolated pickup SQL fixture with revocation-checked authentication stubs, shop scope, real persisted command revision formats, refund/compensation audit and offline replay after service restarts. Separate review and owner approval would be needed for that phase. Nothing here authorizes actual API wiring or Production activation.

Canonical business authority: `LOCAL_EATS_MASTER_PLAN.md`, Merchant/API draft PR #124. Keep Customer and Super Admin original UI untouched and their draft documentation pointers current.
