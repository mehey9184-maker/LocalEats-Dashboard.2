# LocalEats R3.6 — Recorded Applied SQL Recovery and Preview Acceptance Evidence

**8 November 2026 | Safe read-only recovery, offline Docker tests, no cloud database writes.**

## What was actually recovered (key outcome)

Previous R3.5 auditing found **eight** remote applied migration versions but only **four** tracked as versioned `supabase/migrations` SQL files. Three later pickup migrations were reviewed drafts, and `pickup_payment_methods` appeared missing entirely. Those findings were accurate **as source-code inventory at the time**.

R3.6 discovered that the database's migration-history table includes a `statements text[]` column. A **read-only query** of `supabase_migrations.schema_migrations` returned **one recorded original applied SQL statement for each of all four pickup versions**:

| Applied version | Migration | Recorded statement characters | SQL MD5 (recorded) |
|---|---|---:|---|
| 20261030111305 | pickup_launch_foundation | 35,892 | `6bdcc11d2ca85ab3c3994b62a343b2c6` |
| 20261031073608 | pickup_zero_fee | 6,033 | `e79cfe2114c86f4fc85894075dd64334` |
| 20261031073645 | merchant_availability | 5,705 | `f77fcf4d7063ca0456f1fc6e5bde1c88` |
| 20261101160331 | pickup_payment_methods | 4,962 | `11ad1d3b55f86f5d9fe48ea50101daea` |

All four SQL statements were saved **verbatim**, preserving original line endings and spacing, to `supabase/recovered_applied_readonly/<version>_<name>.sql.txt`. The `.sql.txt` suffix and dedicated archive directory prevent standard migration discovery. The accompanying `R36_APPLIED_STATEMENTS_MANIFEST.json` holds the provenance, exact MD5, character count and no-activation flags. The R3.5 migration inventory was updated to reflect this recovered record while keeping `complete: false` to prevent a false full-schema parity claim.

**Important:** These are the exact statements *recorded in the migration ledger*, not necessarily byte-identical to the files originally edited in an IDE. They are not an instruction to reapply them. Their raw contents include historical "review draft" comments even though the migration ledger reports them applied—do not interpret comments as describing the current deployment state.

## Review-draft comparison

Source comparisons show:
- The archived `pickup_launch_foundation` and `merchant_availability` differ from their repository drafts in formatting/comments only after a rough comment-and-whitespace normalization. This is a limited lexical comparison, **not a byte-identical or full semantic proof**.
- The **archived** `pickup_zero_fee` has an earlier prerequisite `pickup_create_order` source SHA-256 preflight than the **current reviewed draft**, which contains a correction made after the actual application. Preserve this historical difference rather than silently rewriting the archived statement.
- November's `pickup_payment_methods` archive contains the original preflight, timeout, role grants, CHECK and function/trigger definition. The prior R3.5 reconstructed effective SQL remains a separate synthetic-only test fixture and must **never** be substituted for an original migration.

## Offline replay and reproducibility tests

The existing `localeats-api/tests/pickup/r35/run-local-pickup-r35.sh` now supports two **explicit** modes:

```bash
# Existing synthetic study: current review drafts and R3.5 reconstructed method guard
bash localeats-api/tests/pickup/r35/run-local-pickup-r35.sh

# Recovered historical statements, executed ONLY in a fresh local disposable PG17
R36_PICKUP_REPLAY_MODE=recorded_applied bash localeats-api/tests/pickup/r35/run-local-pickup-r35.sh
```

The new R3.6 GitHub Actions workflow checks **exact MD5/length of every archived SQL statement** against the read-only source record, proves none of the four files was planted in active `supabase/migrations`, and runs the **recorded-applied** mode on the same fake R34 legacy baseline in `postgres:17-alpine`, **no published ports** or Supabase credentials. It exercises the original checkout → Preparing → Ready → fake push queue → cash confirmation → Collected, the cash/card-machine method guards and a **schema-only dump/restore** into a second disposable database.

This is a first-order **source recovery and reduced compatibility test**, *not* proof that every table, policy, index, extension, trigger and migration in the connected Supabase database can be rebuilt exactly. The R34/R35 baseline deliberately omits unrelated Production entities. If historical preflight fails in a fresh local database, the CI must report that real blocker, not bypass or modify the original archived SQL.

Do not turn recovered `.sql.txt` into executable migrations, alter the remote migration ledger, create a hosted staging branch, run Supabase `db push` or write to Production without a separate owner-approved and independently reviewed schema/deployment plan.

## Actual Preview acceptance — still pending

Vercel read-only deployment metadata has been checked, but this chat has no accessible authenticated browser session or network route for opening Vercel preview hosts and capturing/inspecting screenshots. Therefore **NO real Customer or Merchant Preview flow has been visually accepted in R3.6**. A Vercel `READY` deployment only means the build is deployed; it does not prove guest/login, storefront, orders, visual stability, closed-shop menus or notifications work.

Observed Preview deployments can be located by Vercel project, but the most recent listed Preview commits were **not** the exact current main commits:

| Surface | Vercel project | Preview ref observed | Current main at audit |
|---|---|---|---|
| Customer | `project-x7cvt` | `fix/customer-first-paint` @ `480fbaf...` | `01069d9e6db41325c4ad9a086a0148efa32edce7` |
| Merchant | `local-eats-dashboard-2-6m8o` | `feature/local-rewards-teaser-pickup-marketing-20261107` @ `70c57f...` | `5046106fdd3ad5ad98fca9ec4a8bbfafbb40251a` |

The static isolated Customer Chromium source fixture and Customer build already passed in R3.5, but that test runs **localhost with external requests blocked**. It is not a real browser capture of current Preview and must not be claimed as such.

### Required owner-visible Preview acceptance (ALL UNVERIFIED)

1. **Customer login and guest profile**: guest/profile moves to Login; signed-in refresh stays on Home; no startup-screen flash or fake saved profile.
2. **Customer original Home**: original My-Kota card, nearest-first sorting, stable skeleton and no flickering, 4 km proximity and no red-pin picker. Closed shops permit menu/prices but never Add/Buy.
3. **Customer menu and cart**: real menu/cart correctly opens, R0 service fee, pay at shop only; simulated checkout creates **zero real orders**.
4. **Merchant Storefront Settings**: Storefront is reachable, merchant pickup methods can be reviewed, unnecessary controls don't obscure essentials.
5. **Merchant Orders**: incoming order list is visible beneath compact controls and pickup state actions are understandable. No unauthorised live order test.
6. **Notifications**: Customer/Merchant reliable real FCM ready/pickup messages, background and reconnect. Requires separately approved pickup-capable staging; synthetic queue tests do not certify delivery.
7. **Safety**: Rider and Delivery remain Coming Soon/disabled for at least 6 months; no online payment, subscriptions, Rewards or bank transfers.
8. **Negative/recovery**: confirm errors, stalled refresh, no-write simulation, closed shop and out-of-range UX; no duplicate orders.

All eight are **pending real screenshots/manual acceptance**. Use a correctly pinned Preview deployment, not Production, for interactive tests. Do not create live orders without explicit approval.

## Separate Production security blockers and next release gate

The 8 November metadata audit still found `public.payments` authenticated `ALL` RLS policy with `USING true` and `WITH CHECK true`; separately audit and stage a reversible policy fix with checkout regressions. Shop column-level permission grants are broad but current RLS policy is SELECT-only, so they do not by themselves prove an anonymous update path. Some unrelated callable SECURITY DEFINER functions still need independent hardening review. **No Production roles, RLS, permissions or financial data were changed here.**

**What R3.6 can close:** recovered migration statement evidence and a tested offline replay *if CI passes*. **What remains blocked:** full deployed-schema equivalence, owner-approved Preview screenshots, real Firebase reliability and critical RLS remediation. Core pickup public-launch readiness remains the previous estimated ~60%, not revised from isolated evidence.

**Next phase R3.7:** explicitly approve how to reproduce **the complete effective Supabase schema** in a no-real-data local/Preview environment (not necessarily rewrite historical migrations), then perform actual browser/owner acceptance against exact Customer and Merchant Preview deployments; independently implement a reversible least-privilege `payments` RLS fix in non-Production staging.

Sources: Supabase read-only system catalogs and `supabase_migrations.schema_migrations.statements` (8 Nov 2026), GitHub source history, Vercel deployment metadata. General safety references: <https://supabase.com/docs/guides/local-development/cli-workflows>, <https://supabase.com/docs/guides/deployment/managing-environments>, <https://www.postgresql.org/docs/17/backup-dump.html>.
