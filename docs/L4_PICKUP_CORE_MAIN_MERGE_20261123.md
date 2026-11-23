# L4 Pickup Phase 1 — safe merge of Merchant/API core into original UI

**Branch:** `release/l4-pickup-core-main-20261123` at L4-R1D, assembled from previous draft PRs #233–#236. This is a **source integration**, not a public-order activation.

**Core content:** cross-repo catalog allowlist, pickup action feedback, existing Orders Switch repair, type/lint cleanups, verified pickup policy and stable API contract. This release candidate intentionally **does not** include newer PRs #237 (profile persistence, requiring hosted schema) or #238 (merchant shop onboarding schema and altered tour), nor #239's standalone training workshop. They remain separate for an approved database and UI-safe follow-on.

**Visual guarantee and limits:** existing Merchant App, ShopProfile, OnboardingTour, MenuManagement, Marketing, OrdersFocusedWorkspace and OrdersStyleBoard source className sequences match the saved premerge `main` SHA `10556f752aa93622d5b20237ea3860ed2bd68f76`, as asserted by `tests/l4-pickup-core-ui-freeze.test.mjs`. DashboardOverview had unreachable legacy code pruned with 108/108 earlier equivalence assertions; review actual phone visual acceptance before asserting complete equivalence. Pickup actions and existing Orders Switch are deliberately repaired in place, not redesigned. No new layout/brand/flow is authorized.

**Checks required before merge:** GitHub actions integrated API (all API tests, protected preview routes), Merchant (existing pickup and UI regressions plus freeze), actual pinned Customer→compiled API loopback, TS, lint and build. No deployments from CI.

**Backups for code rollback:** Merchant `backup/pre-l4-merchant-main-20261123`; Customer `backup/pre-l4-customer-pickup-main-20261123`. A Git code backup is not a database backup.

**Flags and actual launch:** Verified Vercel Production flags on 23 Nov: Customer `VITE_PICKUP_ORDERING_ENABLED=false`, Merchant `VITE_PICKUP_ORDERING_ENABLED=false`, API `PICKUP_WRITES_ENABLED=false`, API `MERCHANT_AVAILABILITY_WRITES_ENABLED=false`. Keep all OFF on code merges. Do not apply draft SQL in Production or enable real customer writes without a restorable database backup, canonical migration verification, correct API/Customer/Merchant deployment, shop-owner consent, authenticated near-shop pickup test, actual phone GPS, push receipt and commercial-eligible hosting. No rider, wallet or online payment.

**Release decision:** merge eligible after source tests pass with exact main baseline; customer-facing real pickup remains gated.
