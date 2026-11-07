# LocalEats Pickup R3.5 — Effective-schema recovery, source-integrity and Preview acceptance gate

**8 November 2026. INERT and disposable. No Production, Supabase hosted staging, real customer or live-order changes.**

## Summary and definition of done

R3.5 audits the actual remote migration history and observes the missing payment-method SQL behavior using **read-only `pg_catalog`** queries, then exercises **only the reconstructed effective behavior** with the ORIGINAL checked-in pickup foundation, zero-fee and merchant-availability drafts in a local disposable PostgreSQL 17 container. It also checks a **schema-only** backup/restore of this offline reconstruction and runs current pinned Customer source/browser tests.

**Status is deliberately PARTIAL:** The locally rebuilt structure is not a full Production-equivalent schema. Manual deployed Customer/Merchant Preview visual acceptance has **not yet occurred**. This phase may be merged as test-only safeguards, but it must **not** be interpreted as the public launch or full R3.5 sign-off.

## Actual remote migration inventory — metadata only

The main LocalEats Supabase migration catalog showed 8 applied versions (verified 8 Nov 2026):

| Version | Applied migration | Source in repo | Reproducibility |
|---|---|---|---|
| 20260921085319 | align_order_shop_ids | versioned migration | Present |
| 20260926193602 | rider_access_prerequisite | versioned migration | Present; rider functionality still disabled |
| 20260926194744 | rider_onboarding_pairing_authority | versioned migration | Present; rider functionality still disabled |
| 20260926202836 | rider_pool_verification_authority | versioned migration | Present; rider functionality still disabled |
| 20261030111305 | pickup_launch_foundation | `supabase/drafts/pickup_launch_foundation.sql` | Draft body only, not versioned |
| 20261031073608 | pickup_zero_fee | `supabase/drafts/pickup_zero_fee.sql` | Draft body only, not versioned |
| 20261031073645 | merchant_availability | `supabase/drafts/merchant_availability.sql` | Draft body only, not versioned |
| 20261101160331 | pickup_payment_methods | no original SQL; `r35/effective-payment-methods.SYNTHETIC_ONLY.sql` | Observed effective behavior only, **original historical migration unknown** |

The machine-checked `reproducibility-manifest.json` records **`complete:false`**, all 8 applied versions, and the precise 4/3/1 source classifications. The Node regression fails if anyone silently marks the migration chain fully recreated or invents a versioned historical migration.

**Do not rename reconstructed test SQL into `supabase/migrations`**, and do not use the remote `repair`, `push`, `apply_migration`, or any schema-writing command here. Obtain the original audited SQL from prior source/release records if available. A later verified schema-only export could support an *effective baseline* but cannot prove the exact historical migration file.

## Reconstructed effective payment-method contract — NOT original migration source

Read-only remote PostgreSQL metadata identified:
- `public.shops.pickup_payment_methods`: nullable `text[]` with no default;
- `shops_pickup_payment_methods_valid`: **NOT VALID** CHECK, enforcing a 1–2 element array containing distinct `cash` / `card_machine` values (or NULL for historical data);
- `pickup_payment_method_before_insert`: enabled BEFORE INSERT guard on `public.orders`;
- `public.pickup_payment_method_guard()`: SECURITY INVOKER with empty search_path and **no anon/authenticated EXECUTE**; `prosrc` normalized MD5 `adcd87f7cb49525cd18876c8b2cd057a`;
- `public.merchant_set_pickup_payment_methods(text,text,text[],text[])`: SECURITY INVOKER with empty search_path and **no anon/authenticated EXECUTE**; normalized MD5 `149d5a7fbe51f29561800479b1c2ca2c`. The function requires a trusted service-role caller, the current owner UID and an expected old-methods array to prevent stale writes.

`effective-payment-methods.SYNTHETIC_ONLY.sql` reproduces these OBSERVED current functions, column, trigger, CHECK and narrow function grants **inside the disposable container only**. If its normalized function sources differ, CI fails. This is not a proposed new Production migration and is not a guarantee that the exact original ALTER/GRANT sequence has been recovered.

The tests prove that a shop with no configured methods cannot accept a new pickup; only the merchant can configure valid methods through the controlled function; duplicate, unknown or stale settings fail; switching from `cash,card_machine` to `cash` prevents new card-machine orders while allowing cash orders and preserving completed order history. The ORIGINAL, unedited R3.4 pickup create → Accepted/Preparing → Ready → push queue → cash confirmation → Collected tests still run.

## Schema-only local restoration

The `run-local-pickup-r35.sh` script:
1. Creates a temporary Docker `postgres:17-alpine` database with synthetic baseline tables and non-login client roles. It publishes no PostgreSQL ports and has **no connected credentials**.
2. Applies unmodified repository `pickup_launch_foundation.sql`, `pickup_zero_fee.sql` and `merchant_availability.sql`, then the separate offline-only effective payment-method contract.
3. Runs original R3.4 E2E and additional payment-method authorization/consistency tests using fake shops, customer IDs, locations, menu item and nonfunctional FCM subscription.
4. Executes a **schema-only** `pg_dump -Fc -n public` of the SYNTHETIC DB, restores it into a **different empty database inside that container**, and verifies there are **zero data rows**, expected RPC source fingerprints, triggers, RLS, NOT VALID check and service-role vs client-role EXECUTE grants.
5. Automatically deletes both databases with the Docker container. No remote backup was taken or restored.

This tests the *replay mechanics*, not a verified full Production backup, browser sessions, actual FCM send, user authentication, Supabase Auth/Realtime/Storage or deployed cloud routes.

## Preview UX evidence and owner acceptance — NOT YET SIGNED OFF

For a low-cost, safe Customer inspection, the R3.5 CI workflow checks out the exact Customer main source commit **`01069d9e6db41325c4ad9a086a0148efa32edce7`** and runs selected pickup, guest-to-login, auth startup, closed-shop browse and nearby-caching tests with `VITE_PICKUP_ORDERING_ENABLED=false`. It also runs a local isolated **Chromium startup fixture with all external requests blocked**. This proves only the tested isolated *source and browser fixture*, **not the deployed Preview experience**.

The Merchant main source at phase start is **`65c82d7d49abd100e8ac7caf973df038ab08aa9a`**. The most recent readily available Vercel Merchant Preview checked in this phase was READY for a **different prior commit**; a READY status does not prove the current main UI or user actions work. The existing Merchant/API PR release gate provides regression evidence, but not manual Preview acceptance. The existing two-app PostgreSQL workflow also pins an older Customer commit than current main; R3.5's current-pinned Customer CI improves source coverage but does not update production routing.

Owner's real **Preview-only** acceptance checklist, with screenshots and no live orders:
- [ ] **Login/startup** — signed-out users go to Login; signed-in refresh stays on Home without startup flash.
- [ ] **Guest profile** — a guest attempting personal data entry is routed to Login; no silently saved fake profile.
- [ ] **Customer Home** — original My-Kota card is unchanged, nearest shops are sorted, loading isn't blank or blinking, no manual red pin, and 4 km boundary is explained without hiding real nearby shops.
- [ ] **Closed shop** — menu and prices remain browsable, while Add/Buy/real checkout is disabled.
- [ ] **Cart/checkout** — real menu/cart works, pay-at-shop cash/card-machine rules are clear, and “Simulate test checkout” creates **no actual order**.
- [ ] **Merchant Settings** — Storefront entry opens, required fields are understandable, and merchant's selected payment methods are visibly correct.
- [ ] **Merchant Orders** — no top overlay hides incoming orders; test-only/isolated Pickup → Accept → Preparing → Ready → collection has no real Production write.
- [ ] **Notifications** — the real Firebase push/reconnect timing is assessed **only** on a separately authorized staging setup; R3.5's fake FCM event is not evidence of real delivery.
- [ ] **Riders and delivery** — pages remain “Coming soon,” no activation, fees, online checkout or dispatch controls.
- [ ] **Failure recovery** — refresh and offline/reconnect do not duplicate orders, unexpectedly change the card or leave stale buttons.

**No screenshots were captured and none of the above checkboxes is marked passed by this phase.** A real browser session, correct exact-commit Preview deployments and explicit owner acceptance will be required. Do not use Production to create test orders.

## Live-security blockers found, unchanged

- The current `public.payments` RLS policy `Payments access` grants `authenticated` role `ALL` with `USING true` and `WITH CHECK true`, with table-level INSERT/UPDATE/SELECT privileges. This needs a separately reviewed, reversible security remediation and regression tests before public launch.
- `public.shops` table-level and column-level grants appear broad (even `anon` has `UPDATE` privileges on `pickup_payment_methods`), **but the actual RLS policy is SELECT only** and blocks ordinary browser UPDATE unless another policy/privileged context exists. Do not claim the table privileges alone demonstrate successful client-side writes. Review the role/grant and any security-definer execution boundaries rather than blindly editing Production.
- Some unrelated custom publicly executable `SECURITY DEFINER` functions were flagged in R2.7. Review specific execution arguments/search_path and ownership separately. Neither issue is fixed in this test-only branch.

**No Supabase policy, function, application runtime, real orders, Firebase projects, billing, payout, Rider or Delivery changes are permitted in R3.5.**

## Status and next recommendation

R3.5 yields a truthful migration-source inventory and a tested locally reconstructed payment-method/zero-fee pickup path. It does **not** make the whole Production schema fully reconstructable, and actual deployed Preview acceptance is pending. Keep the pickup public-launch readiness figure at its previous estimated ~60% until a fresh end-to-end owner-verified release audit.

Next **R3.6** should recover/reconcile the missing original migration sources (or explicitly approve a new schema-only effective baseline) with privacy-safe on-prem tooling, then capture actual Customer/Merchant Preview screenshots for manual signoff. Only after restoring an approved pickup-capable full staging clone should real Firebase push or intentionally written test pickup orders be tried.

References: [Supabase local workflow](https://supabase.com/docs/guides/local-development/cli-workflows), [Supabase managing environments](https://supabase.com/docs/guides/deployment/managing-environments), [Supabase Data API security](https://supabase.com/docs/guides/api/securing-your-api), [PostgreSQL 17 backup](https://www.postgresql.org/docs/17/backup-dump.html).
