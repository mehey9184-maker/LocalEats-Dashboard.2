# Local-only helper: build a STAGING session-pooler URI from the template
# copied from Supabase Dashboard → staging project → Connect → Session pooler.
# The password must never be printed, logged or committed.
function New-StageSessionPoolerUrl {
  param(
    [Parameter(Mandatory=$true)][string]$Template,
    [Parameter(Mandatory=$true)][string]$Password
  )
  $stagingRef = 'rgpbdajhlrwfmhopzgzk'
  $placeholder = '[YOUR-PASSWORD]'
  if (-not $Template.Contains($placeholder) -or
      ([regex]::Matches($Template,[regex]::Escape($placeholder)).Count -ne 1)) {
    throw 'Copy the original staging Session pooler connection template with [YOUR-PASSWORD] still present. Do not paste an existing password or a Production URL.'
  }
  $sanitizedUri = $null
  try { $sanitizedUri = [Uri]$Template.Replace($placeholder,'synthetic-placeholder') }
  catch { throw 'Invalid Session pooler connection template' }
  if (@('postgresql','postgres') -cnotcontains $sanitizedUri.Scheme -or
      $sanitizedUri.Host -notmatch '(^|\.)pooler\.supabase\.com$' -or
      $sanitizedUri.Port -ne 5432 -or
      $sanitizedUri.AbsolutePath -cne '/postgres' -or
      $sanitizedUri.UserInfo -cne ("postgres." + $stagingRef + ":synthetic-placeholder") -or
      $sanitizedUri.Fragment) {
    throw 'REFUSED: use only LocalEats-Profile-Staging Session pooler, postgres.<staging-ref>, port 5432, database postgres.'
  }
  $encodedPassword=[Uri]::EscapeDataString($Password)
  return $Template.Replace($placeholder,$encodedPassword)
}
