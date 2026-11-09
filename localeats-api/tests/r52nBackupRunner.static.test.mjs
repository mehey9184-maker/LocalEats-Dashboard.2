import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const script = readFileSync(
  new URL("../../../scripts/staging/r52n-export-staging-backup.ps1", import.meta.url),
  "utf8",
);

test("R52N backup runner hard-codes only the isolated staging ref", () => {
  assert.match(script, /\$stagingRef\s*=\s*"rgpbdajhlrwfmhopzgzk"/);
  assert.doesNotMatch(script, /phdjumtqkooyppxozqsi/);
  assert.match(script, /\$typedRef\s*=\s*Read-Host/);
  assert.match(script, /\$typedRef\s+-cne\s+\$expectedConfirmation/);
});

test("R52N backup runner exports separate role, schema and data files read-only", () => {
  assert.match(script, /"roles\.sql"/);
  assert.match(script, /"schema\.sql"/);
  assert.match(script, /"data\.sql"/);
  assert.match(script, /--role-only/);
  assert.match(script, /--data-only/);
  assert.match(script, /--linked/);
  assert.match(script, /Get-FileHash/);
  assert.match(script, /restoreStatus\s*=\s*"NOT_VERIFIED"/);
  assert.match(script, /actualProjectRecoveryReady\s*=\s*\$false/);
  assert.doesNotMatch(script, /supabase\s+db\s+(reset|push|migrate|seed)/i);
  assert.doesNotMatch(script, /SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY/i);
});

test("R52N backup runner does not place files in source-control or cloud-sync folders", () => {
  assert.match(script, /\.git/);
  assert.match(script, /OneDrive\|Dropbox\|Google Drive\|iCloud Drive/);
  assert.match(script, /IsPathRooted/);
  assert.match(script, /Docker/);
});
