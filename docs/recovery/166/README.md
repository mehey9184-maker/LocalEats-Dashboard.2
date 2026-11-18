# LocalEats pickup audit recovery · issue #166

This checkpoint preserves the interrupted work. Authenticated hosted Preview, live push delivery and launch approval remain pending.

## Recovered workspaces

- Customer: `work/LocalEats-Customer-Audit`, from `audit/customer-pickup-consent` at `1688c5a4bebeea65cb01c3b6d37cd4f589a212c8`, the head of Customer #103. Recovered `CookieConsentBanner.tsx`, `SplashScreen.tsx`, `index.css` and the functionality notes. The draft targets #103's review branch so the existing icon and discovery changes are inherited without being duplicated.
- Merchant/API: `work/LocalEats`, from `audit/merchant-pickup-accessibility` at `de3affa7e87fe21bd8f13921fa7140635b195f20`. Recovered `SignIn.tsx` and the functionality notes. The two generated PWA icons and working copy of the API fixture remain in the local workspace.
- Merchant #162 contains notification changes. #165 contains navigation and typography changes. #164 contains a review-only collection contract. None were copied into the Merchant recovery branch. #162 also appends to the functionality document, so reconcile both documentation additions if they are later brought together.
- No business API source was modified. [Browser fixture patch](browser-fixture.patch) preserves the two changes to the untracked copy of the existing synthetic journey fixture. The original untracked files and original logs remain in the workspace.

## What the pickup journey actually proved

The original tool execution exited 0 and printed `PICKUP_TWO_CLIENT_HTTP_POSTGRES_JOURNEY_PASSED` after `PICKUP_REVIEW_SOURCE_HASH_VERIFIED`. The original standalone terminal transcript was recoverable from the task record. The direct database read was independently recovered in [aggregate evidence](db-aggregate.txt).

- **Submission and idempotency**: the real Customer adapter sent a server-priced, zero-fee pickup. The first response was deliberately lost after commit. The next request with the same intent returned a replay and the database held exactly one order for the key. The API rejected creation by the other test identity.
- **Merchant acceptance and preparation**: the real Merchant adapter saw the order, accepted the expected revision and returned an accepted command receipt. Customer read back Preparing. A different merchant's accept was denied.
- **Ready**: merchant command replay returned the same receipt. The Customer inbox held exactly one Ready event and a different account could not see it. This checked an authenticated inbox read and replay deduplication. Cloud FCM and OS push display were not exercised.
- **Payment, handover and collection**: attempting collection while unpaid failed. Recording payment at the shop left the order Ready and marked it paid. A merchant handover command then collected it, and a fresh Customer adapter saw Collected with five events. This is the current merchant-side contract. Customer receipt confirmation was not implemented or tested. Merchant #164 describes the separate three-proof flow required for release.
- **Other security and recovery**: customer cancel and merchant reject reached Cancelled. Expired and cross-account reads failed. Simulated database failure and closed-shop submission failed. No generated pickup order had delivery or rider fields.

The database totals include setup fixture rows and multiple synthetic branches. They corroborate state persistence and do not replace the per-idempotency-key assertion.

## Browser evidence

- Hosted review checked Customer welcome, the small-screen navigation and location-required state, and the guest Orders sign-in guard. At 320px the Customer nav measured about 58.5px tall with 11px labels. It exposed Home, Discover, Map, Orders and Profile. Customer uses Inter body styling and Outfit headings. Merchant hosted sign-in at 390px exposed the original eye icon without an accessible name.
- In the loopback harness, the recovered Merchant Show password and Hide password controls passed keyboard checks at 320px and 390px, with visible focus and a 44×44px target. The Customer wording passed a browser check. The first-visit Log In hit test passed at 390px and **failed at 320px** because the privacy notice intercepted pointer events.
- Screenshots show the entry screens and the failure only. The sandbox blocked remote image and font requests, so local screenshots can show fallback fonts or a missing Customer hero. Hosted screenshots showed the hero. The interrupted browser run did not reach signed-in tracking, merchant Orders or counter handover screens.

See [control results](controls.txt), [measurements](measurements.json) and the [screenshots](screenshots/).

## Regression results

- Customer recovery rerun: 136 tests, TypeScript, and build passed. Six Firestore deployment guard tests also passed in the original run. Three emulator-dependent Firestore cases failed with a blocked loopback connection. The emulator itself was not started during recovery.
- Merchant recovery rerun: 51 focused regression tests and build passed. Repository-wide TypeScript exited 2 with the same 50 diagnostics as the baseline after normalizing paths and line numbers.
- API original audit: 229 API suite tests and 11 explicit Preview guard and merchant push endpoint tests passed. These tests did not deliver live notifications.
- Browser control test intentionally exits nonzero with the unresolved 320px overlap. The reproduced result is in [controls.txt](controls.txt). To rerun with the isolated fixture available, copy [browser-controls.mjs](browser-controls.mjs) into the parent of the two named audit checkouts and use the existing synthetic API and identity server.

## Setup and cleanup

The original Windows run created a fresh PostgreSQL 17 cluster under `work/pickup-audit-pg`, bound it to `127.0.0.1:55471` only, and verified the resolved data directory before connecting. `pickup_audit_http_v3` ran the HTTP journey. `pickup_audit_ui_v3` held the initial browser fixture. There were no cloud credentials. The reviewed SQL hash check passed. The first Windows attempt failed the exact function-body guard because of CRLF. The successful run copied the tracked SQL to scratch with LF and left the hash guard enabled. Because the fixture roles are cluster-wide, the rerun verified the three existing synthetic role attributes and removed only repeated role-creation statements from the scratch schema copy.

The checked-in harness is `localeats-api/tests/pickup/journey.mjs`. It uses two actual client adapters and real Express/SQL, with synthetic authentication and a local SQL bridge in place of cloud providers. The test process enables writes to its disposable fixture only. The verification of the recovered browser controls kept ordering off. Test-only listeners at ports 4000 and 9099 shared one process. The Firefox/Safari, Firestore emulator and concurrent SQL race checks have no successful results in this recovery.

The local fixture API, synthetic identity server and PostgreSQL cluster were stopped after the checks. Their files were retained. The raw workspace, original generated icons, captured PostgreSQL files and raw logs remain local. The committed screenshots and evidence were reviewed for account and credential data. The recovery runs did not contact Production data or send real push notifications.

## Retest before launch

- [ ] Fix and verify the first-visit Log In hit target at 320px, then repeat at 390px and with larger text.
- [ ] Align Customer #103, Merchant #165 and notification #162 on a verified isolated candidate and check authenticated screens on both viewports.
- [ ] Verify authoritative order submission, inbox recovery, foreground and background push on isolated devices.
- [ ] Implement and verify the three independent collection confirmations from Merchant #164 before using it as a release gate.
- [ ] Run the Firestore emulator and concurrent SQL release checks. Verify deployed schema and security separately.
- [ ] Obtain explicit go-live approval before Production deploy, merge or activation.
