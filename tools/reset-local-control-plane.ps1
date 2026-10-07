param(
  [string]$DatabaseUrl = $env:PROXIMA_CONTROL_DATABASE_URL,
  [switch]$Confirm
)

if (-not $Confirm) {
  Write-Host "This wipes ALL local Agata Proxima control-plane accounts, organizations, sessions and dependent records." -ForegroundColor Yellow
  Write-Host "Re-run with -Confirm when you intentionally want a clean local test database." -ForegroundColor Yellow
  exit 1
}

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  throw "PROXIMA_CONTROL_DATABASE_URL is not set. Load your local .env first or pass -DatabaseUrl."
}

$sql = @"
BEGIN;
TRUNCATE TABLE users, organizations CASCADE;
COMMIT;
"@

$env:PGCONNECT_TIMEOUT = "10"
$sql | psql $DatabaseUrl

if ($LASTEXITCODE -ne 0) {
  throw "Local control-plane reset failed."
}

Write-Host "Local control-plane test data wiped. You can reuse previously registered email addresses." -ForegroundColor Green
