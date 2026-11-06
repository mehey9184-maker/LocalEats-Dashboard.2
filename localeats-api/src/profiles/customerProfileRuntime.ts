import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from 'express';
import { authAdmin } from '../lib/firebaseAdmin.js';
import { makeCustomerProfileRouter, PROFILE_STAGE_PROJECT } from '../routes/customerProfile.js';
import { SupabaseRevisionProfileRepository, profileStagingEnabled, PROFILE_STAGE_SUPABASE_URL } from './supabaseProfileRepository.js';

function repository() {
  if (!profileStagingEnabled(process.env) || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Profile staging is not configured');
  // Construct against the fixed isolated host rather than reuse the global
  // client, which might have been initialized with another environment.
  const db = createClient(PROFILE_STAGE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return new SupabaseRevisionProfileRepository(db, PROFILE_STAGE_SUPABASE_URL);
}

const customerProfileRoutes = makeCustomerProfileRouter({
  enabled: () => profileStagingEnabled(process.env),
  writesEnabled: () => profileStagingEnabled(process.env) && process.env.CUSTOMER_PROFILE_STAGE_WRITES_ENABLED === 'true',
  repository,
  verifyIdToken: (token, checkRevoked) => authAdmin.verifyIdToken(token, checkRevoked),
});

// Reuse the existing canonical endpoint. A staging identity can never fall
// through to the legacy store, even when staging config is incomplete/off.
// Other deployments retain their existing write-disabled profile behavior.
export const customerProfileStagingRoutes: RequestHandler = (req, res, next) => {
  if (process.env.FIREBASE_PROJECT_ID !== PROFILE_STAGE_PROJECT) { next(); return; }
  customerProfileRoutes(req, res, next);
};
