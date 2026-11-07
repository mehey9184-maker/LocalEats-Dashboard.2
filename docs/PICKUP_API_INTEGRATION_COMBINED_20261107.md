# Pickup API integration gate — geo + closed menus + Rider default-off

This branch is an integration rehearsal, **not a Production release**.

## Consolidated verified Customer/Merchant/API contract
- Source branch starts from *still-draft* API #84, which contains API #82's approved closed-shop browsing and the owner-confirmed any-town 4 km discovery/quote policy.
- Includes the tested Super Admin Rider verification default-off API patch from *still-draft* #81, including its authentication-first, database-zero-read denial tests.
- A single new GitHub workflow runs the full TypeScript/API suite on the **combined tree** and requires the distance filter and server-only default-off flag to remain present. It does not send orders or connect to Supabase.
- **Companion Customer #74** retains original My-Kota shop cards and closed browsing. **Companion Super Admin #2** locks the Riders screen. These remain separate, unmerged and undeployed.
- **Critical release blocker:** The installed Production `pickup_create_order` still requires Tembisa/Ivory Park text. Draft #86 has a hash-pinned one-line SQL replacement tested in disposable PG17, but it is **NOT installed** anywhere in connected Supabase. Without matching database SQL, checkout would fail for newly eligible towns despite a successful preview quote.
- Full staging `rgpbdajhlrwfmhopzgzk` remains P5-profile-only (23 pickup contract checks, 3 present/20 missing). Owner authorized preparing staging only after a **real encrypted, restore-verified backup**. Backup #88 now includes a one-command private Windows export and Docker restore verifier; only fictional-data CI was checked, not the owner's actual database.
- Vercel Hobby commercial use is not authorized by policy for a public business. Owner must choose compliant paid tier or commercial-permitted host before public rollout.
- Actual named Firestore published rules and Supabase Production signup-role/Rider privilege fixes are not verified as deployed.

## Acceptance and boundaries
CI green is **source-level integration evidence**, not public-launch acceptance. Before any Production merge or writes: separately approve a complete hosted A/B staging run, confirm Firebase/Supabase environment isolation, backup and rollback, Customer original UX, order idempotency/merchant inbox/FCM recovery, and the source & schema cutovers.

**No merged PRs, no Production deployments, no database changes, no live order or online payment activation, no Rider/Delivery or subscriptions.**
