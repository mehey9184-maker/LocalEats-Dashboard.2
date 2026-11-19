# L3-N7B4 — Merchant strict ESLint cleanup: first verified batch

**Review date:** 20 November 2026 (Africa/Johannesburg). **Review-only draft:** PR #180, branch `review/l3-n7b4-merchant-eslint-cleanup`, stacked on PR #178. **Status:** first targeted lint batch PASS, entire repository lint remains **BLOCKED**. Neither Production nor any hosted database changed.

## Evidence — tested code
- [GitHub Actions #44632942335](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/actions/runs/44632942335): **3/3 jobs SUCCESS**, tested SHA `e169c4db6a8755b70c05e7d95dcaaa79c99c14c0`; newer commits are report-only.
- Full-root **ESLint 191 → 161 errors**, **30 resolved**, **0 new lint errors** by independent source comparison against unchanged L3-N7B3. Root TypeScript **0 → 0 errors**, no newly introduced TS diagnostics. The original ESLint and TypeScript configurations were unchanged; no ignore/suppression, weakening rule, ts-expect-error workaround, or invented schema field was used.
- Merchant pickup tests **16/16**, merchant command recovery **7/7**, owner/session and Orders layout contracts **4/4**, L3-N7B3 security contract tests **5/5**, and original Merchant build with pickup ordering OFF all passed.
- Actual `OrdersManagement` in loopback-only Chromium: **34 browser assertions PASS** at widths 320, 390 and 1280. The 390px view switches List → original Kanban; account isolation, failed refresh and no-write controls passed.
- Acceptance feature PR #175 temporarily merged **only inside a disposable GitHub runner**, clean without conflicts; combined API **247/247**, acceptance deadline **8/8**, PostgreSQL 17 synthetic 2,500-order and concurrent deadline/row-lock tests, combined Merchant build and no-hosted-write checks all passed. This is not a GitHub/Production merge or cloud runtime test.

## Narrow changes

1. `src/App.tsx`: remove unused imported icons, Firestore-order/menu helpers and dormant retry utilities. Keep `useAuthGuard()` **executed** even though its returned subscription handle was unused. Preserve legacy JSON.parse check for malformed cached orders. Switch `combinedOrders` to `const`; document swallowed browser storage failures instead of an empty catch and remove unused holiday-operation error binding. No rendered UI/checkout or approval gate changed.
2. `src/lib/firebase.ts`: replace 12 `(d.data() as any)` casts with typed `Record<string,unknown>` at legacy Firestore shop/menu/review/coupon reads; preserve the same source fields and identifiers. Mark unused legacy Order writer inputs as consumed without enabling the writers; they remain fail-closed and return `legacyOrderWriteError()`.
3. `.github/workflows/l3-n7b4-merchant-eslint.yml`: independent lint/TypeScript diagnostic delta plus Merchant unit tests, original Chromium Orders page and isolated acceptance PR #175/PostgreSQL regressions.

**The 30 fewer lints are real reductions, not suppression.** This batch deliberately avoids broad rewrites of security-sensitive Firebase, API and legacy billing logic. Source still has **161 other lint errors**, including explicit-any, unused variables, React effect-state, malformed-control-regex and empty-catch findings that require smaller isolated follow-ups.

## Release/owner gates still CLOSED

- 161 remaining full-root ESLint errors; full `npm run lint` is **not yet green**.
- L3-N7B3 profile-update no-op correctly fails closed and card-terminal controls are disabled, but these require authenticated Merchant Settings owner review. A real server-authorized profile save endpoint has not been implemented.
- No real Firebase/Windows background FCM receipt, separate approved isolated hosted pickup schema/backup, Cron job, free-tier uptime guarantee, real orders, in-person payments or owner sign-off was verified.
- PR #180 and upstream Merchant/API #171/#173/#174/#175/#176/#177/#178, Customer #115/#118 remain draft/unmerged. No PR merges, Production deployments, activation flags, real cloud notifications or hosted writes occurred.

**Next recommended phase:** L3-N7B5 — target remaining 161 errors in small non-UI batches (including API tests and `no-explicit-any`), with full unchanged baseline/feature comparisons, then owner-approved Settings manual acceptance. Do not claim all ESLint errors are fixed or that pickup launch is authorized.
