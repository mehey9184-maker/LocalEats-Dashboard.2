# CF2-E backup gate — secure local Codex handoff (no hosted DDL)

**Prepared:** 2026-11-22 · **Status:** Developer runbook only. This ChatGPT session cannot mount the founder's encrypted Windows V: drive or independently inspect current Supabase backup files.

**Target exclusively:** existing Supabase project **LocalEats-Profile-Staging** (`rgpbdajhlrwfmhopzgzk`), not the main LocalEats database. The newest observed applied staging migrations are `20261120190238_l3_n8o_staging_pickup_orders_hard_off` and `20261120191636_l3_n8o_staging_push_outbox_fk_index`.

## Business and authorization boundary

Founder has already approved **only** applying the reviewed [CF2-D staging catalogue permission migration](../supabase/drafts/cf2d_catalog_projection.REVIEW_ONLY.sql), **conditionally** on a current restorable staging backup and a fresh read-only preflight. No Production, login/password/secret, Hyperdrive, Worker deployment, pricing, customer order, user data upload or paid account change is authorized.

**This runbook does not itself authorize a terminal action.** The founder may direct their local Codex agent to perform backup verification in the secured workstation context. Its output must not include raw dump contents, database passwords or signing tokens. The final hosted DDL is still reserved to the connected Supabase staging tool after the condition is proven.

## Safe local Codex tasks (on the founder's Windows 11 desktop only)

1. Identify the intended encrypted existing storage location used for LocalEats staging backups (historically a VeraCrypt-mounted **V:** drive). Never mount or unlock encrypted volumes without founder action; never copy backups into GitHub or the ChatGPT project files.
2. Verify any *existing* backup includes the **correct staging project**, creation timestamp **after** `2026-11-20 19:16:36 UTC`, and the relevant current schema/migrations. The old 2026-11-10 staging `roles.sql`, `schema.sql`, `data.sql` integrity checks alone are insufficient.
3. If no current copy exists, **do not guess CLI arguments**. On the secured workstation, inspect the installed `supabase --version`, `supabase db dump --help`, `pg_dump --version`, `pg_restore --help`, available account configuration and [Supabase's official database backup documentation](https://supabase.com/docs/guides/platform/backups). Confirm destination staging project reference and that the drive is encrypted and has sufficient free capacity. Use the owner's **existing authorized connection**, without revealing its credentials or modifying database rows/roles.
4. Where the founder has authorized a fresh local encrypted backup, capture the roles/schema/data required for a **staging** recovery using the documented, verified CLI workflow; collect a manifest containing only filename/type, timestamp, file size and SHA-256 digest; record applied migration versions. Keep plaintext SQL exports encrypted at rest and out of git, cloud chat and logs.
5. **Verify restoration** to a new **local disposable PostgreSQL 17** instance (using the existing locally installed Docker, with no published ports), exercising schema, owned objects, required columns and policies, and synthetic-only bounded smoke checks. Do not create any paid Supabase branch or touch the Production project. Note any managed Supabase components that cannot be restored in vanilla PostgreSQL and distinguish full restore from schema/catalogue-only verification.
6. Produce a **sanitized evidence summary only**: exact staging project ref/name; verified restore point date (after Nov 20); backup types, integrity checks passed; type of restore (full vs app-only); database version; migrations; omissions and blockers. Do not include contents of customer/shop/merchant/order rows, credentials or tokens.
7. If a current backup cannot be created/restored safely, STOP and report; do not execute hosted DDL or bypass backup condition. The existing [CF2-E owner-approved backup hold](CLOUDFLARE_CF2E_APPROVED_BACKUP_HOLD.md) remains in force.

## Once restoration proof is available

Return just the sanitized summary to the LocalEats ChatGPT conversation (or save it in a safe founder-reviewed project note with no secrets). The AI worker can then verify the same [live SELECT-only preflight](../supabase/drafts/cf2e_catalog_staging_preflight.READ_ONLY.sql), use the existing **narrow CF2-E founder approval** for the reviewed staging migration **only if the backup condition is fully satisfied**, run [postflight](../supabase/drafts/cf2e_catalog_staging_postflight.READ_ONLY.sql), and report. There is **no authorization** to create a credentialed reader, connect Cloudflare or modify Production.

[Founder operating charter](LOCALEATS_FOUNDER_CHARTER.md) · [Canonical project handoff](LOCALEATS_PROJECT_MEMORY.md).
