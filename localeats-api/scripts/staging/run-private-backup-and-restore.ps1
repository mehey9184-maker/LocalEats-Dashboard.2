# ONE COMMAND, staging-only, owner's Windows computer.
# Requires Supabase CLI, Docker Desktop, Node.js, staging DB password.
# Reads ONLY the staging database password in private hidden input. NEVER paste it
# into chat, GitHub or logs. Backs up ONLY the pinned stage DB then rehearses
# an actual LOCAL restore. No connected database writes.
param([string]$OutputDir = (Join-Path $HOME ('Documents\LocalEats-Staging-Backup-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))))
$ErrorActionPreference = 'Stop'
$secretPointer = [IntPtr]::Zero
try {
  # Supabase CLI runs pg_dump inside a Docker container. Check the Linux
  # engine BEFORE requesting credentials or creating backup files.
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker CLI is missing. Install/start Docker Desktop in Linux container mode.'
  }
  $dockerOS = $null
  try { $dockerOS = (& docker info --format '{{.OSType}}' 2>$null | Select-Object -Last 1) } catch { $dockerOS = $null }
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($dockerOS)) {
    throw 'Docker Desktop Linux engine is not running. Open Docker Desktop, verify Engine running, then run: docker info --format "{{.OSType}}" (expected: linux). No backup was started.'
  }
  if ($dockerOS.Trim() -ne 'linux') {
    throw 'Docker is using Windows containers. Switch Docker Desktop to Linux containers, then retry. No backup was started.'
  }
  if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
    throw 'Supabase CLI was not found in PATH.'
  }
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js is required for private backup integrity checks.'
  }
  # Exact Session pooler host, port, project ref and username are pinned
  # from the owner's already verified reachable staging endpoint. Only
  # ask for the database password; do NOT paste a URL or placeholder.
  . (Join-Path $PSScriptRoot 'new-stage-session-url.ps1')
  Write-Host 'Target: LocalEats-Profile-Staging Session pooler (eu-west-1, port 5432), not Production.'
  $secure = Read-Host -Prompt 'Enter STAGING DATABASE password only (hidden; not Supabase login/API key)' -AsSecureString
  if ($null -eq $secure -or $secure.Length -eq 0) { throw 'Staging database password missing' }
  $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $dbPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
  try {
    $env:LOCALEATS_STAGE_DB_URL = New-StageSessionPoolerUrl -Password $dbPassword
  } finally {
    Remove-Variable dbPassword -ErrorAction SilentlyContinue
    $secure.Dispose()
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
    $secretPointer = [IntPtr]::Zero
  }

  & (Join-Path $PSScriptRoot 'export-private-staging-backup.ps1') -OutputDir $OutputDir
  if ($LASTEXITCODE -ne 0) { throw 'Private staging backup export did not complete' }

  # The export script removes the private connection URL from the environment.
  # This second stage has NO network or Supabase URL argument at all.
  if (Test-Path Env:\LOCALEATS_STAGE_DB_URL) {
    throw 'Staging connection URL unexpectedly remained after export'
  }
  & (Join-Path $PSScriptRoot 'verify-stage-local-restore.ps1') -BackupDir $OutputDir
  if ($LASTEXITCODE -ne 0) { throw 'Offline Docker restore did not complete' }
  $evidence = Get-Content (Join-Path $OutputDir 'restore-evidence.json') -Raw | ConvertFrom-Json
  if ($evidence.result -cne 'LOCAL_RESTORE_P5_VERIFIED' -or
      $evidence.stage_project_ref -cne 'rgpbdajhlrwfmhopzgzk') {
    throw 'Staging restore success evidence missing or wrong project'
  }
  Write-Host 'STAGING_BACKUP_AND_LOCAL_P5_RESTORE_VERIFIED'
  Write-Host 'The 5 SQL dumps remain in your PRIVATE backup folder. Encrypt/offsite-copy it before any connected staging migration.'
} finally {
  if ($secretPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
  }
  Remove-Item Env:\LOCALEATS_STAGE_DB_URL -ErrorAction SilentlyContinue
  Remove-Variable secure -ErrorAction SilentlyContinue
}
