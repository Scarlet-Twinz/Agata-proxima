$ErrorActionPreference = "Continue"
$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $repoRoot

$results = [System.Collections.Generic.List[object]]::new()
function Record-Check([string]$Name, [int]$Code) {
    $results.Add([pscustomobject]@{ Check = $Name; ExitCode = $Code; Result = if ($Code -eq 0) { "PASS" } else { "FAIL" } })
}

Write-Host "`n=== Agata Proxima public website and dashboard acceptance checks ===" -ForegroundColor Cyan
Write-Host "Branch: $(git branch --show-current)"
Write-Host "HEAD: $(git rev-parse --short HEAD)"

Write-Host "`n--- Git whitespace validation ---" -ForegroundColor Cyan
& git diff --check
$code = $LASTEXITCODE
Record-Check "git diff --check" $code

Write-Host "`n--- Static route and dashboard audit ---" -ForegroundColor Cyan
& node (Join-Path $repoRoot "scripts/verify-public-dashboard.mjs")
$code = $LASTEXITCODE
Record-Check "Static route/dashboard audit" $code

Push-Location (Join-Path $repoRoot "frontend")
Write-Host "`n--- Frontend lint ---" -ForegroundColor Cyan
& npm run lint
$code = $LASTEXITCODE
Record-Check "Frontend lint" $code

Write-Host "`n--- Frontend production build ---" -ForegroundColor Cyan
& npm run build
$code = $LASTEXITCODE
Record-Check "Frontend production build" $code
Pop-Location

Write-Host "`n=== ACCEPTANCE SUMMARY ===" -ForegroundColor Cyan
$results | Format-Table -AutoSize
Write-Host "Changed files (review before committing):" -ForegroundColor Cyan
git status --short

if (($results | Where-Object Result -eq "FAIL").Count -gt 0) {
    Write-Host "At least one check failed. Do not commit, merge, push, or deploy until the failure is fixed and all checks are rerun." -ForegroundColor Red
    exit 1
}
Write-Host "All automated checks passed. This does not replace live browser, backend, provider, or production-environment acceptance." -ForegroundColor Green
exit 0
