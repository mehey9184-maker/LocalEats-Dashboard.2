# LocalEats R3.8 — Merchant shop gate: Preview API outage and separate payments RLS hardening

**8 November 2026 — Verified branch-scoped Preview repair. No Production settings, shop data, payments, orders, user accounts or migrations altered.**

## 1. Screenshot and source-code diagnosis

The user reported the Merchant screen: **“We couldn't verify your merchant shop. Please check your connection and try again.”** with Retry and Sign Out. This is an intentional *fail-closed* shop ownership guard. `src/App.tsx` waits for `MerchantApi.getMerchantShop()`, which authenticates with the current Firebase ID token and performs `GET /api/v1/merchant/shop`; the server checks the Firebase identity then filters authoritative shops by owner UID. A failure clears untrusted cached authority. Do not bypass this check, fabricate a shop, or insert customer data.

**A concrete R3.7 Preview configuration problem was confirmed:**
- Merchant Vercel default `VITE_LOCALEATS_API_URL` for Preview still referred to `https://localeats-b8q20qm47-mehey9184-makers-projects.vercel.app`. Vercel lookup for this deployment returned **not found / no access**, which is consistent with a broken network request. This alone does not prove which specific browser request failed in the user's screenshot because the screenshot did not include the address bar/network trace.
- The default branch-scoped Preview configuration was **missing** `VITE_MERCHANT_PREVIEW_READ_ONLY=true`, which meant the existing dashboard heartbeat was not guaranteed disabled on the R3.7 review branch.
- The known-good **API Preview**, `dpl_8SksKaK4qCbKsUuBh5qEoMb3vzzb`, source `eddb261a6c5813af641cedc7e0b88ca15c6c551e`, at `https://localeats-3g6iqj2ky-mehey9184-makers-projects.vercel.app`, was verified READY and `GET /health` returned HTTP **200** with the expected `localeats-api` identifier. Vercel API Preview source includes `previewReadOnlyGate` BEFORE all merchant/order routes; all mutation HTTP verbs return 503 while `VERCEL_ENV=preview` and the branch `LOCALEATS_PREVIEW_READ_ONLY=true` and `PICKUP_WRITES_ENABLED=false` are present. The API CORS code accepts the exact known Merchant deployment hostname prefix/suffix, as configured on the API project.

**Branch-only fix already applied to Vercel:** Four variables were created for the **single** Merchant branch `review/r37-exact-main-readonly-preview-20261108`:
`VITE_LOCALEATS_API_URL=https://localeats-3g6iqj2ky-mehey9184-makers-projects.vercel.app`,
`VITE_MERCHANT_PREVIEW_READ_ONLY=true`,
`VITE_PICKUP_ORDERING_ENABLED=false`, and
`VITE_PICKUP_PAYMENT_SETTINGS_ENABLED=false`.

Then created **non-production Preview** `dpl_AkRTDuRMbZ711Gf1LULz4Tz2yPGg` using *unchanged* Merchant main source SHA `5aedc5424d7070ee7156a080cc69e6a550acc1a4`. It is **READY**, serves HTTP 200, and the built JS contains the **new** API Preview origin and not the missing one.

**Corrected Merchant Preview (review only):** https://local-eats-dashboard-2-6m8o-20ren6m6k-mehey9184-makers-projects.vercel.app/

**Limits and owner test:** Not yet tested with an authenticated merchant's real Firebase session; not an accepted Storefront/Orders flow. User should open the **new** URL, sign in if necessary and Retry. **Do not click** Save Settings, Create Shop, Accept, Ready, Confirm Payment, or Checkout in a Preview that could share live data. If still failing, capture the Network request **status/code only** for `GET /api/v1/merchant/shop` (e.g. network failure/CORS/401/403/404/409/503) with *all Bearer tokens, cookies, emails and personal data redacted*. 401 may mean expired/wrong Firebase project, 403 CORS origin or auth rejection, 404 means explicitly no shop mapping, 409 multiple shops, 503 unavailable schema, and a connection/timeout error may mean API routing or browser CORS. Do not treat missing shop 404 as permission to create a new shop with real data. No true shop lookup was made by the assistant.

The **Production** domain `dashboard.localeatssa.co.za`, Production API origin and both app main branches remain unchanged by the Preview configuration repair. The new Vercel Preview creation is separate from GitHub test-only PR work.

## 2. R3.8 payments security caller discovery

Read-only `pg_catalog` audit in main Supabase shows legacy `public.payments(id uuid,shop_id bigint,amount numeric,payment_method text,transaction_id text,status text,payment_date timestamptz)`. `Payments access` grants `authenticated` **ALL** with `USING true / WITH CHECK true`; `authenticated` and `anon` have broad table privileges, though anon lacks an RLS policy granting row access. An authenticated Supabase role could potentially read/write unrelated shops' payment rows; this is a material public launch security blocker. We did not try a real cross-shop exploit or read/modify any hosted payment row.

**Current known caller review:** GitHub source search found one Merchant `.from("payments")` in `src/components/PaymentHistory.tsx`, but it imports `../lib/supabase` which is explicitly a **Firestore compatibility adapter**, not `@supabase/supabase-js`. No direct `.from("payments")` lookup was found in the current Customer main or the Merchant API source. This does not exclude other connected services, old versions, analytics clients, migrations or external Data API consumers; production usage logs and shop-owner authorization must be reviewed before revocation. Current pickup is pay-at-shop, not online billing; the legacy PaymentHistory also refers to COD, riders and subscriptions and must not be used as proof that these features are active.

**Offline staged mitigation only:** The `r38_lab` PostgreSQL 17 fixture models the actual 7-column legacy payments shape and broad authenticated policy with fake shops/payments. The restricted candidate test first demonstrates cross-shop SELECT, UPDATE, INSERT and DELETE in an isolated session, then applies a transaction that revokes the browser privileges and drops the permissive policy **only in that disposable database**, with RLS FORCE enabled, while retaining a separately authorized read-only backend role. It confirms fake payment rows and totals are preserved and a schema-only dump/restore has no data and no client grants. It does NOT test the actual app's live payment history or activate a real migration.

### Required change-management gates before any hosted payments remediation

1. Audit all historical Client, Merchant, Super Admin, external integrations and account-bound data fetches; ensure actual Firebase authentication has an owned-shop boundary on the API before any payment report is served. **Never trust a browser-supplied `shop_id` alone**. The production `payments.shop_id bigint` differs from modern `shops.id text`; reconcile the real relationship first.
2. Reproduce *full effective* Production schema in an approved local/isolated environment. Use safe synthetic records (no real payments/customer PII). Confirm merchant dashboard and customer pickup still function with the restricted policy, including failures, refunds and administrative reconciliations.
3. Draft an explicit versioned, owner-reviewed security migration using the current Supabase CLI; keep migration **out of `supabase/migrations`** until reviewed. Have a verified backup/restore plan, expected query failure telemetry, and an emergency API-only read fallback. A simple rollback that reinstates `USING true` is not a security-safe resolution; require explicit risk acceptance if contemplated.
4. Separately audit custom publicly callable `SECURITY DEFINER` functions. Do not rely on the payment RLS fix to cover them.
5. Require user approval before changing Production roles, policies, migrations or real payment state. No Rewards credits/payouts, Rider/Delivery, online payments or real pickup orders in R3.8.

**Public launch**: Prior ~60% planning estimate unchanged until actual signed-in Merchant Preview and Customer UX, real Firebase push reliability, controlled staging and payment authorization risks are verified.

Supabase security documentation: https://supabase.com/docs/guides/database/postgres/row-level-security and https://supabase.com/docs/guides/api/securing-your-api .
