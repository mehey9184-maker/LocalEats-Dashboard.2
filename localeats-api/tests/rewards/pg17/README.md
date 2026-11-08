# Rewards R2.2 — PostgreSQL 17 isolated rehearsal

**Synthetic CI only.** These are deliberately NOT migrations. Do not apply any `*.SYNTHETIC_ONLY.sql` file to any connected Supabase project, staging project, or live database.

Use `bash localeats-api/tests/rewards/pg17/run-synthetic-pg17.sh` from a machine with Docker to run a disposable `postgres:17-alpine` container. The script publishes no port, accepts no database URL, creates only synthetic records, runs deterministic SQL assertions, tests simultaneous callers in different `psql` processes and destroys the container at exit. No paid infrastructure or secrets required. The GitHub pull-request workflow runs this automatically.

## Explicitly checked

- One PG transaction serializes campaign budget allocation on the `program` row before changing progress, grants or source-line credits; a credit with insufficient budget rolls back completely.
- The first 4 real-looking **synthetic** paid/collected kota units earn Bronze reward; +20 earn Silver; +40 earn Gold and reach Platinum. Cumulative 4/24/64. Replays do not duplicate credit.
- Unpaid, uncollected, test-only, refunded, non-kota and nonparticipating records do not grant progress.
- The milestone creates a reserved entitlement but **no debt**. Fulfillment references an approved catalogue price: standard kota up to R25; alternative food strictly under R25; proposed silver R125 and gold R200 bundle caps.
- Unique IDs and transaction locking prevent concurrent replay duplication of grants, handovers, payables and manually recorded transfers.
- Separate customers racing for one R25 reward budget slot cannot both succeed. No partial credit remains on the rejected transaction.
- Admin-entered external transfer remains *sent*, not settled, until the correct merchant's server-authenticated shop identity confirms *received* or disputes it.
- The rehearsal schema explicitly revokes PUBLIC privileges and denies a synthetic untrusted role access. Audit entries cannot be updated or deleted.

## Limitations and next gates

These functions are **not a Production design ready to deploy**. They are `SECURITY INVOKER` procedures in a scratch, unexposed `reward_lab` schema executed by a locally trusted PostgreSQL test owner. Real entitlement and merchant identity cannot be passed by a browser. A future central API must load actual paid and collected pickup orders, verifiable item snapshots, shop ownership and Super Admin identities server-side; private Postgres role grants and RLS/definer security must be independently reviewed. The synthetic `order_line_facts` and `catalogue` tables do not model real Supabase schemas.

Additional required work before activation: refund/reversal accounting with immutable compensating events, budget-policy changes and fairness under exhausted caps, full entitlement liability and expiration terms, supporting partially paid/batched reimbursements, verified proof of bank receipt and disputes, per-account/merchant privacy and concurrency/load beyond the two-process harness. Real-world resilience for disconnected mobiles, cancelled pickup, financial recovery and merchant support needs hosted tests.

No API route, frontend code, subscriptions, Production flag, live rewards, DB/SQL migration, live ordering, payout integration or Rider/Delivery workflow should change in this PR. Core pickup public-launch blockers are still separate.
