# L4-R1F — Vendor Pitch Workshop & Merchant Onboarding Acceptance

Status: **DRAFT / SOURCE-ONLY ACCEPTANCE**. Neither the preview nor public pickup has been deployed or activated by this phase.

## A short, truthful shop-owner pitch (6–8 minutes)

1. **Explain the pilot (30 sec):** LocalEats will let customers find their nearby kota/food shop, browse genuine prices, order for **pickup** and pay at the shop. Delivery, wallets and automatic dispatch are not promised at launch.
2. **Show the shop (60 sec):** Sign in to a consenting **synthetic approved preview shop**, never a real vendor's private account, and show the storefront and menu. Shops require LocalEats approval before appearing publicly.
3. **Practise a fictional order (2 min):** In the approved **read-only Merchant Preview only**, press "Simulate order"; clearly show "**Fake · Test only**". Demonstrate Accept → Preparing → Ready → simulate payment at counter → Collected. No real orders, customer messages, wallets, push or shop availability may be mutated. If the preview is offline, use pre-approved screenshots or a locally run offline demo—do not run production orders.
4. **Marketing (60 sec):** Show shop link/QR flyer and poster options. Scan with a real phone only after link/QR has been checked. Do not claim rankings, marketing reach or revenue.
5. **New shop setup (60 sec):** Describe business details → location on map/GPS → opening hours + shop photo → submit → pending approval. **Never promise instant approval.** Do not register vendors during a non-production pitch unless explicitly asked and a properly secured enrollment environment is ready.
6. **Questions (60 sec):** Explain merchant permissions, pickup-only pilot, support/recovery, shop pricing/terms that have actually been approved, and the current fact that real public orders have not launched.

## Security & demo preflight

- Build from this reviewed draft branch. **No direct merge or production deploy.**
- Frontend demo requires `VITE_MERCHANT_PREVIEW_READ_ONLY=true`, `VITE_MERCHANT_FAKE_ORDERS_ENABLED=true` and `VITE_PICKUP_ORDERING_ENABLED=false`.
- Vercel preview remains restricted to the pre-existing exact deployment hostname pattern. For **Cloudflare Pages**, set `VITE_MERCHANT_PREVIEW_CLOUDFLARE_HOSTNAME` to the exact approved `*.pages.dev` hostname (never a wildcard, production domain or arbitrary custom domain). **This change does not deploy or select that host for you.**
- Host an isolated **server read-only Preview** using `LOCALEATS_PREVIEW_READ_ONLY=true`; the existing API `previewReadOnlyGate` must block POST, PUT, PATCH and DELETE. Never allow the preview to point to unrestricted live write credentials.
- Use only synthetic merchant, items and customer names. Real customers, order histories, phone numbers, addresses or Firebase tokens must never appear on a projector.
- Fake cards stay in memory, are bounded to 60, use fake IDs, and do not appear in order exports, real totals or the production database.
- The view-only demo does not validate GPS, actual device push, printing hardware, public customer checkout, pay-at-shop handover or backup restorability.

## Acceptance matrix

| Check | Automated scope | Real-world gate |
| --- | --- | --- |
| Signup validation | Phone and password rules, authenticated API onboarding contract | New consenting merchant account on real phone |
| Merchant shop submission | Business, map/GPS, hours, image and protected API submission source guards | Test pending approval → explicitly approved shop |
| Seller tour | No premature rider/revenue promises, accessible narrow-screen dialog source | Visual review at 320px, 390px and desktop |
| Sample order | Bounded, local fake actions; no persistence | Approved exact Cloudflare/Vercel Preview with demo visibly labelled |
| Marketing flyer | Clear educational tour, existing QR tooling | Genuine QR scan to correct verified shop |
| Notification | No false arrival claims | Real phone background/system FCM receipt |
| Shop ownership | Shop owner server checks, no-shop/pending gate | Two merchants plus unrelated customer |
| Release | CI source tests, read-only adapter proof | Hosting, restorable backup, fresh production acceptance, explicit approval |

## Meaning of "ready"

- **Ready to pitch** means a reliable accessible demo (or approved offline fallback), honest walkthrough, vendor FAQ, clean synthetic data, and a way to follow up. It **does not** mean public ordering is live.
- **Ready for public pickup orders** requires reviewed code merged through release gate, approved/restorable hosted database and commercial hosting, real-device GPS and push, vendor approval, one actual consenting shop/customer pickup with real cash/card at shop, rollback, and explicit owner signoff.
- **Full LocalEats ecosystem** (Rider/LocalPay/etc.) is future scope and must not delay a safe pickup-first launch.

Release status: **HOLD**. No permissions granted, no migration applied, no hosted write flag enabled, no real order created.
