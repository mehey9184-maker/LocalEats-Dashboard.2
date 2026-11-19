param([switch]$BaselineOnly)
$ErrorActionPreference='Stop'
$repoRoot=(Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$pg='C:\Program Files\PostgreSQL\17\bin'
$cluster=Join-Path $repoRoot ('.tmp/acceptance-pg-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $cluster -Force | Out-Null
$data=Join-Path $cluster 'data'
$port=55439
$probe=[System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,$port)
try {$probe.Start()} finally {$probe.Stop()}
$connection="host=127.0.0.1 hostaddr=127.0.0.1 port=$port user=postgres dbname=postgres sslmode=disable connect_timeout=5"
$started=$false
try {
 & "$pg/initdb.exe" -D $data -U postgres --auth=trust --no-locale --encoding=UTF8 | Out-Null
 if($LASTEXITCODE -ne 0){throw 'initdb failed'}
 $p=Start-Process -FilePath "$pg/pg_ctl.exe" -ArgumentList @('-D',('"'+$data+'"'),'-l',('"'+(Join-Path $cluster 'postgres.log')+'"'),'-o',('"-h 127.0.0.1 -p '+$port+'"'),'-w','start') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $cluster 'launch.out') -RedirectStandardError (Join-Path $cluster 'launch.err')
 if(-not $p.WaitForExit(20000)){throw 'Local PostgreSQL start timed out'}
 & "$pg/pg_isready.exe" -h 127.0.0.1 -p $port -U postgres | Out-Null
 if($LASTEXITCODE -ne 0){throw 'Local PostgreSQL start failed'}
 $started=$true
 $files=@('localeats-api/tests/pickup/schema.sql','supabase/drafts/pickup_launch_foundation.sql','supabase/drafts/pickup_zero_fee.sql','supabase/drafts/merchant_availability.sql')
 if(-not $BaselineOnly){$files+='supabase/drafts/pickup_acceptance.sql'}
 $files+='localeats-api/tests/pickup/acceptance.sql'
 if(-not $BaselineOnly){$files+='localeats-api/tests/pickup/acceptance-volume.sql';$files+='localeats-api/tests/pickup/acceptance-race-setup.sql'}
 foreach($file in $files){
  # Canonical LF preserves the reviewed function-body hash across Windows checkouts.
  $canonical=Join-Path $cluster ([IO.Path]::GetFileName($file))
  [IO.File]::WriteAllText($canonical,([IO.File]::ReadAllText((Join-Path $repoRoot $file))).Replace("`r`n","`n"),[Text.UTF8Encoding]::new($false))
  & "$pg/psql.exe" -X --no-password -d $connection -v ON_ERROR_STOP=1 -f $canonical
  if($LASTEXITCODE -ne 0){throw "SQL failed: $file"}
 }
 if(-not $BaselineOnly){
  $lockArgs=@('-X','--no-password','-d',('"'+$connection+'"'),'-v','ON_ERROR_STOP=1','-f',('"'+(Join-Path $PSScriptRoot 'acceptance-race-lock.sql')+'"'))
  $locker=Start-Process -FilePath "$pg/psql.exe" -ArgumentList $lockArgs -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $cluster 'lock.out') -RedirectStandardError (Join-Path $cluster 'lock.err')
  $null=$locker.Handle
  $locked=$false
  for($attempt=0;$attempt -lt 100;$attempt++){
   $check=& "$pg/psql.exe" -X --no-password -d $connection -At -c "select exists(select 1 from pg_stat_activity where application_name='acceptance-lock-holder' and wait_event='PgSleep');"
   if($check -eq 't'){$locked=$true;break}
   Start-Sleep -Milliseconds 20
  }
  if(-not $locked){throw 'Deadline race did not acquire order lock'}
  & "$pg/psql.exe" -X --no-password -d $connection -v ON_ERROR_STOP=1 -f (Join-Path $PSScriptRoot 'acceptance-race-accept.sql')
  if($LASTEXITCODE -ne 0){throw 'Post-lock deadline regression failed'}
  if(-not $locker.WaitForExit(15000)){throw 'Lock holder did not exit'}
 }
} finally {
 if($started -or (Test-Path (Join-Path $data 'postmaster.pid'))){& "$pg/pg_ctl.exe" -D $data -m fast -w stop}
 Write-Output "Stopped synthetic cluster retained: $cluster"
}
