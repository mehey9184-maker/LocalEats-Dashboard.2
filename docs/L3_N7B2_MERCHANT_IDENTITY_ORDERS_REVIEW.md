# L3-N7B2 — Merchant Identity, Adapter Types & Orders Layout Review

**Date:** 19 November 2026 (South Africa). **Draft PR:** #177.  
**Base:** verified L3-N7B first batch, draft #176 (`review/l3-n7b-merchant-baseline-quality`). **Status:** review-only, no hosted activation.

## Changes made

1. **Session identity boundary.** `merchantSessionScope.ts` validates the locally projected user ID against the currently authenticated Firebase UID before `App.tsx` applies a cached/display session. Metadata or a cached ID cannot grant access to another shop; existing `resolveMerchantShop` API ownership checks remain authoritative. `src/lib/supabase.ts` documents the Firebase-backed session listener's real typed `{user,access_token}|null` shape rather than `unknown`; no new privilege is assigned from metadata.
2. **Adapter contracts, not fictitious Supabase clients.** `useAppInitializer` now uses the existing LocalEats `User` type and no longer declares a dormant SupabaseClient property. `Marketing` accepts the same LocalEats user. `ConnectivityMonitor` accepts the locally implemented `from`/`removeChannel` adapter and narrows actual subscription status; unknown status displays a degraded-channel warning rather than casting to a Supabase realtime channel.
3. **Untrusted service errors.** `merchantAdapterError.ts` checks object shapes before reading a code/message. App heartbeat, delivery settings and availability warnings use this typed fail-closed representation rather than assuming `unknown` errors have `.message` or `.code`.
4. **Real Orders layout switch.** The existing mobile **Layout → Switch** now actually changes between the original Kanban grid and a one-column list of the same existing cards. Original Kanban is the default. No new cards, new ordering fields, alternate orders backend or changed CSS theme were introduced. Browser test now taps Switch and restores the original default.
5. **Delete All safeguard.** The previously broken legacy call to `OrderService.deleteAllOrdersForShops` (direct client-side deletion) is no longer reachable from `App.tsx`. The original button fails closed with a plain warning; no orders are deleted. The now-unused original confirmation state was removed. Any future retention/deletion must be server-authorized and separately approved.
6. **Minor compile fixes.** Browser Bluetooth detection uses property presence; marketing preferences are boolean-validated. No changes to pickup/payment/FCM/rider activation flags.

## Evidence

- [Independent CI quality comparison (run #44618674716)](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/actions/runs/44618674716): baseline **41 TS errors / 194 ESLint errors** vs updated **19 TS / 192 ESLint**, **0 newly introduced** TypeScript or lint errors after typed adapter and safety fixes. This is the full repository comparison, with no ESLint/TypeScript rule suppression.
- [CI rerun with actual interactive Orders layout test #44618903149](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/actions/runs/44618903149): full browser acceptance **pending at report creation**. Do **not** claim its result passed unless job completes successfully.
- Original full Orders-page Chromium test confirmed in first L3-N7B2 run #44618227650, while its initial diagnostic comparison failed on three newly introduced findings; those were corrected and final comparison is green.
- `tests/merchant-n7b2-contracts.test.mjs` validates Firebase UID/account switching, narrowed adapter errors, original layout default, functional switch wiring and fail-closed legacy bulk deletion.

## Outstanding release gates

- Full Merchant lint/TypeScript are **still not clean**: 19 TS / 192 lint remain. Some relate to legacy session/provider conversions and a direct Firestore/Supabase compatibility bridge. Do not invent schemas or cast `as any` to bypass these.
- A separate full authenticated Merchant Orders website walkthrough and real Firebase/Windows foreground/background push acceptance remain unverified by an offline test fixture.
- The connected hosted Profile Staging project still lacks the approved pickup foundation/acceptance objects, and no scheduler/hosted migration has been activated.
- This PR #177 and upstream drafts #176/#175/#173/#171/#118/#115 remain **DRAFT / UNMERGED**, with Production, real order/payment, rider dispatch, FCM sends, cron and hosted databases unchanged.

**Next safe step:** complete the new full-page browser CI gate, then tackle remaining baseline errors in small independent tested commits. Obtain owner UI acceptance before any merge or real-order activation.
