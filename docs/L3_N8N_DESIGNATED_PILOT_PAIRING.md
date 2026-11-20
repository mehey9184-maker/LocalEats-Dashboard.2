# L3-N8N designated-shop pilot and Customer/API pairing preparation

Owner decision: ONE designated shop per merchant for this pilot. No shop chooser.
This is a draft-only code correction; no deployment, merge, environment change, designation of real users, database write, rules publication, order/payment/push test has occurred.

## Designation
On a separately approved isolated API Preview set MERCHANT_DESIGNATED_PILOT_ONLY=true and MERCHANT_PILOT_DESIGNATIONS to a JSON object mapping verified staging Firebase UID to one staging shop ID. Do not put real identities into source, PRs, browser variables or logs.
The helper requires Preview, LOCALEATS_STAGING_ONLY=true, Firebase localeats-staging, Supabase https://rgpbdajhlrwfmhopzgzk.supabase.co and explicit false for PICKUP_WRITES_ENABLED, PROFILE_WRITES_ENABLED, MERCHANT_AVAILABILITY_WRITES_ENABLED, MERCHANT_ACCOUNT_WRITES_ENABLED.
Missing/malformed/foreign/unapproved/archived/duplicate designation fails closed. Both GET merchant/shop and merchant orders inbox verify ownership and approval again. With the pilot flag absent/false the original contract remains. No write permission is introduced.
A changed designation clears the old menu/orders and invalidates pending menu replies. Same-shop background refresh retains current facts. Existing account/order read guards remain.

## Paired Preview: release preflight, NOT executed
1. Verify the final API draft commit passed CI and includes revocation-aware Firebase middleware. Explicitly approve a Preview deployment of that exact commit in localeats-api-staging-r52d; no canonical/private-test/Merchant alias reassignment.
2. Verify its unique immutable URL using authenticated Vercel get_deployment. Match actual repository, project ID prj_eroDrVcFOPlvRJzjCU7vbwGnleFT, team team_nqIkTocJXDSY8Ml7jIsQvHt6, Preview environment, commit SHA, Firebase localeats-staging and isolated Supabase. Configured labels alone are NOT provenance.
3. Customer companion draft pins that API commit. LOCALEATS_PAIRED_PREVIEW=true requires its exact branch, explicit isolated Firebase configuration/database, disabled ordering, matching LOCALEATS_PAIRED_API_COMMIT, and unique immutable LOCALEATS_PAIRED_API_ORIGIN. Existing previews retain their prior API behavior. Do not use a mutable branch alias.
4. In a separately approved API deployment configure PAIRED_CUSTOMER_ORIGIN to the actual immutable Customer staging Preview URL only after verifying its project/team/repository/commit. CORS is exact and requires explicit false write gates plus staging identities. Vercel protection and Firebase authentication are still required.
5. Inspect Customer paired-staging.json and actual bundle. Match the API URL to independently verified API deployment metadata. Manifest/config checks do not establish authenticated account acceptance.
6. Run read-only A/B existing-account acceptance only with verified isolated credentials and approved shop designations. Creating accounts/fixtures, publishing rules, enabling any writes, activating community routes, and deployment itself require separate authorization. Verify hosted Firebase rules and rollback source independently before acceptance.

## Validation
20 local synthetic checks passed across API/Merchant and Customer. Tests execute actual handlers/config with external dependencies replaced; recent and unfinished inbox queries are exercised. The independent reviewer found no blocking findings. Full regression/typecheck/build CI is recorded on the draft PR; local clone/install unavailable due DNS.
New review branch is explicitly deployment-disabled in root and API vercel.json. No actual pilot mapping or hosted setting is provided.

