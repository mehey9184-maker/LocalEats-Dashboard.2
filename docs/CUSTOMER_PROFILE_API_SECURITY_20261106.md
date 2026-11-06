# LocalEats Customer Profiles — authenticated server-owned API

**Prepared November 6, 2026.** The first launch remains pickup-only. This review branch does not approve payments, live orders, delivery, rider development or profile-write activation.

## Hosted profile root cause
Customer `src/lib/profileService.ts` calls `/api/profiles`, but the public Client Vercel project is a Vite single-page application with a catch-all `/index.html` rewrite. The `/api/profiles` handlers visible in `LocalEats-app/server.ts` belong to a separate Express development server; they are **not** mounted in the active `localeats-api` service. Therefore, a plausible UI save or local Firestore mirror is not proof of a persisted profile in Supabase.

## Proposed verified hosted API — write-off default
The Merchant/API repository now contains `POST /api/v1/profiles/me` and `GET /api/v1/profiles/me`. Both require a genuine verified Firebase ID token (`Bearer fb-...`) and reject anonymous Firebase identities. A path-based client-selected target UID is never accepted: the verified server-side `authUser.uid` identifies the record. All reads and writes are scoped to that UID. The request may update name, valid South African phone, optional city/address, optional precise coordinate pair, country, safe photo URL, language and a bounded favorites list.

Client payloads may **not** set user_id, id, email, role, approval, admin, created_at or updated_at. Email is derived from Firebase claims. New database records rely on the existing `profiles.role=customer` default; existing roles are never modified by this route. The API uses Supabase service_role **only server-side**, verifies the returned saved row/owner/fields, and returns a failed/unconfirmed response on database errors or mismatch. No in-memory fallback, "saved locally" success or Firestore mirror.

`PROFILE_WRITES_ENABLED=false` is the default regardless of pickup-order switches. In Preview, `previewReadOnlyGate` blocks POST before this route. Production write permission requires **separate owner authorization** after a verified encrypted backup/restore, security correction, staging real authenticated two-account GET/POST/read-back test, and a final price/cost check.

## Tests in this PR
A deterministic localhost Express suite models Firebase identity and a synthetic profile store, including A/B account isolation, unauthorized body fields, anonymous sign-in rejection, optional GPS, default-off writes, and Preview read-only barrier. It does not handle or publish real ID tokens and cannot by itself prove remote Firebase/staging Supabase wiring.

## Remaining profile launch work
1. Update Customer to call the real API origin `VITE_LOCALEATS_API_URL` with strict owner/response verification; remove the local false-success and Firestore mirror fallback. Draft Client PR #61 contains a larger proposed account change, but no hosted positive verification yet. Do not merge it unreviewed.
2. Run a **real authenticated two-user** hosted test against a dedicated staging API pointing only at LocalEats-Profile-Staging (not Production) with profile-write staging guard, and verify account switch, logout, delayed offline retry, role immutability and read-after-write.
3. Independently inspect Production `public.handle_new_user()`, which currently trusts `raw_user_meta_data.role`. The trigger may allow user-controlled privileged roles. Harden after approved backup/security cutover without breaking signups.
4. Keep `PROFILE_WRITES_ENABLED=false` in all Production Vercel configurations until formal approval. Existing Customer account, profile and guest UX must be manually checked on the original interface.
5. This is **not** authorization to turn on pickup order creation, subscriptions, delivery or rider dispatch.

## User instruction
No Delivery/Rider App development for a minimum of six months of genuine paid-and-collected pickup use, followed by a separate owner decision.
