import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const proposal = readFileSync(new URL('../../../supabase/drafts/cf2d_catalog_projection.REVIEW_ONLY.sql', import.meta.url), 'utf8');
const rollback = readFileSync(new URL('../../../supabase/drafts/cf2d_catalog_projection_rollback.REVIEW_ONLY.sql', import.meta.url), 'utf8');
const fixture = readFileSync(new URL('./staging-shape.SYNTHETIC_ONLY.sql', import.meta.url), 'utf8');
const script = readFileSync(new URL('./run-reviewed-sql-pg17.sh', import.meta.url), 'utf8');

test('CF2-D is review only, scoped to the existing staging schema and never credentialed', () => {
  assert.match(proposal, /DO NOT APPLY to Supabase without separate founder approval/);
  assert.match(proposal, /CREATE ROLE cf2_catalog_reader NOLOGIN/);
  assert.match(proposal, /NOBYPASSRLS/);
  assert.match(proposal, /CREATE SCHEMA catalog_cf2/);
  assert.match(proposal, /security_invoker = true/);
  assert.match(proposal, /CREATE POLICY cf2_catalog_shops_select/);
  assert.match(proposal, /CREATE POLICY cf2_catalog_menu_select/);
  assert.match(proposal, /CF2D_DEPLOYED_AVAILABILITY_DRIFT_STOP/);
  assert.match(proposal, /CF2D_STAGING_SHOP_COLUMNS_CHANGED/);
  assert.doesNotMatch(proposal, /\b(?:CREATE ROLE [^\n]* LOGIN|ALTER ROLE [^\n]* LOGIN|CREATE EXTENSION|INSERT INTO|UPDATE public|DELETE FROM)\b/i);
  assert.doesNotMatch(proposal, /SUPABASE_SERVICE_ROLE_KEY|CLOUDFLARE_API_TOKEN|DATABASE_URL|workers\.dev/);
});

test('CF2-D proposal preserves actual staging availability and coordinate behavior', () => {
  assert.match(proposal, /s\.latitude AS lat, s\.longitude AS lng/);
  assert.match(proposal, /s\.approval_status = 'approved'/);
  assert.match(proposal, /s\.archived_at IS NULL/);
  assert.match(proposal, /public\.shop_schedule_open/);
  assert.doesNotMatch(proposal, /public\.shop_effective_open\(s,/);
  assert.doesNotMatch(proposal, /SELECT s\.\*/);
  assert.match(fixture, /p_shop\.approval_status = 'approved'/);
  assert.match(fixture, /p_shop\.archived_at IS NULL/);
  assert.match(fixture, /Africa\/Johannesburg/);
  assert.match(fixture, /stg-test-pending/);
  assert.match(fixture, /stg-test-archived/);
});

test('CF2-D cannot silently open private or public database access', () => {
  const grants = proposal.match(/GRANT SELECT \([\s\S]*?\) ON public\.shops TO cf2_catalog_reader/);
  assert.ok(grants);
  assert.doesNotMatch(grants[0], /owner_id|private_notes/);
  assert.doesNotMatch(proposal, /GRANT SELECT ON public\.shops TO|GRANT SELECT ON public\.menu_items TO/);
  assert.doesNotMatch(proposal, /GRANT SELECT .* TO (?:PUBLIC|anon|authenticated)/i);
  assert.match(proposal, /REVOKE ALL ON catalog_cf2\.public_shops, catalog_cf2\.public_menu/);
  assert.match(rollback, /DROP VIEW catalog_cf2\.public_menu RESTRICT/);
  assert.match(rollback, /DROP SCHEMA catalog_cf2 RESTRICT/);
  assert.doesNotMatch(rollback, /CASCADE/);
  assert.match(script, /postgres:17-alpine/);
  assert.doesNotMatch(script, /supabase\.co|DATABASE_URL|SUPABASE_SERVICE_ROLE_KEY|--publish|-p [0-9]|db push|apply_migration/);
});
