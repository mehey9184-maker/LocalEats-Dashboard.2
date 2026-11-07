# Run on the owner's trusted Windows PC only. Requires Supabase CLI + Docker.
# NEVER run in GitHub Actions; never copy backup SQL into the repo/chat.
param([Parameter(Mandatory=$true)][string]$OutputDir)
$ErrorActionPreference = 'Stop'
$expectedRef = 'rgpbdajhlrwfmhopzgzk'
if ([string]::IsNullOrWhiteSpace($env:LOCALEATS_STAGE_DB_URL)) {
  throw 'Set the staging-only DB URL in a private terminal environment variable first.'
}
try {
  $uri = [System.Uri]$env:LOCALEATS_STAGE_DB_URL
  if (@('postgres','postgresql') -notcontains $uri.Scheme) {throw 'Not a PostgreSQL connection URL'}
  $username = [System.Uri]::UnescapeDataString(($uri.UserInfo -split ':')[0])
  $direct = $uri.Host -eq "db.$expectedRef.supabase.co" -and $username -eq 'postgres'
  $pool = $uri.Host -match '(^|\.)pooler\.supabase\.com$' -and $username -eq "postgres.$expectedRef"
  if (-not ($direct -or $pool)) {throw 'REFUSED: database URL is not the approved LocalEats staging project'}
  if ($uri.AbsolutePath -ne '/postgres') {throw 'REFUSED: unexpected database name'}
  $dest = [System.IO.Path]::GetFullPath($OutputDir)
  $repoRoot = (git rev-parse --show-toplevel 2>$null)
  if ($repoRoot) {
    $repoPath = [System.IO.Path]::GetFullPath($repoRoot)
    if ($dest.StartsWith(($repoPath.TrimEnd('\','/')+[System.IO.Path]::DirectorySeparatorChar),
      [System.StringComparison]::OrdinalIgnoreCase) -or
        [string]::Equals($dest,$repoPath,[System.StringComparison]::OrdinalIgnoreCase)) {
      throw 'REFUSED: backup directory may not be inside a Git checkout'
    }
  }
  if (Test-Path $dest) {throw 'Use a NEW empty private backup directory. Refusing to overwrite.'}
  New-Item -ItemType Directory -Path $dest -Force | Out-Null
  if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {throw 'Supabase CLI is not installed'}
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {throw 'Docker is not installed'}
  $env:DOCKER_HOST = $env:DOCKER_HOST # no Docker configuration changes
  $checks = @(
    @{name='roles.sql';flags=@('--role-only')},
    @{name='schema.sql';flags=@()},
    @{name='data.sql';flags=@('--use-copy','--data-only')},
    @{name='history_schema.sql';flags=@('--schema','supabase_migrations')},
    @{name='history_data.sql';flags=@('--use-copy','--data-only','--schema','supabase_migrations')}
  )
  foreach($task in $checks) {
    $target = Join-Path $dest $task.name
    Write-Host ("Exporting staging "+$task.name+" (contents not displayed)")
    $args = @('db','dump','--db-url',$env:LOCALEATS_STAGE_DB_URL,'--file',$target) + $task.flags
    & supabase @args
    if ($LASTEXITCODE -ne 0) {throw ("Backup export failed: "+$task.name)}
  }
  $verifier = Join-Path $PSScriptRoot 'verify-stage-dumps.mjs'
  $manifest = Join-Path $dest 'integrity-manifest.json'
  & node $verifier --directory $dest --manifest $manifest
  if ($LASTEXITCODE -ne 0) {throw 'Backup file-integrity gate failed'}
  Write-Host 'Backup files have checksums. RESTORE IS NOT VERIFIED. Encrypt, copy offsite and test restore into an isolated disposable Postgres 17 before staging DDL.'
} finally {
  Remove-Item Env:\LOCALEATS_STAGE_DB_URL -ErrorAction SilentlyContinue
}
