param([string]$PostgresBin = 'C:\Program Files\PostgreSQL\17\bin', [int]$Port=55432)
$ErrorActionPreference='Stop'
$apiRoot=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$repoRoot=(Resolve-Path (Join-Path $apiRoot '..')).Path
if ($Port -lt 1024 -or $Port -gt 65535) { throw 'Use an unprivileged local port.' }
$probe=[System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,$Port)
try { $probe.Start() } finally { $probe.Stop() }
$cluster=Join-Path $apiRoot ('node_modules/.cache/pickup-pg-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $cluster | Out-Null
$data=Join-Path $cluster 'data'
$started=$false
$testConnection="host=127.0.0.1 hostaddr=127.0.0.1 port=$Port user=postgres dbname=postgres sslmode=disable connect_timeout=5"
try {
  & (Join-Path $PostgresBin 'initdb.exe') -D $data -U postgres --auth=trust --no-locale --encoding=UTF8 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Disposable initdb failed.' }
  $launch=Start-Process -FilePath (Join-Path $PostgresBin 'pg_ctl.exe') -ArgumentList @('-D',('"'+$data+'"'),'-l',('"'+(Join-Path $cluster 'postgres.log')+'"'),'-o',('"-h 127.0.0.1 -p '+$Port+'"'),'-w','start') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $cluster 'launch.out') -RedirectStandardError (Join-Path $cluster 'launch.err') -PassThru
  if (-not $launch.WaitForExit(20000)) { throw 'pg_ctl launch did not exit within 20 seconds.' }
  if ($launch.ExitCode -ne 0) { throw 'Disposable PostgreSQL start failed.' }
  $started=$true
  foreach($file in @((Join-Path $PSScriptRoot 'schema.sql'),(Join-Path $repoRoot 'supabase/drafts/pickup_launch_foundation.sql'),(Join-Path $PSScriptRoot 'verify.sql'))) {
    & (Join-Path $PostgresBin 'psql.exe') -X --no-password -d $testConnection -v ON_ERROR_STOP=1 -f $file
    if ($LASTEXITCODE -ne 0) { throw "Disposable validation failed: $file" }
  }

  function Start-FixtureSql([string]$File,[string]$Label) {
    $psqlArgs=@('-X','--no-password','-d',('"'+$testConnection+'"'),'-v','ON_ERROR_STOP=1','-f',('"'+(Join-Path $PSScriptRoot $File)+'"'))
    Start-Process -FilePath (Join-Path $PostgresBin 'psql.exe') -ArgumentList $psqlArgs -WindowStyle Hidden -RedirectStandardOutput (Join-Path $cluster ($Label+'.out')) -RedirectStandardError (Join-Path $cluster ($Label+'.err')) -PassThru
  }
  $first=Start-FixtureSql 'race-create.sql' 'create-a'
  $second=Start-FixtureSql 'race-create.sql' 'create-b'
  foreach($task in @($first,$second)) { if(-not $task.WaitForExit(20000) -or $task.ExitCode -ne 0) { throw 'Concurrent create failed.' } }
  $accept=Start-FixtureSql 'race-accept.sql' 'accept'
  $cancel=Start-FixtureSql 'race-cancel.sql' 'cancel'
  foreach($task in @($accept,$cancel)) { if(-not $task.WaitForExit(20000)) { throw 'Accept/cancel race timed out.' } }
  if(@($accept,$cancel).Where({$_.ExitCode -eq 0}).Count -ne 1) { throw 'Accept/cancel must have exactly one winner.' }
  $loser=if($accept.ExitCode -eq 0) { 'cancel' } else { 'accept' }
  if((Get-Content (Join-Path $cluster ($loser+'.err')) -Raw) -notmatch 'ORDER_STATE_CHANGED') { throw 'Unexpected race failure.' }
  & (Join-Path $PostgresBin 'psql.exe') -X --no-password -d $testConnection -v ON_ERROR_STOP=1 -f (Join-Path $PSScriptRoot 'race-verify.sql')
  if($LASTEXITCODE -ne 0) { throw 'Race verification failed.' }
  Write-Output 'PICKUP_DISPOSABLE_POSTGRES_PASSED'

} finally {
  if ($started -or (Test-Path (Join-Path $data 'postmaster.pid'))) { & (Join-Path $PostgresBin 'pg_ctl.exe') -D $data -m fast -w stop }
  Write-Output "Synthetic test cluster retained, stopped: $cluster"
}
