$ErrorActionPreference = 'Stop'
if (-not $env:AGATA_API_BASE_URL) { throw 'Set AGATA_API_BASE_URL to your control-plane origin.' }
if (-not $env:AGATA_API_KEY -or -not $env:AGATA_API_KEY.StartsWith('aga_')) { throw 'Load an organization-scoped AGATA_API_KEY beginning with aga_ from a secret store.' }
$headers = @{ Authorization = "Bearer $env:AGATA_API_KEY"; Accept = 'application/json' }
Write-Host 'Control-plane health:'
Invoke-RestMethod -Uri "$($env:AGATA_API_BASE_URL.TrimEnd('/'))/api/v1/health" -Headers $headers
Write-Host 'Plan catalogue:'
Invoke-RestMethod -Uri "$($env:AGATA_API_BASE_URL.TrimEnd('/'))/api/v1/billing/plans" -Headers $headers
Write-Host 'Tenant list (organization-scoped):'
Invoke-RestMethod -Uri "$($env:AGATA_API_BASE_URL.TrimEnd('/'))/api/v1/tenants" -Headers $headers
