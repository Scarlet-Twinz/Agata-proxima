# Production Hardening

The engine has explicit limits for concurrent sessions, upstream connection establishment, TLS handshakes and optional maximum session duration.

The container runs as a non-root user. Compose drops Linux capabilities, enables no-new-privileges and can run the Proxima container with a read-only root filesystem.

TLS trust is explicit. There is no insecure certificate-bypass switch.

Secrets are supplied through environment or secret injection rather than committed files. Operational telemetry contains counters and status, not tenant tokens, passwords, private keys or SQL payloads.

Production orchestration should additionally enforce CPU/memory limits, restart policy, network policy, secret rotation and authenticated telemetry access.

PostgreSQL must not remain reachable through an alternate untrusted route with privileged credentials.
