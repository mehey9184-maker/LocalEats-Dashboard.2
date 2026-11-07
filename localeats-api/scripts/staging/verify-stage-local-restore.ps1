# Private, offline restore rehearsal for the staging-only backup.
# Runs on owner's Windows PC with Docker Desktop. NO database network URLs
# are accepted; never copies backup files to GitHub/CI or Supabase.
param([Parameter(Mandatory=$true)][string]$BackupDir)
$ErrorActionPreference = 'Stop'
$stagingRef = 'rgpbdajhlrwfmhopzgzk'
$container = 'localeats-backup-restore-' + [Guid]::NewGuid().ToString('N').Substring(0,12)
$started = $false

function Assert-Ok([string]$Step) {
  if ($LASTEXITCODE -ne 0) { throw ('STAGING_RESTORE_FAILED: ' + $Step) }
}

try {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker Desktop missing' }
  $dir = [IO.Path]::GetFullPath($BackupDir)
  if (-not (Test-Path -LiteralPath $dir -PathType Container)) { throw 'Private backup directory missing' }
  $manifestPath = Join-Path $dir 'integrity-manifest.json'
  if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw 'The backup integrity manifest must exist first'
  }
  $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  if ($manifest.project_ref -cne $stagingRef -or
      $manifest.file_integrity -cne 'PASS' -or
      $manifest.restore_status -cne 'NOT_VERIFIED') {
    throw 'Backup manifest is not for the isolated staging project or has unexpected status'
  }

  $expected = @('roles.sql','schema.sql','data.sql','history_schema.sql','history_data.sql')
  if (@($manifest.files).Count -ne $expected.Count) { throw 'Incomplete staging backup manifest' }
  foreach ($name in $expected) {
    $entry = @($manifest.files | Where-Object { $_.name -ceq $name })
    if ($entry.Count -ne 1) { throw ('Missing or duplicate backup manifest entry: ' + $name) }
    $path = Join-Path $dir $name
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
      throw ('Missing private backup file: ' + $name)
    }
    $info = Get-Item -LiteralPath $path
    $hash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($info.Length -ne [long]$entry[0].bytes -or $hash -cne $entry[0].sha256) {
      throw ('Backup modified after hash manifest was created: ' + $name)
    }
  }

  if (Test-Path -LiteralPath (Join-Path $dir 'restore-evidence.json')) {
    throw 'Restore evidence already exists. Do not overwrite it.'
  }
  & docker info --format '{{.ServerVersion}}' | Out-Null
  Assert-Ok 'Docker not running'
  Write-Host 'Starting a disposable, network-isolated PostgreSQL 17 container.'
  & docker run -d --rm --network none --name $container -e POSTGRES_PASSWORD=local-only-synthetic --mount "type=bind,source=$dir,target=/backup,readonly" postgres:17-alpine | Out-Null
  Assert-Ok 'cannot create private local container'
  $started = $true

  # A brand-new Postgres container briefly accepts connections during init
  # and then restarts its server. pg_isready alone can therefore race with a
  # temporary shutdown. Require the init completion log AND a real SQL read.
  $ready = $false
  for ($i = 0; $i -lt 60; $i++) {
    $logText = ''
    try { $logText = ((& docker logs $container 2>&1) | Out-String) } catch { $logText = '' }
    if ($logText -like '*PostgreSQL init process complete*') {
      $probe = $null
      try { $probe = (& docker exec $container psql -X -At -U postgres -d postgres -c 'SELECT 1' 2>$null | Select-Object -Last 1) } catch { $probe = $null }
      if ($LASTEXITCODE -eq 0 -and $probe -eq '1') { $ready = $true; break }
    }
    Start-Sleep -Milliseconds 750
  }
  if (-not $ready) { throw 'Local PostgreSQL 17 did not complete initialization or pass SQL readiness check' }

  # Supabase CLI's five files are the only input. Docker has no host port and
  # --network none; this command never sends SQL to either connected project.
  Write-Host 'Restoring private staging SQL into the offline container.'
  & docker exec $container psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres --single-transaction -f /backup/roles.sql -f /backup/schema.sql -f /backup/data.sql -f /backup/history_schema.sql -f /backup/history_data.sql | Out-Null
  Assert-Ok 'SQL restore rejected one or more statements'

  # Schema and privilege contract must match last verified staging P5 baseline.
  $verify = @'
DO $verify$
DECLARE cols int; constraints_count int; migration_rows int; profiles_count int;
BEGIN
 IF current_database() <> 'postgres' THEN
   RAISE EXCEPTION 'RESTORE_WRONG_LOCAL_DATABASE';
 END IF;
 IF to_regclass('public.profiles') IS NULL OR to_regclass('supabase_migrations.schema_migrations') IS NULL
 THEN RAISE EXCEPTION 'RESTORE_PROFILE_OR_HISTORY_MISSING'; END IF;
 SELECT count(*) INTO cols FROM pg_attribute
 WHERE attrelid='public.profiles'::regclass AND attnum>0 AND NOT attisdropped;
 SELECT count(*) INTO constraints_count FROM pg_constraint
 WHERE conrelid='public.profiles'::regclass;
 SELECT count(*) INTO profiles_count FROM public.profiles;
 SELECT count(*) INTO migration_rows FROM supabase_migrations.schema_migrations
 WHERE version='20261103140914';
 IF cols <> 14 OR constraints_count <> 13 OR profiles_count <> 0 OR migration_rows <> 1
 THEN RAISE EXCEPTION 'RESTORE_P5_SHAPE_OR_HISTORY_DRIFT'; END IF;
 IF NOT (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class
   WHERE oid='public.profiles'::regclass)
   OR has_table_privilege('anon','public.profiles','SELECT')
   OR has_table_privilege('authenticated','public.profiles','UPDATE')
   OR NOT has_table_privilege('service_role','public.profiles','SELECT')
 THEN RAISE EXCEPTION 'RESTORE_PROFILE_ACCESS_NOT_PRESERVED'; END IF;
 IF to_regclass('public.shops') IS NOT NULL OR to_regclass('public.orders') IS NOT NULL
 THEN RAISE EXCEPTION 'RESTORE_CONTAINS_UNEXPECTED_PICKUP_OBJECTS'; END IF;
END $verify$;
SELECT 'ISOLATED_LOCAL_P5_RESTORE_VERIFIED' AS result;
'@
  $result = $verify | & docker exec -i $container psql -X -v ON_ERROR_STOP=1 -At -U postgres -d postgres
  Assert-Ok 'P5 schema, access, or migration history did not restore faithfully'
  if (-not ($result -contains 'ISOLATED_LOCAL_P5_RESTORE_VERIFIED')) {
    throw 'Isolated restore verification marker missing'
  }

  $evidence = @{
    stage_project_ref=$stagingRef
    checked_at_utc=([DateTime]::UtcNow.ToString('o'))
    result='LOCAL_RESTORE_P5_VERIFIED'
    public_schema_tables_checked=@('profiles')
    profile_row_count=0
    expected_migration='20261103140914'
    postgres_major=17
    source_manifest_sha256=(Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
    constraints_checked=13
    profile_columns_checked=14
    note='Validates local restore of staging P5 profile structure and history only; not full Auth/Firebase/Vercel recovery or future pickup migration.'
  }
  $json = $evidence | ConvertTo-Json -Depth 5
  [IO.File]::WriteAllText((Join-Path $dir 'restore-evidence.json'),$json)
  Write-Host 'LOCAL_RESTORE_P5_VERIFIED: offline profile backup restored successfully.'
  Write-Host 'Evidence saved PRIVATELY as restore-evidence.json in the backup folder.'
} finally {
  if ($started) { & docker rm -f $container | Out-Null }
  Remove-Variable manifest -ErrorAction SilentlyContinue
}
