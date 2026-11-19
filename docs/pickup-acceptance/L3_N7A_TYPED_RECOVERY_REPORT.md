# LocalEats L3-N7A — Acceptance Typed Code and Disposable Foundation Recovery

**Date:** 19 November 2026 · **Review-only PR:** #175 · **Status:** targeted fixes PASS; full Merchant lint/TypeScript release quality remains BLOCKED.

## Purpose and branch safety

- Work is stacked on acceptance-deadline **draft PR #173** in separate **draft PR #175**, branch `review/l3-n7a-acceptance-typed-cleanup`.
- Existing Customer #115/#118, API/Merchant #171/#173, L3-N7 audit #174 remain unchanged, draft/unmerged.
- All SQL and restore checks are ephemeral GitHub Actions **PostgreSQL 17** only. The acceptance SQL is **not** applied to connected `LocalEats-Profile-Staging`, any shared database or Production.
- No real orders, payments, scheduler, cron extension, Firebase sends or hosted activation performed. Pickup/worker/push flags are OFF in the workflow.

## Code cleanup

- Removed `any` from acceptance RPC response checks, push-provider error handling, Express response handling and acceptance security-test doubles. Validated the input/result shape with `unknown`, `Record<string,unknown>`, narrow structural checks and `OrderContractError`; no ESLint suppression or deactivation of security restrictions.
- Tests continue to verify revoked/anonymous Firebase tokens, strict shop-owner scope, write gate, payment/push fail-closed, retries and error behavior.
- **247/247** existing authoritative API regression tests and **8/8** acceptance feature tests passed. Merchant application build passed with ordering disabled.
- Lint of the eight changed acceptance source/test files passed with the project's existing rules.

## Latest L3 compatibility and full quality comparison

At tested code commit `15058b61326ddfc2401ed07aa30ab4dd54f9f56c`, [GitHub Actions #44611864891](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/actions/runs/44611864891) completed **all three jobs SUCCESS**:

1. Typed API regression and scoped lint.
2. Disposable foundation + acceptance SQL/restore.
3. **Temporary-only, conflict-free merge** of the latest L3 base into this review code (never pushed), followed by full root lint, TypeScript diagnostic comparison and a build.

**Measured root quality (latest L3 base → combined updated acceptance candidate):**

| Metric | Existing base | Combined candidate | New |
|---|---:|---:|---:|
| TypeScript diagnostics | 50 | 50 | **0** |
| ESLint errors | 216 | 216 | **0** |

Full codebase lint and type checking still fail on the preexisting 216/50. **Do not claim whole-repository green, hide diagnostics or waive those release blockers.**

The earlier L3-N7 comparison that reported 37 unmatched lint diagnostics mixed acceptance `any` errors with checkout-root-specific embedded React Hooks lint messages. The typed fix eliminated the acceptance `any` errors; normalization of **both** TypeScript and multiline ESLint error messages removes false differences caused solely by GitHub runner path names. The final comparison keeps all actual rule failures and is reproducible in `tests/l3-n7a/compare-quality-diagnostics.mjs`.

## Disposable PostgreSQL foundation + acceptance recovery

A fresh local `local_acceptance_qa` database was created in GitHub Actions using the reviewed pickup SQL drafts and acceptance extension, then the synthetic 180-day/2,500-order workflow, volume checks and concurrent late-acceptance race checks ran.

A matching PG17 `pg_dump` was restored into a **second empty local database** `local_acceptance_qa_restore`. Exact original/restored row counts:

| Synthetic table | Rows |
|---|---:|
| `orders` | **2,721** |
| `shops` | **13** |
| `pickup_order_events` | **10,834** |
| `pickup_push_subscriptions` | **2** |
| `pickup_push_outbox` | **1,800** |
| `pickup_acceptance_settings` | **1** |
| `pickup_acceptance_notices` | **1,274** |
| `pickup_acceptance_push_jobs` | **1,274** |

The restore test also verified: zero private My-Kota sample orders; original foreign keys/relations have no orphaned orders/notices/push jobs; an expired order and merchant reminder facts survive; RLS is active on the acceptance tables and pickup event table; and core pickup/order/acceptance functions survive restore. The temporary dump and restore DB were deleted after the runner job.

Log marker: `L3_N7A_DISPOSABLE_ACCEPTANCE_BACKUP_RESTORE_PASS`. All data, devices and FCM tokens were **fabricated**, and no FCM was sent.

## Still blocking live launch

- **50 old TypeScript and 216 old ESLint errors** must be addressed separately on a dedicated baseline code-quality branch, with owner UI fidelity and isolated regressions.
- The connected `LocalEats-Profile-Staging` project was previously found to have no hosted `orders` table, pickup event table/core RPCs or installed `pg_cron`. Disposable success is **not** a hosted schema migration or proof of hosted schema parity. An explicit, backed-up isolated target and owner authorization are needed before any hosted DDL.
- No trusted scheduler has been installed or monitored. One-minute `pg_cron` is technically supported by Supabase, but Free project pausing, rollback/backup strategy, worker identity, job cadence/lag and push queue delivery require separate decisions.
- No real-device foreground/background push, real Firebase merchant session or manual Merchant Orders page owner sign-off is included in this task.
- No merge, Production deployment, schema write, real order, live payment, feature flag activation or notification send is authorized by L3-N7A.

**Next safe work:** baseline Merchant lint/TypeScript fixes in small independent review branches, then verified isolated pickup foundation hosting/restore and an explicit separately approved bounded staging device acceptance. The acceptance feature still is **not** approved for live ordering.
