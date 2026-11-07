# Staging-only connection builder for the exact Session pooler endpoint
# already verified reachable in the owner's Windows backup logs.
# No full connection URL template, hostname, username or port is entered
# interactively. The only secret is the database password (hidden prompt).
function New-StageSessionPoolerUrl {
  param([Parameter(Mandatory=$true)][string]$Password)

  $stagingRef='rgpbdajhlrwfmhopzgzk'
  $hostName='aws-0-eu-west-1.pooler.supabase.com'
  if ([string]::IsNullOrEmpty($Password)) {
    throw 'Staging database password cannot be empty'
  }

  $encodedPassword=[Uri]::EscapeDataString($Password)
  $url='postgresql://postgres.'+$stagingRef+':'+$encodedPassword+'@'+$hostName+':5432/postgres?sslmode=require'
  # Fail closed if accidental future edits change any connection parameter.
  $parsed=[Uri]$url
  if ($parsed.Scheme -cne 'postgresql' -or
      $parsed.Host -cne $hostName -or
      $parsed.Port -ne 5432 -or
      $parsed.AbsolutePath -cne '/postgres' -or
      $parsed.UserInfo.Split(':',2)[0] -cne ('postgres.'+$stagingRef)) {
    throw 'REFUSED: connection is not pinned to LocalEats-Profile-Staging Session pooler'
  }
  return $url
}
