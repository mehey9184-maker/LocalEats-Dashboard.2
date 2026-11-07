# ONE COMMAND, staging-only, owner's Windows computer.
# Requires Supabase CLI, Docker Desktop, Node.js, staging DB password.
# Reads the staging connection URL in private hidden input. NEVER paste it
# into chat, GitHub or logs. Backs up ONLY the pinned stage DB then rehearses
# an actual LOCAL restore. No connected database writes.
param([string]$OutputDir = (Join-Path $HOME ('Documents\LocalEats-Staging-Backup-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))))
$ErrorActionPreference = 'Stop'
$secretPointer = [IntPtr]::Zero
try {
  $secure = Read-Host -Prompt 'Paste ONLY the LocalEats-Profile-Staging DB connection URL (input hidden)' -AsSecureString
  if ($null -eq $secure -or $secure.Length -eq 0) { throw 'No staging URL supplied' }
  $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $env:LOCALEATS_STAGE_DB_URL = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
  $secure.Dispose()
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
  $secretPointer = [IntPtr]::Zero

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
