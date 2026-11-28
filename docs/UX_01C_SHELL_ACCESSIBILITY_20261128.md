# UX-01C — typography, spacing, touch targets and shell investigation

## Accepted input
UX-01B exact head 9aabd2a5e22ea4f5af2553f92b846f8cee94f55c. Four workflows / eleven jobs pass. All 96 measurements reviewed, no clipped text or horizontal overflow in 48 after scenarios. Password 44px and keyboard toggle verified; Merchant 408→320px at 320 viewport; cart clipped label 4→0. Issue mehey9184-maker/LocalEats-Dashboard.2#282.

## Actual component findings at 320px
Home compact and advanced: Sync & Verify 254×40px; Set All Offline 254×40px; Minimalist 87×27px; Advanced 84×27px; View All Activity 77×32px; report download 42×44px. Fonts include 9px and 10px heavy uppercase labels. These are candidates for larger hit areas and readability, not automatic changes.

## Actual shell source investigation
App.tsx fixed h-16 header, offline banner fixed top-16 with flex-wrap, main padding pt-28 / md:pt-32 for offline state; mobile nav fixed bottom, with pb-8 and horizontal scroll. At narrow widths the offline banner can wrap beyond the assumed clearance; investigate measured collision before changing it. Kitchen mode excludes both bars. Desktop arrows and More menu need focus/scroll checks.

## Execution
Audit-only workflow expands 24 existing actual-component scenarios with typography, control dimensions, center hit-testing at 0/50/100% scroll and 12 keyboard steps; outputs source inventory, metrics and screenshots. Findings are candidates until reviewed; center-point occlusion is not a general accessibility verdict. Actual full authenticated app shell remains unmounted: build a safe synthetic auth/read-only harness with no network writes before declaring full shell coverage. Test logged-in/out/closed/open, short heights, banners, cart, settings, keyboard, safe areas, kitchen mode. No application runtime files changed, no deployment/merge, no security or feature changes. R0; existing release blockers remain open.
