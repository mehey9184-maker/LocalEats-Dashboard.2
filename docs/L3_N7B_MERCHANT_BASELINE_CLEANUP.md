# L3-N7B — Merchant Baseline Code Quality: First Safe Cleanup Batch

**Date:** 19 November 2026 · **Scope:** Draft PR #176, independently based on latest L3 Merchant/API draft branch `review/l3-my-kota-private-test-api` at `e4357d14ca399f8d39261974cfd16476eb12283c`.  
**Status:** FIRST BATCH VERIFIED, **overall release quality still blocked**. Not a full baseline cleanup or owner UI sign-off.

## Tested evidence

- Code/test commit: `ac85317b1a0b7049694a4559b210ded0625902a1`.
- [GitHub workflow #44615676126](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/actions/runs/44615676126): **2/2 CI jobs passed**.
- An independent, unchanged L3 checkout was compared with the candidate using identical dependency-lock installations and the same TypeScript/ESLint rules. Both code-path and embedded diagnostic locations were normalized for comparison; no rules or type-checking settings were weakened.
- Original baseline **50 TypeScript diagnostics / 216 ESLint errors**.
- After this batch **41 TypeScript diagnostics / 194 ESLint errors**.
- **9 TS and 22 ESLint errors resolved; 0 newly introduced TS or lint errors.** Full lint/typecheck remain nonzero (not green).
- Core Merchant pickup tests **16/16 passed** including additional untrusted-payload/owner-fail-closed cases; Merchant command recovery **7/7 passed**; unchanged Merchant Vite build passed with pickup disabled.
- Workflow's no-hosted-activation assertion passed.

## Source changes with no UI redesign

1. `src/components/Marketing.tsx`: use the actual persisted `Order.shop_id` (not spoofable shop name), `Order.user_id`, `Order.phone`, `Order.total_price`, and only confirmed `payment_status === 'paid'` for spend. A missing verified shop yields zero scoped orders, not all accounts' orders. The visual layout is unchanged.
2. `src/services/merchantPickupPolicy.ts`: replace explicit `any` with unknown/predicate-checked row records. Preserve the original fail-closed pickup state machine, guarded payment and collection transitions, server total, consent/quote-independent item checks, and UID-matched merchant shop ownership. Additional tests prove malformed payloads/forged items cannot produce a valid pickup order.
3. `src/App.tsx`: remove an unsupported `sonner` toast option; accept the existing persisted notification sound style as the dynamic string it already was at runtime. No new cloud sends or audio track changes.
4. `DashboardOverview`, `OrdersFocusedWorkspace`, `OrdersManagement`: remove unused imports only. Original visual structure and behavior unchanged.
5. `tests/l3-n7b`: capture exact baseline quality categories, enforce **no new** type/lint diagnostics against a separately checked-out unchanged L3 baseline, run core Merchant tests/build without hosted credentials. The diagnostic comparator preserves source/message content and normalizes only CI checkout paths and embedded source line numbers.

## Current baseline diagnostic distribution

| ESLint rule | Remaining errors |
|---|---:|
| `@typescript-eslint/no-explicit-any` | 116 |
| `@typescript-eslint/no-unused-vars` | 52 |
| `react-hooks/set-state-in-effect` | 11 |
| `no-control-regex` | 5 |
| `no-empty` | 4 |
| `prefer-const` | 3 |
| `no-constant-condition` | 2 |
| `@typescript-eslint/no-empty-object-type` | 1 |
| **Total** | **194** |

Most remaining TypeScript diagnostics are in the large `src/App.tsx` and involve cross-provider Firebase/Supabase-like user/session/client types, an unverified legacy `OrderService` symbol, callback contracts, terminal fields, and unsupported/realtime APIs. Additional errors remain in `ConnectivityMonitor` and `OrdersManagement`. **Do not silence them with `as any` or add invented schema fields.**

A visible Orders settings control still references undefined `setLayoutMode`; its corresponding layout state and user-facing behavior need a separately tested correctness fix, not a type-only cast. The terminal integration panel also contains old direct-client shop writes; this phase deliberately did not activate or modify those paths and they require separate schema/authorization review before use.

## Owner and release gates

- [x] Independent review branch and draft PR; original L3/acceptance drafts unmodified.
- [x] Low-risk errors corrected without changing UI visuals or fail-closed pickup contract.
- [x] Source-level tests, original Merchant build, no-new-diagnostic comparison and no-hosted-write assertions passed.
- [ ] Remaining 41 TypeScript errors and 194 ESLint errors need separate small-batch remediation and regression tests.
- [ ] Full authenticated Merchant Dashboard manual UI, real device push, hosted isolated pickup foundation/scheduler/backup and Production activation **not approved**.
- [ ] Acceptance feature PR #175 must be independently integrated/retested against this branch before any future merge.

**Safe next work:** prioritize the `App.tsx` authentication/client adapter boundary and dead layout control with specific tests; then tackle other lint clusters in distinct branches. Never merge directly into main or enable real orders, payments, rider delivery or notification sends to clear quality gates.
