# L4-R1G — Cloudflare Read-Only Workshop and Device Acceptance

**Source branch:** `feature/l4-r1g-cloudflare-readonly-workshop-20261123`. **Status:** an isolated fictional workshop Worker is deployed. Real-device and live business acceptance remain **HOLD**.

## Isolated training preview

**Training-only URL:** https://localeats-r1g-merchant-workshop.mehey9184.workers.dev/

On 23 November 2026, a brand-new Cloudflare Worker `localeats-r1g-merchant-workshop` was uploaded under the existing Cloudflare account, deployment `47887612-4d45-4056-96c0-0b6693529fc2`, version `dc76fbb1-7aea-4d2b-b929-a22270ad25d2`. The dedicated `workers.dev` subdomain is enabled, while per-version Worker Preview URLs are disabled. No production/custom domain is assigned.

This is **not** the existing Merchant Dashboard. It displays fictional shop/menu and browser-memory-only pickup tickets. The script contains exactly four static routes: `/`, `/index.html`, `/workshop.css`, `/workshop.js`. Other paths are 404, non-GET/HEAD methods are 405, requests with a mismatched hostname are 404. Assets are embedded into a standalone Worker with **zero Cloudflare bindings**. No Firebase or Supabase token, external requests, live order actions, push notifications, customer data, geolocation, or payment APIs exist in this build.

The deployed script's verified controls are: exact host, `connect-src 'none'`, `form-action 'none'`, `frame-ancestors 'none'`, CSP self-only script and style, `Cache-Control: no-store`, no cookies/CORS allowances, and no worker resource bindings. These were checked in the Cloudflare account via deployment settings and returned source. The preview is public but has **only synthetic data**.

The separate Cloudflare staging API Worker `localeats-api-cf1-staging` was checked **read-only**. Its `LOCALEATS_PREVIEW_READ_ONLY` setting is `true`, while pickup, profile, availability and pickup-payment write flags are `false`. The standalone workshop does not call that API.

## Reproducibility

- Source files: `preview/merchant-workshop/index.html`, `workshop.css`, `workshop.js`.
- Build: `node scripts/build-workshop-worker.mjs` creates `dist/workshop-worker.mjs`, a single JavaScript Worker with exactly those static assets and the exact workshop hostname.
- Safety test: `node --test tests/l4-r1g-cloudflare-workshop.test.mjs`.
- GitHub workflow `.github/workflows/l4-r1g-cloudflare-workshop.yml` checks no-write methods, identity isolation, CSP, fake orders, no storage, no external requests, HEAD and narrow responsive source rules.
- An isolated Cloudflare preview deployment was made from reviewed branch contents. **Do not run this as a Production merchant app.**
- The browser's playback of actions, UI rendering and HTTP reachability from a real device are **not** proven by the GitHub source test or the Cloudflare deployment state.

## Real-device acceptance (not performed by CI)

Check on an **actual Android phone** (Chrome) using mobile data, then an available iPhone/Safari if possible, plus a 320 px, 390 px and desktop viewport.

1. Open the exact training URL, confirm the clearly visible **READ-ONLY WORKSHOP · FICTIONAL ORDERS ONLY** banner; no sign-in, account details or location prompt.
2. Scroll Overview → Practice orders → Sample menu → Vendor briefing; no clipped content, inaccessible navigation or horizontal scroll at 320/390 px.
3. Tap **Simulate order**, **Accept order**, **Mark food ready**, **Simulate counter payment**, **Mark collected**. The ticket must show a fictional customer and remain clearly labelled FAKE.
4. Try **Mark collected** before payment: there must be **no available action**. Simulated payment must never imply an actual charge.
5. Refresh: all fictional tickets reset to zero. Tap **Reset demo**. At most 15 fictional tickets may exist in one browser session.
6. Verify the page works without sign-in, camera, GPS, push permissions and without customer or merchant secrets. If a notification/permission prompt appears, record **FAIL**.
7. Check the browser Network panel when feasible: no calls to Firebase, Supabase, real LocalEats APIs, R2, payment processors or external image hosts.
8. Optional HTTP safety proof in developer tools: POST to the training origin returns 405; `/api/v1/orders` and `/auth` return 404. Do not send an actual order or sensitive data.
9. On slow mobile data, record page load and action responsiveness. No numbers are invented or counted as passed without a real measurement.

Log results with device/OS/browser, exact URL, date/time, steps, any screenshots without personal information, and a clear PASS/FAIL. **Do not declare real-device acceptance based on desktop simulations.**

## Remaining release gates

- The actual LocalEats Merchant Dashboard, sign-in, new merchant approval, live FCM, GPS, pickup/customer quotation, QR, payout/reporting, restored backup and compliant hosting remain separate from this synthetic demo.
- The staging and Production Supabase schema candidates from PR #237/#238 remain **review-only**; no hosted DDL was applied.
- GitHub Actions independently accessed the deployed Worker through external HTTPS, checked the fictional banner, CSP and no-store headers, received **405 for POST**, **404 for an order API path**, and **200 for the workshop script**. [Hosted HTTP run #45247780680](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/actions/runs/45247780680) **PASSED**. This proves remote HTTP reachability and the tested write restrictions, **not** browser rendering or real-device behavior. A separate Cloudflare Browser Rendering request was rate-limited (HTTP 429), and ordinary browser access within the local tool environment could not resolve the hostname; no remote visual screenshot has been accepted.
- Do not merge drafts, activate real orders, connect the preview to live data or claim customer release readiness.

**Release decision:** isolated Cloudflare training preview DEPLOYED, source and hosted no-write HTTP **PASSED**; actual screen rendering, navigation and real-device acceptance **UNVERIFIED/HOLD**.
