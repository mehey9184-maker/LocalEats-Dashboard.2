# L3-N7 — Acceptance Deadline Release Audit (No-Write)

**Date:** 19 November 2026. **Disposition:** REVIEW / NOT ACTIVATED.  
**Drafts reviewed:** Customer PR #118 (head 5cd266f76b71b58c532e9d91bb7c91c9ddd749f0, based on #115); Merchant/API PR #173 (head 0e08128891678c71e51c34f33cb8cf14dd440e18, based on #171).  
**Audit-only branch:** review/l3-n7-acceptance-release-audit, based on #173, NOT deployed or merged.

## Current findings

1. **Base drift:** PR #173 was based on L3 API commit `b36954c3d5727fd2c9195c8e2644acfcb69d163b`; its latest L3 target is `e4357d14ca399f8d39261974cfd16476eb12283c`, **16 commits ahead** (no behind commits). Changes involve L3-N6/N6B offline browser harnesses, workflow and documentation. The existing feature CI passed on the older base; the latest-branch combination must pass a no-push synthetic merge/database/API test before sign-off. CI is included as `.github/workflows/l3-n7-acceptance-audit.yml`. Any merge conflict, changed SQL function hash, failed test or unexpected diagnostic is a release blocker.
2. **Connected, named Profile Staging database read-only inspection:** Project `LocalEats-Profile-Staging` (`rgpbdajhlrwfmhopzgzk`) has `shops`, `shops_with_availability`, and `pickup_push_subscriptions`, but **no `public.orders`, `public.pickup_order_events`, acceptance tables, core pickup RPCs or installed `pg_cron` / `pg_net` extensions**. This project is NOT a valid target for applying the acceptance migration alone. No SQL was written, no Production project queried. First confirm whether it is the intended isolated pickup backend, then separately validate the approved foundation schema against a fresh, disposable, backed-up environment. Never point a migration at another project just because it has tables.
3. **Free-tier scheduler:** Official Supabase Cron documentation supports recurring SQL/function jobs, including a one-minute schedule. This is a feasible *design candidate*, NOT an installed job or reliability guarantee. Free-plan projects may pause after seven days of low activity; they have no automatic backups, no guaranteed uptime. Official docs: https://supabase.com/docs/guides/cron , https://supabase.com/pricing , https://supabase.com/docs/guides/platform/backups , https://supabase.com/docs/guides/platform/free-project-pausing . Verify real project tier, cron availability, job permissions, backup/restore and monitoring before activation. Do not enable paid resources automatically.
4. **Worker design gate:** The reviewed `runAcceptanceCycle` is default-off, invoked only from an explicitly approved trusted scheduler, and checks `PICKUP_ACCEPTANCE_WORKER_ENABLED`, `PICKUP_ACCEPTANCE_ENABLED` and `PICKUP_WRITES_ENABLED`. No request route invokes it. Database `pickup_sweep_acceptance()` also checks `pickup_acceptance_settings.enabled`. **Direct SQL Cron does not automatically respect the API environment flags**, so a database-only sweep must have its own explicit separate approval, database feature gate and off-switch. For push, use a separately reviewed trusted worker; never expose Firebase credentials or service role to the browser.
5. **Timing clarity:** Two minutes is the earliest eligible reminder; push visibility and persisted expiry may lag a missed scheduler tick. The database still rejects late acceptance using server time and row locking. Do not claim delivery within exactly two minutes, or successful cancellation based only on the client clock.
6. **Quality gates:** Merchant/API feature CI 4/4 passed on the prior branch; Customer feature CI 3/3 passed. Existing Merchant full lint fails; Codex documented 50 baseline/current TypeScript errors without *new* TS diagnostics. The audit CI captures full L3-base-versus-feature diagnostics and fails if new errors are introduced. **Full release quality remains blocked until the baseline errors and lint issues are repaired independently, not suppressed.**
7. **Real device verification:** No Firebase/Windows foreground or background acceptance push delivery was performed. Do not send a live push or request real credentials as part of this audit; the owner must explicitly approve a bounded staging-device test after isolated schema/worker checks.
8. **Safe scope:** PR #118/#173 and original #115/#171 remain DRAFT and unmerged. No hosted database migrations, scheduler, feature-flag changes, activation of pickup/payment, Production deployment, real customer data, notification sends or change to shop cards/4 km radius.

## Release gate (all required, do not skip)

- [ ] Current-base integration merge clean and API/disposable PostgreSQL/2,500 synthetic request run successful
- [ ] Acceptance SQL reviewed against actual approved *isolated* target database including foundation, drift guards and restore test
- [ ] Existing Merchant full lint and TypeScript errors resolved or explicitly kept as release blockers; no new errors
- [ ] Trusted one-minute scheduler/worker design approved with exact off-switch, metrics for lag/backlog/retries, dead-letter policy and free-plan limits
- [ ] App remains server-authoritative; late acceptance, double expiry, pause/resume, owner switch and scoped inbox continue to pass tests
- [ ] Separate owner-approved bounded staging Firebase/Windows push receipt test performed
- [ ] Human review of 5-minute customer deadline and merchant pause UX; preserve UI
- [ ] Explicit new approval before hosted SQL, write flags, scheduler or any merge/Production activation

**Status:** AUDIT / NO GO for activation pending outstanding gates. More verified data will be appended after the new audit-only CI run.
