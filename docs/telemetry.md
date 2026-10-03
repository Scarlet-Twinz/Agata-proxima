# Proxima Runtime Telemetry

The engine exposes a loopback-only HTTP telemetry surface by default on `127.0.0.1:9090`.

Endpoints:

- `GET /healthz` — process health.
- `GET /readyz` — readiness after the telemetry listener is active.
- `GET /metrics` — JSON runtime counters for the command center.

The endpoint contains operational counters only. Tenant tokens, passwords, certificate private keys and SQL payloads are never emitted.

The dashboard consumes this endpoint for live runtime values. The endpoint is intentionally not an authentication/control API; production deployments should keep it on a private network or place an authenticated control plane in front of it.
