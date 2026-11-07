# Central profile cloud staging acceptance

Status: runner prepared, cloud execution NOT performed. Staging server credentials remain unavailable. All 13 preflight tests passed, and independent narrow security review cleared the runner after two corrections. A read-only request using the actual staging publishable key confirmed `/auth/v1/settings` returns HTTP 200 JSON; this is not profile persistence acceptance. This tests the actual canonical handler and Supabase repository over localhost HTTP with real cloud Firebase/Supabase; it does not test hosted Preview, global runtime middleware, CORS or production compatibility.

## Secure prerequisites

Use only Firebase `localeats-pickup-stage-261105` and Supabase `https://rgpbdajhlrwfmhopzgzk.supabase.co`. Provide a dedicated staging service-account JSON file authorized to check Firebase token revocation/users; owner CLI OAuth is refused. Provide two existing, disposable synthetic email/password Firebase accounts with no profile rows. No accounts, keys, SQL or permissions are created by this runner.

Keep all credential/account files and the environment file outside Git. Do not paste values into chat. Required environment names:

- `PROFILE_STAGE_WRITE_TESTS=approved`
- `PROFILE_STAGE_SUPABASE_URL=https://rgpbdajhlrwfmhopzgzk.supabase.co`
- `PROFILE_STAGE_SERVICE_ROLE_KEY` (staging server secret, never a browser variable)
- `PROFILE_STAGE_SUPABASE_PUBLISHABLE_KEY`
- `PROFILE_STAGE_FIREBASE_API_KEY`
- `PROFILE_STAGE_SERVICE_ACCOUNT_FILE` (private JSON path)
- `PROFILE_STAGE_ACCOUNTS_FILE` (private JSON path)

The accounts file has `syntheticOnly: true` and exactly two entries in `users`, each with `uid`, `email`, and `password`. Do not reuse real users or existing profiles. Preflight pins the approved staging Firebase API key by SHA256 before any password request; rejects wrong projects, emulator/cloud ambiguity, Vercel execution, missing values, public/server key confusion and legacy keys bearing another project reference. The runner verifies the public key with the exact staging auth settings endpoint before interpreting any direct-database denial. A modern secret key is opaque: its project membership must still be supplied correctly through secure staging configuration; the runner never tries it against another host.

## Run

From `localeats-api`, use Node 22 and a private environment file:

1. `npm run test:profile-stage-preflight` — local configuration tests, no cloud access.
2. `node --env-file=<private-env-path> scripts/profile-stage-acceptance.mjs --check` — validates supplied configuration without network or writes.
3. `npm run build` — compile the existing API handler/repository.
4. `node --env-file=<private-env-path> scripts/profile-stage-acceptance.mjs --run` — performs synthetic cloud writes only after all guards pass.

The runner checks missing-auth rejection, two-account persistence, partial updates and zero coordinates, exact-state retry without mutation, stale and concurrent revision rejection, ownership/role tampering, fresh sign-in durability and direct database denial for anonymous/Firebase credentials. Every fetch has a 15-second deadline. Output contains check labels/counts only. A failed run can leave synthetic rows; cleanup is intentionally not automatic. Use fresh approved synthetic accounts for a subsequent run instead of overwriting existing records.

The in-process harness mounts only the canonical profile router. It intentionally does not claim global Preview write gates or hosted deployment acceptance. Those require a separate Preview walkthrough before any production rollout approval.
