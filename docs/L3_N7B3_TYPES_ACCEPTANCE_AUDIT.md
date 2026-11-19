# L3-N7B3 — Merchant remaining TypeScript cleanup and acceptance compatibility

**Review date:** 19 November 2026, Africa/Johannesburg. **Draft:** PR #178, branch `review/l3-n7b3-merchant-final-types`, stacked on verified L3-N7B2 draft #177. **Disposition:** isolated CI review only; no Production, database, cloud send, merge or live activation.

## What was verified

- Baseline at PR #177: **19 TypeScript errors and 192 ESLint errors**. Exact diagnostics were inventoried in GitHub CI.
- Candidate after fixes: **0 TypeScript errors, 191 ESLint errors**. The independent unchanged-#177-vs-candidate comparison found **zero new TypeScript and zero new ESLint diagnostics**; it retained the project's original strict lint/compiler rules (no ts-ignore, suppressions or invented server/schema fields).
- All **16 Merchant pickup tests**, **7 command-recovery tests**, **4 existing merchant identity/layout contract tests**, and **5 new L3-N7B3 safety contract tests** passed. Original Merchant shipping build passed with pickup ordering OFF.
- [Combined acceptance integration CI #44622757329](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/actions/runs/44622757329): all three jobs SUCCESS after test-only merge of cleaned acceptance PR #175 with L3-N7B3 source; no branch merge/push. **247/247 authoritative API tests, 8/8 deadline acceptance tests**, disposable PostgreSQL 17 foundation/acceptance SQL and **2,500 fabricated orders + late-acceptance concurrent race test**, combined Merchant build and no-hosted-write/FCM flag checks all passed. This is *synthetic code integration*, not a hosted deployment or six months of uptime.
- [Latest CI #44622964447](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/actions/runs/44622964447) independently reconfirmed 0 newly introduced type/lint findings and acceptance integration. Full original Orders browser regression was pending at report creation; check latest run before claiming browser pass.

## Code changes and safety rationale

1. **FCM foreground listener:** store and invoke the unsubscribe only when the returned callback is callable. A background failure to create the listener must not crash cleanup.
2. **Shop availability:** remove obsolete Supabase/Firestore adapter arguments from the already server-authoritative availability RPC. Keep actual shop status controlled by `MerchantApi.setAvailability` rather than client-side database writes.
3. **Merchant push:** remove an unused incorrectly typed `SupabaseClient` argument; keep the existing Firebase UID and explicit merchant-role checks and API device registration.
4. **Receipt printing:** align callback prop contracts with the real asynchronous implementations (`Promise<void>`) and pass the *actual queued print job* when retrying, never an unrelated string ID. Existing failure queue remains in place.
5. **Orders History:** remove a permanently unreachable "Print Selected" action inside the history-only branch; preserve live Orders default Kanban/List UI.
6. **Profile and schedule save truthfulness:** the legacy Firestore/Supabase bridge's `auth.updateUser` returned `auth.currentUser` as a success **without writing any metadata**. It now explicitly rejects the unsupported operation with an error and null user, preventing false "Saved!" confirmations. Real metadata updates need a separately approved, authenticated, persistent server endpoint; until then these controls cannot save. This is a deliberate **behavioral safeguard**, not a completed profile-save feature.
7. **Terminal payments:** the direct terminal settings in `App.tsx` referenced `require_terminal_sync`, `terminal_provider` and `terminal_serial`, none of which is in the verified Shop contract, and attempted to write these through the browser. The same Settings section retains its layout but marks the inputs disabled, displays the pickup pilot limitation, and makes no terminal-setting writes. Physical pay-at-shop remains unchanged; online/card-terminal integration is **not** being activated.
8. **Dead navigation:** removed a badge branch the inferred secondary navigation type could never reach. No new UI element, amount or paid-order claim was introduced.

## Remaining blockers

- **191 existing ESLint errors**, mainly explicit `any` and unused variables in legacy API/merchant/tests. Full ESLint is **not green**; do not merge/activate Production based only on TypeScript zero.
- The real **signed-in Merchant Settings** owner acceptance has NOT been performed; the disabled terminal controls need human UI review and profile-saving needs a separate authorized implementation.
- The named connected hosted Profile Staging project lacks pickup foundation/acceptance tables, and no hosted database schema, scheduler, FCM send or backend/permissions were changed in this phase.
- The existing Customer #115/#118, Merchant/API #171/#173/#174/#175/#176/#177 and this PR #178 remain draft/unmerged. Pickup-first, real-order/write gates, card transactions, riders and LocalPay stay disabled pending separate approval.

**Next safe task:** L3-N7B4: eliminate the remaining legacy ESLint issues in isolated batches, with strict regression checks and original UI preservation; separately plan a secure merchant profile-save endpoint and a bounded signed-in Settings/FCM staging acceptance gate before launch approval.
