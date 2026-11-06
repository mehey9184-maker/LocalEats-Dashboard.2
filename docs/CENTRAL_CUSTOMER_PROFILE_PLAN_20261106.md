# Central customer profile integration

Owner requirement: preserve the customer UI while making profile reads/saves authoritative, account-isolated and durable across sessions. Keep production writes disabled. Prefer the existing central API over new browser database writes.

## Design

Extend the existing `GET /api/v1/profiles/me` endpoint with a staging-only revision-checked PATCH protocol. Preserve main PR #70's existing non-staging GET/POST behavior and disabled production write gate. Identity comes exclusively from a revocation-checked, registered Firebase account. No caller-supplied target UID or role can establish authority. Reuse the existing update validator and return an explicit projection, never legacy privilege fields.

Keep the existing Supabase `public.profiles` store. The owner-approved read-only production column inspection confirms text Firebase-compatible `user_id`, JSONB favorites, coordinate floats and timestamptz updated_at. It read no account rows and changed nothing. A Firestore feasibility spike passed real staging authentication/read/write-denial checks, but is not the production architecture and is not evidence of Supabase acceptance. Do not deploy the CLI owner's OAuth credential. Dedicated hosted staging identity/credentials and separately reviewed production security cutover remain release gates.

Each PATCH carries expectedRevision (the exact backend updated_at string, preserving microseconds, or null for create) and a partial profile patch. An insert is insert-only; updates filter by both UID and the original revision. The server timestamp advances beyond the prior value. A retry whose requested values are already durable returns the current confirmed profile without another mutation; other obsolete revisions return 409. This confirms persisted state rather than promising durable command IDs. Unrelated fields survive partial changes. No new schema/command column, automatic role writes or Supabase auth UUID conversion.

Runtime gates require the exact approved Firebase staging project and Supabase staging URL, and reject Vercel Production even with flags set. Construct the staging client against that fixed host rather than reuse a possibly production-configured global client. A staging identity never falls through to the old store if staging is disabled/incomplete. The unversioned stage POST is rejected with 426. Existing global Preview write controls remain enforced. Production activation is outside this patch.

## Tasks

- [x] Inspect current main, repository policy and account PR #61; baseline API suite passes after granting localhost network access (initial sandbox EACCES was not a product failure).
- [x] Add failing HTTP tests for ownership, auth/revocation, partial save/read, retry/conflict, input tampering, failure, timeout and staging gates.
- [x] Implement revision handler, Supabase adapter and gated canonical endpoint wiring. Full API suite: 167 passed, including 20 new profile cases. SDK adapter tests use the actual Supabase client with injected HTTP; they do not prove hosted persistence.
- [ ] Run real Firebase + Supabase two-account persistence/relogin and database bypass checks on isolated staging. The earlier 17-check Firestore spike is a separate experiment; anonymous sign-in was disabled there and was not tested through a real anonymous token.
- [ ] Independent whole-branch review, document results, create draft PR. No main merge or production deployment.
- [ ] Integrate current customer reads/saves/retries with this API on the existing private customer branch, preserving identity/generation guards and original UI.
- [ ] Dedicated staging hosted identity, safe Preview acceptance, security cutover review and owner approvals before release.

## Ledger

- Ruling: reuse main #70's canonical profile path and Supabase store. Main advanced during development; refreshed to bd8b741 before publication, retained the new main tests and avoided a second endpoint. The Firestore spike was archived locally rather than shipped as a replacement authority.
- Ruling: use conditional updated_at and exact persisted-field confirmation rather than add command metadata columns. If a future operation needs a durable action receipt rather than profile state confirmation, it requires a separate reviewed design.
- Current main compatibility: column-only production inspection approved by owner after automatic review initially rejected it. No production SQL mutations, row reads, permissions or settings changed. Null/malformed legacy updated_at records fail closed and would require a separately reviewed repair; do not silently assign them a revision.
- Final source review approved the Supabase implementation and CI registration for a draft PR. The reviewer independently passed all six adapter tests; its localhost HTTP rerun was sandbox-blocked. Primary-agent full suite passed 167/167. A final mounted malformed-JSON regression first reproduced 500 plus raw-body generic logging; the staging parser was moved behind global write gates and before the generic parser, then all 167 passed again. Reviewer approved the middleware-order correction. No hosted Supabase claim.

## Guarded cloud acceptance runner — 2026-11-07
Prepared localeats-api/scripts/profile-stage-acceptance.mjs with a standalone preflight validator and 11 passing safety tests. The runner requires the exact approved staging pair, a dedicated staging service account (owner OAuth refused), explicit write opt-in, two explicitly synthetic accounts and initially absent profile rows. It tests the actual compiled canonical handler/repository with real cloud services; no mocked repository, account creation, SQL, key creation or cleanup is included. Cloud execution has NOT occurred because required server credentials remain unavailable; syntax/preflight checks are not hosted acceptance. Security review is pending. See docs/PROFILE_STAGE_ACCEPTANCE_20261107.md for private-file setup and commands.

Staging runner security follow-up (2026-11-07): independent review found and then cleared wrong-project Firebase-key password routing and Supabase public/server-key confusion. Firebase API key SHA256 is pinned to the already verified staging SDK configuration before sign-in; public keys must be publishable or stage anon JWTs, never server secrets, and a 200 JSON response from the pinned stage auth settings endpoint is required before denial tests. The real publishable-key endpoint check passed read-only (HTTP 200 JSON). All 13 local preflight tests passed independently; runner syntax check passed. No profile/account cloud writes or hosted Preview acceptance occurred. Required dedicated staging credentials are still missing. The scripts and setup guide are ready for draft PR #75 review; no production changes.
