# Merchant Workshop Demo — automated preview-only pickup training

**Prepared:** 23 November 2026 · **Status:** draft source review only. Not released to any customer/vendor Production app.

## Founder goal

Let a shop owner **watch a busy example kitchen** while the founder pitches LocalEats: new fictional food orders arrive, the example merchant accepts them, the food is prepared, the customer sees a simulated Ready update, the customer pays at the shop, and the food is handed over. It should feel alive but never trick anyone into believing orders or payment are real.

## Reuse the existing fake-order sandbox, do not build a second order system

The Merchant Orders page **already** exposes `PreviewFakeOrderTrigger`, `PreviewFakeOrderCard`, and `usePreviewFakeOrders` for manual local-only pickup testing. We add a **Workshop Demo** launcher alongside the existing fake-order controls on that page. The existing manual tester, real-order management, order statuses, printing, data fetch, shop ownership and other tabs are **unchanged**.

The new `MerchantWorkshopDemo` is its **own portal/dialog**, driven by the small pure `merchantWorkshopDemoEngine`. It intentionally does **not** write to the existing fake order hook or its real order queue. This prevents demonstrations from contaminating status counts, exports, merchant analytics, local storage and receipts.

## Workshop behavior

- A clearly visible **“Demo only · No real orders”** banner stays on screen.
- The fictional sample ticket shows an obvious `DEMO-` ID, “Sample customer”, sample kota/chips items, and **example** rand amounts. No real shop photos, personal information or fabricated customer reviews.
- A 2.2-second **demonstration tick** moves tickets through New → Accepted → Preparing → Ready → Collected. This is sped-up **animation**, not a claimed production processing time or performance benchmark.
- New fictional orders arrive regularly and are bounded. Old completed tickets and activity events are discarded to avoid endless memory and CPU growth.
- The user can **Pause, Resume, Next step, Restart or Close**. The timer stops when paused, after unmount, or while the browser tab is hidden.
- A separate on-screen event feed narrates the work. **No actual Firebase Cloud Messaging push, browser notification, bell audio, printer, GPS, payment or order state is invoked.**
- Mobile-responsive columns, keyboard controls, escape-to-close, focus restoration and motion-reduced pulse styling.

## Strict Preview/Production boundary

The existing `isMerchantPreviewSimulatorEnabled()` guard has **not been modified**. It requires all of:
- `VITE_MERCHANT_PREVIEW_READ_ONLY === "true"`
- `VITE_MERCHANT_FAKE_ORDERS_ENABLED === "true"`
- `VITE_PICKUP_ORDERING_ENABLED !== "true"`
- the previously approved, **exact Vercel review-preview hostname pattern**.

The trigger and modal both check this guard. **It will not appear on dashboard.localeatssa.co.za**. If the founder later wants a shareable vendor demo that works on Cloudflare or without a merchant login, treat that as a distinct feature/security/deployment approval — **do not broaden the host gate silently**.

No new backend, API calls, secrets, Supabase access, real account creation, FCM, cost, Cloudflare Worker, Vercel deployment or database migration was authorized. CF2-E staging backup remains blocked; this workshop is independent.

## Acceptance gate before anyone calls the feature pitch-ready

1. Exact-head GitHub CI: run `node --experimental-strip-types --test tests/merchant-workshop-demo.test.mjs` and Merchant TypeScript/Vite build. Verify previously existing manual fake-order flow remains intact.
2. In a **separately authorized isolated preview deployment** with the existing strict host/environment gate, visually inspect at 320px, 390px and desktop; open Orders → Workshop Demo; watch 25+ ticks; pause/resume/restart, close, press Escape and tab through buttons. Test prefers-reduced-motion and tab-hidden pause.
3. Confirm with DevTools that no network, Supabase, Firebase, print, browser notifications or persistent storage events are produced by the workshop actions. This cannot be claimed by source-only testing alone.
4. Show the demo to a consenting vendor and say: “This is a fictional demonstration of how pickup orders **would** move through LocalEats; live orders are not activated yet.” The demo is **not** proof real orders work.
5. Only after review may the founder separately authorize deploying/merging the demonstration. It does **not** authorize live customer pickup orders, payment handling, merchant signups or expanding into delivery.

[Founder operating charter](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/blob/cloudflare/cf1-merchant-api-staging-20261122/docs/LOCALEATS_FOUNDER_CHARTER.md) · [Vendor pitch readiness](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/blob/cloudflare/cf1-merchant-api-staging-20261122/docs/LOCALEATS_VENDOR_PITCH_AND_LAUNCH_GATES.md) · [Canonical handoff](https://github.com/mehey9184-maker/LocalEats-Dashboard.2/blob/cloudflare/cf1-merchant-api-staging-20261122/docs/LOCALEATS_PROJECT_MEMORY.md).
