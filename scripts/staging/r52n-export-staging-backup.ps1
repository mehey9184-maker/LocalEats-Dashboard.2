# R5.2N — Owner-run, READ-ONLY export for isolated Supabase staging.
# Supabase CLI 3.x: explicit --remote=<project-ref>, NOT old --linked flag.
# NEVER use for Production. Requires locally installed Supabase CLI and Docker.
# A successful export is NOT an independently verified restore.
# Credentials are entered only into official Supabase CLI prompts; never into
# this script, repository, chat, or the generated manifest.
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string] $BackupRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$stagingRef = "rgpbdajhlrwfmhopzgzk"
$projectName = "LocalEats-Profile-Staging"
$expectedConfirmation = $stagingRef

function Invoke-Checked {
  param([string]$Name, [string[]]$Arguments)
  & $Name @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed. Stop; no backup or recovery success is claimed."
  }
}

function Assert-NotInsideRepositoryOrSyncedFolder {
  param([string]$PathToCheck)
  $walk = [System.IO.Path]::GetFullPath($PathToCheck)
  if ($walk -match '(?i)[\\/](OneDrive|Dropbox|Google Drive|iCloud Drive)([\\/]|$)') {
    throw "Choose a private non-synchronized encrypted local destination, not a cloud-sync folder."
  }
  while ($true) {
    if (Test-Path -LiteralPath (Join-Path $walk ".git")) {
      throw "BackupRoot is inside a Git repository. Choose a separate private folder."
    }
    $parent = [System.IO.Directory]::GetParent($walk)
    if ($null -eq $parent) { break }
    $walk = $parent.FullName
  }
}

if (-not [System.IO.Path]::IsPathRooted($BackupRoot)) {
  throw "Provide an absolute path to a private, encrypted local backup folder."
}
$fullBackupRoot = [System.IO.Path]::GetFullPath($BackupRoot)
Assert-NotInsideRepositoryOrSyncedFolder -PathToCheck $fullBackupRoot

foreach ($command in @("supabase", "docker")) {
  if ($null -eq (Get-Command $command -ErrorAction SilentlyContinue)) {
    throw "$command is required. Install it before running this owner-controlled export."
  }
}
Invoke-Checked -Name "docker" -Arguments @("info", "--format", "{{.ServerVersion}}")
Invoke-Checked -Name "supabase" -Arguments @("--version")
$dumpHelp = & supabase db dump --help
if ($LASTEXITCODE -ne 0 -or -not ($dumpHelp -match "--remote")) {
  throw "CLI does not advertise explicit --remote target. Stop and inspect supabase db dump --help."
}

Write-Host "READ-ONLY BACKUP SOURCE: $projectName ($stagingRef)" -ForegroundColor Yellow
Write-Host "This is NOT a Production backup. It creates files in a private local folder."
Write-Host "Never share exported SQL, login tokens, passwords or connection strings in chat or GitHub."
$typedRef = Read-Host "Type the exact staging project reference to confirm"
if ($typedRef -cne $expectedConfirmation) {
  throw "Staging project identity was not confirmed; stopping."
}

$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$runFolder = Join-Path $fullBackupRoot ("LocalEats-Staging-" + $stamp)
[void](New-Item -ItemType Directory -Path $runFolder -Force)
Push-Location $runFolder
try {
  Write-Host "Using the explicit remote project $projectName ($stagingRef); never a default linked project."
  $exportFiles = @(
    @{ Name = "roles.sql"; Args = @("--role-only") },
    @{ Name = "schema.sql"; Args = @() },
    @{ Name = "data.sql"; Args = @("--use-copy", "--data-only") }
  )
  $evidence = @()
  foreach ($item in $exportFiles) {
    $name = $item.Name
    $filePath = Join-Path $runFolder $name
    $args = @("db", "dump", "--remote=$stagingRef", "-f", $filePath) + $item.Args
    Invoke-Checked -Name "supabase" -Arguments $args
    if (-not (Test-Path -LiteralPath $filePath)) {
      throw "$name was not created."
    }
    $file = Get-Item -LiteralPath $filePath
    if ($file.Length -le 0) {
      throw "$name is empty; export is NOT verified."
    }
    $hash = Get-FileHash -LiteralPath $filePath -Algorithm SHA256
    $evidence += [pscustomobject]@{
      file = $name
      bytes = $file.Length
      sha256 = $hash.Hash
    }
  }

  $manifest = [ordered]@{
    projectRef = $stagingRef
    projectName = $projectName
    utcCreated = (Get-Date).ToUniversalTime().ToString("o")
    restoreStatus = "NOT_VERIFIED"
    managedAuthStorageAndMigrationHistoryVerified = $false
    actualProjectRecoveryReady = $false
    exports = $evidence
  }
  $manifestPath = Join-Path $runFolder "backup-manifest-NON_SECRET.json"
  $manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

  Write-Host "Export files were written to $runFolder" -ForegroundColor Green
  Write-Host "CRITICAL: This is not a complete verified Supabase recovery yet."
  Write-Host "Keep files encrypted/offline. Do an independent sacrificial restore,"
  Write-Host "verify managed Auth/Storage/migrations, and run the R5.2M baseline comparator."
  Write-Host "Only share the nonsecret manifest metadata, never the SQL files or passwords."
} finally {
  Pop-Location
}
