# LocalEats Merchant UX4 — Final smoothness acceptance checklist

**Status:** DRAFT / owner device acceptance pending. This is a code-level regression review, **not** a claim of automated visual/screen-reader/real-device verification.

**Safe target:** the isolated Merchant UX4 Vercel Preview only. Leave Production, backend, shop data and real ordering/payment/campaigns unchanged. The separate M4.2 poster/QR remains pending its own real-phone approval.

## Device matrix

| View | Test | Expected |
|---|---|---|
| Small Android phone (360×800 CSS pixels) | Sign in, navigate and scroll | No horizontal document overflow; bottom nav unobstructed |
| iPhone-sized screen (375×812) | Tap and scroll all core pages | Controls respond; safe-area spacing; menus and dialogs can close |
| Large phone (430×932) | Open more/menu/notification drawer | No background scroll; visible close; overlay doesn't jump |
| Tablet (768×1024) | Change pages and rotate | Readable labels; no overlapping controls |
| Desktop (1366×768 or larger) | Tab/Shift+Tab, Escape and click | Visible focus, no keyboard traps after closing |
| Reduced motion enabled | Repeat page and modal changes | No forced spring/slide motion; content remains functional |
| Dark mode | Repeat across all pages | Legible text, labels, disabled states and focus rings |

## Owner acceptance (mark each in Preview)

- [ ] **Startup / Home:** no incorrect logged-out flash; verified shop and order facts remain stable across same-shop refresh; Home links respond.
- [ ] **Orders:** refresh, search, Current/History, status, sorting, tool menu and exports; touch target ~44px; no real order is created/accepted.
- [ ] **Menu:** type/clear search rapidly, change filters, same-shop refresh doesn't erase verified rows; shop switch never displays another shop's private menu; failed API read gives truthful Retry.
- [ ] **Marketing:** navigation and copy buttons respond; clipboard unavailable doesn't say "Copied"; preview only, no active campaign/discounts. **The separate M4.2 branded poster is NOT included** and still requires phone QR scanning.
- [ ] **Payments / Plans:** tabs are responsive; claims are read-only order facts not payment proof; countdown pauses offscreen, resumes on return, and does not invent expiry.
- [ ] **Settings:** category changes feel consistent; sound/push/dark switches are keyboard accessible and larger to tap; real API connection feedback; no false Test Print success.
- [ ] **Storefront / My Account:** Preview banner explains disabled Save, Upload, Follow and map edits; buttons cannot write shop or account data; location confirmation closes with Escape and keeps focus.
- [ ] **Notifications:** open/close with tap, Escape and keyboard; body behind drawer doesn't scroll; unverified order/menu data never appears as "all caught up".
- [ ] **Guided tour:** copy reflects the pickup-first pilot and Riders coming later; Skip/Next/Back work; on small screens all controls remain scrollable; Escape closes.
- [ ] **Accessibility:** test keyboard focus visibility, screen reader announced headings/controls, at 200% browser zoom, large text settings, and reduced motion; do not claim WCAG or screen-reader compliance until personally verified.
- [ ] **Network recovery:** disable Wi‑Fi briefly; errors must not claim no orders or no menu; re-enable and retry. Do not trigger real writes.
- [ ] **Privacy:** switch between two permitted test merchant accounts and shops; never show the previous merchant's private information, even briefly.

**Suggested field metrics:** INP, scroll jank and long tasks using real browser performance profiling; judge against a good perceived-response target. GitHub CI cannot measure phone FPS or real INP.

## Hold points

1. PRs for UX1, UX2, UX3, UX4 must remain drafts; do not merge before explicit approval.
2. M4.2 remains a separate draft pending visual/poster and physical-phone QR scan acceptance.
3. All UX4 exact-commit Merchant, Pickup/API, cache, order inbox and auth/environment CI gates must pass.
4. UX4 exact-commit Vercel deployment must be READY in branch-scoped read-only Preview, with pickup/payment/demo flags false.
5. Owner must confirm the device matrix and report any failing step before UX4 sign-off.
