$ErrorActionPreference = "Stop"

Write-Host "AGATA PROXIMA PLATFORM" -ForegroundColor Cyan
Write-Host "Starting isolated control-plane PostgreSQL..." -ForegroundColor DarkCyan
docker compose up -d control-postgres

$env:PROXIMA_CONTROL_DATABASE_URL = "postgres://proxima_control:proxima-control-dev@127.0.0.1:55432/proxima_control"
$env:PROXIMA_CONTROL_BIND = "127.0.0.1:8080"
$env:PROXIMA_COOKIE_SECURE = "false"

Write-Host "Starting Proxima Control Plane on http://127.0.0.1:8080" -ForegroundColor Green
cargo run -p proxima-control-plane
