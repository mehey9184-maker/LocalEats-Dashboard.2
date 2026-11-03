# Customer Profile P5 — Catalog CORS for isolated Preview only

**2026-11-03. Draft API Preview branch:** `repair/customer-p5-catalog-preview-cors-01`, based on `repair/push-both-sides-api-preview-01`. Customer app's P5 source branch is `repair/customer-profile-p5-staging-auth-readiness-01`. Do not merge to Production or widen other domains.

## Investigation
P5 Customer Preview originally had no `VITE_LOCALEATS_API_URL`, which made every catalog request fail with "Ordering service is not configured." The established Customer integration Preview already uses public pickup catalog reads from `https://localeats-api-git-repair-push-e6ad53-mehey9184-makers-projects.vercel.app`. The connected API returned 9 shop records and a successful nearby pickup catalog read for coordinates from its own shop metadata; `My-Kota` appeared with one menu item. **No shop records were deleted.**

After the P5 Customer Preview was configured with this URL and `VITE_PICKUP_ORDERING_ENABLED=false`, the API's strict CORS allowlist was found to contain the Customer integration Preview origin only. The P5 browser origin was not allowed. This branch introduces `CUSTOMER_PROFILE_STAGING_ORIGINS` as an optional **Preview-only, exact-origin allowlist of at most two** Customer P5 Vercel URLs. Invalid, wildcard, path-bearing, lookalike, and Production uses are rejected. Existing Customer integration origin and Merchant preview origin checks remain unchanged.

## Deployment and safety
Set this API project variable on the new API branch's **Preview target only**, not Production:
- `CUSTOMER_PROFILE_STAGING_ORIGINS` = two exact P5 URLs: the immutable deployment URL and the P5 branch alias, comma-separated
- `CUSTOMER_APP_ORIGIN` = established Customer integration Preview origin (retain existing allowed access)
- `PICKUP_WRITES_ENABLED=false` and `PICKUP_PAYMENT_SETTINGS_WRITES_ENABLED=false` (never create real test orders)

The Customer P5 Preview should then reference the resulting **new isolated API Preview deployment** in its branch-specific `VITE_LOCALEATS_API_URL`. Keep `VITE_PICKUP_ORDERING_ENABLED=false`, `PROFILE_P5_ENABLE_STAGING_WRITES=false`. Do not change Customer Production, current integration Preview alias, existing API Preview alias, Supabase data or Merchant/Rider apps.

## Validation
Run `npm test` in `localeats-api/`, CI and CORS origin tests, deploy an isolated API Preview, verify a read-only pickup catalog response and menu response, then redeploy the P5 Customer Preview with its new API URL compiled in. Browser-based CORS and geographic-radius checks should be manually confirmed on the exact P5 URL. An individual shop can remain excluded if closed/inactive, lacks valid coordinates, or is outside the real user's 4 km radius; never invent a customer's position or mark a shop approved without authorization.

**Only branch-specific Preview changes; no live ordering or persistent production modifications.**
