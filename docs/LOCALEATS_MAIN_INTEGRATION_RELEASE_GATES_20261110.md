# LocalEats — Safe Route From Preview to Main (API / Merchant)

**Status:** documentation-only main-targeted draft. Not an approved merge or release.
**Prepared:** 2026-11-10

## Decision

The owner wants LocalEats' tested work to be integrated into `main`, not stranded indefinitely in isolated Preview branches. This is the right long-term direction. But merging a development stack is different from approving each individual change.

As inspected on 2026-11-10, `review/l1b-additive-pickup-design-20261110` is more than **200 commits ahead** of `main`. It includes experimental API, Rewards, staging schemas and other unrelated work. No wholesale merge, forced reset, or cherry-pick of an unreviewed commit series is authorized by this plan.

## Main release lanes

| Lane | Can be prepared for main | Separate release gate |
|---|---|---|
| 0. Docs/tests | Non-runtime launch checklists, test evidence, static-only review scripts | Code review and owner sign-off |
| 1. Non-order correctness | Small merchant screen bugs, fallback error messages, accessibility fixes | Tests + isolated Preview + owner acceptance |
| 2. Read-only API | Backward-compatible catalogue/profile security fixes only | Confirm Production API contract and env config |
| 3. Pickup persistence | Orders/events tables and server-authorized RPCs | Fresh restorable Production & staging backups, exact SQL review, staged transition proofs, rollout order |
| 4. Live pickup | Explicit customer/merchant write gates, support and monitoring | Full pilot go/no-go and owner's **separate Production approval** |
| 5. Riders, Rewards, LocalPay | Future releases, separately configured and funded | Independent authorization, risk and compliance audit |

## Required checks for EVERY runtime main PR

1. Branch from the exact current `main` head. Select the minimum needed code; do **not** target a giant stacked draft PR at main.
2. Inspect all GitHub Actions and Vercel projects attached to the Production Git branch before merging; assume a merge **might auto-deploy** until verified otherwise.
3. Keep pickup writes, online payments, Rewards, rider activation and wallet features disabled by default; do not add hidden ways to turn them on.
4. Run TypeScript/build/isolated tests, review changed file list, check secrets/ACL changes, verify the original UI in isolated Preview and keep existing API endpoints compatible.
5. Distinguish database schema from application code. A feature that needs new columns/RPCs cannot be merged into auto-deploying Production until those dependencies have been safely rehearsed and released in the correct order, with backup/rollback ready.
6. Require explicit owner approval for **that exact PR** and its deployment side effects. PR approval is not approval of Production database writes or ordering activation.
7. Verify after any approved release, monitor logs/alerts and have a specific tested rollback. Do not treat reversion as sufficient recovery for database changes.

## L1A/L1B blockers

- The current staging project has P5 profile + synthetic catalogue, but lacks `orders`, `pickup_order_events`, `pickup_create_order` and `pickup_order_command`.
- The earlier Supabase backup recovered only part of the application schema; current staging backup + compatible independent restore remain **unverified**.
- The new L1B SQL is a disposable-database **rehearsal** only. It intentionally has no write functions and must **never** be executed against hosted staging or Production.
- Existing fixture shop `owner_id` constraints are synthetic; owning Merchant Firebase UIDs are not yet mapped.
- These blockers are not addressed by merging to `main`.

## Meaning of this PR

This file is safe to review on `main` because it changes **documentation only**. It does not authorize any merge, update a GitHub Action, modify Vercel settings, execute SQL, touch hosting, expose a credential, or change a Customer/Merchant screen.

**Next:** review a small code-only change in its own PR from `main`, verify Preview and Production deployment triggers, then request owner's exact approval before merge.
