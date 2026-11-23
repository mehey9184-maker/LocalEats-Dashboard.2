# CF2-C — Exact LocalEats availability SQL under a least-privilege reader

**Date:** 2026-11-22 · **State:** **PASS — DISPOSABLE POSTGRESQL 17 ONLY**, not live Supabase/Cloudflare acceptance.
**Approval:** founder SAFE coding/testing/documentation autonomy. No connected SQL, grants, secrets, FCM, Oracle resources or Production changes.

## Question tested

Can a dedicated read-only database identity retrieve public shops with authoritative opening-time and merchant-override rules without receiving SELECT on private shop owner/contact/internal fields?

The existing SQL draft `supabase/drafts/merchant_availability.sql` defines:
- `shop_schedule_open(open, close, at)`, honoring the **Africa/Johannesburg** timezone and overnight hours.
- `shop_effective_open(p_shop public.shops, at)`, using a full composite-row `public.shops` argument.
- a `security_invoker=true` view `shops_with_availability` projecting `s.*` and `shop_effective_open(s,statement_timestamp())`.

Granting broad table access to make that whole-row view work would be unacceptable for a public catalogue.

## Actual synthetic test progression

1. **Source-integrity gate:** [source parity test](../localeats-api/tests/cf2c/exact-availability-source-parity.test.mjs) confirms the original two function definitions are copied **verbatim** into [PG17 rehearsal SQL](../localeats-api/tests/cf2c/exact-availability.SYNTHETIC_ONLY.sql). We did not edit the original availability SQL.
2. **First direct composite-row approach — FAILED.** In [CI #45069693007](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/actions/runs/45069693007), the restricted reader's select on a security-invoker view invoking `public.shop_effective_open(s,...)` returned `permission denied for table shops`. This established a **real** clash between whole-row function invocation and our column-only SELECT privileges in the disposable PG17 schema. **We did not fix it by granting `owner_id` or `SELECT *`.**
3. **Corrected design — PASS.** The non-exposed `catalog_cf2.public_shops` projected view now computes availability using only `is_active`, `opening_time`, `closing_time`, `availability_override_until` and the **original** `shop_schedule_open` function. It replicates the exact `shop_effective_open` boolean expression and includes a privileged internal parity assertion that compares its scalar result to the original function across synthetic rows at the same `statement_timestamp()`. This avoids a whole-row read of private fields. Original functions remain unchanged.
4. [CF2-C isolated PG17 CI run #45070067065](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/actions/runs/45070067065) **SUCCESS** at source commit `45aa5707b59a1637fe40879a15eff60a921f86ad`. It checks exact-original source integrity, no-login/no-bypass scoped role, SELECT-only fields, RLS, and denial of unrelated private columns, DML and original wide view. It also checks day/overnight schedule, SAST clock, temporary override and closed shop with **fixed synthetic timestamps**.
5. The synthetic public catalogue returned five eligible shops (open, far, closed, overnight and override), excluded pending/archived, and public menus excluded an item belonging to a pending shop. This is **synthetic only**; it does not establish live shop-hours correctness for a real merchant.

## Tradeoff: calculated state without broad privileges

The scalar projection reproduces the current authoritative formula but **duplicates its small boolean structure**. That means future changes to `shop_effective_open` could drift unless the source-integrity and parity tests remain mandatory. This is safer than granting a public reader unrestricted access to private `shops` columns, but it still needs review against the exact *deployed* staging schema, timezone, permissions and functions before any live integration.

The prior CF2-B proposed `catalog_cf2.public_shops`/`public_menu` schema, role and GRANTs do **not exist** in hosted Supabase. They exist only in disposable synthetic tests. The synthetic role is NOLOGIN and has no managed credentials, so it cannot be linked to Cloudflare or Oracle.

## Source and reproducibility

- [Exact SQL function source](../supabase/drafts/merchant_availability.sql) (never changed)
- [CF2-C PG17 SQL](../localeats-api/tests/cf2c/exact-availability.SYNTHETIC_ONLY.sql)
- [CF2-C no-port Docker runner](../localeats-api/tests/cf2c/run-exact-availability-pg17.sh)
- [CF2-C GitHub Actions no-hosted-DB workflow](../.github/workflows/cloudflare-cf2c-exact-availability.yml)
- [CF2-B least-privilege role design](CLOUDFLARE_CF2B_ROLE_REHEARSAL.md)

## Next task: CF2-D — detailed hosted-staging change proposal, NOT execution

Before applying anything to connected **LocalEats-Profile-Staging**, inspect its current metadata and draft an exact, reversible minimal SQL privilege/role/view migration in a **separate review-only file**. Verify role identity and PostgreSQL privileges, client/SDK connectivity, function EXECUTE grants, catalog projection source and same-shop RLS; stage a synthetic rehearsal. Do not expose this schema through Supabase Data API or issue credentials in Git. Decide separately whether Cloudflare Hyperdrive or tightly controlled PostgREST makes sense. Obtain founder approval specifically naming the staging project, DDL/role/secret scope and rollback **before** applying SQL or deploying a Worker.

**Current released state:** original Cloudflare CF1 bootstrap only; no new Worker deployed, no Oracle connection, no Production cutover and no payment/order write enabled.
