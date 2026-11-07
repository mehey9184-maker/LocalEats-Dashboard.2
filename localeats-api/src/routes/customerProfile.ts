import express, { Router, type Request, type Response } from 'express';
import { parseProfileUpdate } from './customerProfiles.js';

export const PROFILE_STAGE_PROJECT = 'localeats-pickup-stage-261105';
export interface ProfileDocument { fields: Record<string, unknown>; revision: string }
export interface ProfileRepository {
  read(uid: string, signal: AbortSignal): Promise<ProfileDocument | null>;
  write(uid: string, patch: Record<string, unknown>, expectedRevision: string | null, signal: AbortSignal): Promise<ProfileDocument>;
}
export class ProfileConflict extends Error {}
class InputError extends Error { status?: number }
class AuthError extends Error {}
interface Dependencies {
  enabled(): boolean;
  writesEnabled(): boolean;
  repository(): ProfileRepository;
  verifyIdToken(token: string, checkRevoked: true): Promise<any>;
  timeoutMs?: number;
}
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const textLimits: Record<string, number> = { fullName: 120, phone: 32, city: 120, address: 500, country: 120, language: 12, photo_url: 2048 };
const profileFields = new Set([...Object.keys(textLimits), 'favorites', 'latitude', 'longitude']);
const revisionPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export const validProfileRevision = (v: unknown): v is string => typeof v === 'string' && revisionPattern.test(v) && Number.isFinite(Date.parse(v));

export function normalizeCustomerProfilePatch(raw: unknown): Record<string, unknown> {
  if (!object(raw) || !Object.keys(raw).length || Object.keys(raw).some(k => !profileFields.has(k))) throw new InputError();
  const patch: Record<string, unknown> = {};
  // Project only the supported customer fields.
  for (const [key, max] of Object.entries(textLimits)) if (own(raw, key)) {
    const value = raw[key];
    if (value !== null && (typeof value !== 'string' || value.length > max)) throw new InputError();
    patch[key] = typeof value === 'string' ? value.trim() : null;
    if (key === 'photo_url' && patch[key]) {
      try { const url = new URL(patch[key] as string); if (url.protocol !== 'https:' || url.username || url.password) throw new InputError(); }
      catch { throw new InputError(); }
    }
  }
  if (own(raw, 'favorites')) {
    if (!Array.isArray(raw.favorites) || raw.favorites.length > 100 || raw.favorites.some(v => typeof v !== 'string' || !v || v.length > 128)) throw new InputError();
    patch.favorites = [...new Set(raw.favorites)];
  }
  if (own(raw, 'latitude') || own(raw, 'longitude')) {
    if (!own(raw, 'latitude') || !own(raw, 'longitude')) throw new InputError();
    const lat = raw.latitude, lng = raw.longitude;
    if (!(lat === null && lng === null) && !(typeof lat === 'number' && Number.isFinite(lat) && Math.abs(lat) <= 90 && typeof lng === 'number' && Number.isFinite(lng) && Math.abs(lng) <= 180)) throw new InputError();
    patch.latitude = lat; patch.longitude = lng;
  }
  return patch;
}

function assertDocument(doc: ProfileDocument | null, uid: string): void {
  if (doc && (!object(doc.fields) || doc.fields.user_id !== uid || !validProfileRevision(doc.revision))) throw new Error('Invalid stored profile');
  if (doc) {
    const fields = Object.fromEntries([...profileFields].filter(key => own(doc.fields, key)).map(key => [key, doc.fields[key]]));
    if (Object.keys(fields).length) {
      try { normalizeCustomerProfilePatch(fields); } catch { throw new Error('Invalid stored profile'); }
    }
  }
}
function receipt(doc: ProfileDocument | null, uid: string, email: string | null) {
  assertDocument(doc, uid);
  if (!doc) return { success: true, profile: null, revision: null };
  const profile: Record<string, unknown> = { user_id: uid, email, updated_at: doc.revision };
  // Never expose role, command metadata or any unknown legacy server fields.
  for (const key of profileFields) if (own(doc.fields, key)) profile[key] = doc.fields[key];
  return { success: true, profile, revision: doc.revision };
}
function fieldsPersisted(doc: ProfileDocument | null, patch: Record<string, unknown>): boolean {
  return !!doc && Object.keys(patch).every(key => JSON.stringify(doc.fields[key]) === JSON.stringify(patch[key]));
}

export function makeCustomerProfileRouter(deps: Dependencies): Router {
  const router = Router();
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!deps.enabled()) { res.status(503).json({ success: false, code: 'PROFILE_UNAVAILABLE', error: 'Account details are temporarily unavailable.' }); return; }
    next();
  });
  router.use(express.json({ limit: '32kb' }));
  async function handle(req: Request, res: Response) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    req.once('aborted', abort);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const operation = async () => {
      if (req.method === 'PATCH' && !deps.writesEnabled()) throw Object.assign(new Error(), { status: 503 });
      const header = req.headers.authorization;
      if (!header?.startsWith('Bearer fb-') || !header.slice(10) || header.length > 16384) throw new AuthError();
      let identity: any;
      try { identity = await deps.verifyIdToken(header.slice(10), true); } catch { throw new AuthError(); }
      controller.signal.throwIfAborted();
      if (!identity || typeof identity.uid !== 'string' || !identity.uid || identity.uid.length > 128 || /[\/\x00-\x1f\x7f]/.test(identity.uid) || identity.uid === '.' || identity.uid === '..' ||
        identity.aud !== PROFILE_STAGE_PROJECT || identity.iss !== `https://securetoken.google.com/${PROFILE_STAGE_PROJECT}` || identity.firebase?.tenant ||
        !['password', 'google.com', 'apple.com', 'phone'].includes(identity.firebase?.sign_in_provider)) throw new AuthError();
      if (Object.keys(req.query).length) throw new InputError();
      const uid = identity.uid;
      const email = typeof identity.email === 'string' && identity.email.length <= 320 ? identity.email : null;
      if (req.method === 'GET') {
        const doc = await deps.repository().read(uid, controller.signal);
        controller.signal.throwIfAborted(); return receipt(doc, uid, email);
      }
      if (!req.is('application/json')) throw Object.assign(new InputError(), { status: 415 });
      const body = req.body;
      if (!object(body) || Buffer.byteLength(JSON.stringify(body)) > 32768 || Object.keys(body).some(k => !['profile', 'expectedRevision'].includes(k)) ||
        !own(body, 'expectedRevision') || (body.expectedRevision !== null && !validProfileRevision(body.expectedRevision))) throw new InputError();
      let patch: Record<string, unknown>;
      try { patch = parseProfileUpdate(normalizeCustomerProfilePatch(body.profile)); } catch { throw new InputError(); }
      if (email !== null) patch.email = email;
      const repository = deps.repository();
      const current = await repository.read(uid, controller.signal);
      controller.signal.throwIfAborted(); assertDocument(current, uid);
      // Confirm current durable values without performing a second mutation.
      // No new command column or migration is required for profile state saves.
      if (fieldsPersisted(current, patch)) return receipt(current, uid, email);
      if ((current?.revision ?? null) !== body.expectedRevision) throw new ProfileConflict();
      let saved: ProfileDocument;
      try {
        saved = await repository.write(uid, { ...patch, user_id: uid }, body.expectedRevision, controller.signal);
      } catch (error) {
        controller.signal.throwIfAborted();
        if (!(error instanceof ProfileConflict)) throw error;
        // A concurrent retry may already have persisted these exact values.
        const latest = await repository.read(uid, controller.signal);
        controller.signal.throwIfAborted(); assertDocument(latest, uid);
        if (!fieldsPersisted(latest, patch)) throw error;
        return receipt(latest, uid, email);
      }
      controller.signal.throwIfAborted(); assertDocument(saved, uid);
      if (!fieldsPersisted(saved, patch) || saved.revision === body.expectedRevision) throw new Error('Unconfirmed save');
      return receipt(saved, uid, email);
    };
    try {
      const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(Object.assign(new Error(), { status: 504 })); }, deps.timeoutMs ?? 15000); });
      const result = await Promise.race([operation(), deadline]);
      if (!res.destroyed) res.json(result);
    } catch (error: any) {
      const status = error instanceof AuthError ? 401 : error instanceof InputError ? (error.status ?? 400) : error instanceof ProfileConflict ? 409 : error.status === 504 ? 504 : 503;
      const messages: Record<number, string> = { 400: 'Check the account details and try again.', 401: 'Sign in to access your account details.', 409: 'Account details changed. Reload them before saving again.', 415: 'Send account details as JSON.', 503: 'Account details could not be confirmed. Please retry.', 504: 'Account details could not be confirmed in time. Retry the same save.' };
      if (!res.destroyed) res.status(status).json({ success: false, code: `PROFILE_${status}`, error: messages[status] });
    } finally {
      if (timer) clearTimeout(timer); controller.abort(); req.off('aborted', abort);
    }
  }
  router.get('/', handle); router.patch('/', handle);
  router.all('/', (_req, res) => {
    res.status(426).json({ success: false, code: 'PROFILE_REVISION_REQUIRED', error: 'Reload account details before saving.' });
  });
  router.use((error: any, _req: Request, res: Response, _next: express.NextFunction) => {
    res.status(error.type === 'entity.too.large' ? 413 : 400).json({ success: false, error: 'Check the account details and try again.' });
  });
  return router;
}
