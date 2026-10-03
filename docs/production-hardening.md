# Production Hardening

The engine has explicit limits for concurrent sessions, upstream connection establishment and TLS handshakes.

The container runs as a non-root user. TLS trust is explicit. Secrets are supplied through environment or secret injection rather than committed files. Logging records operational events without tenant tokens or private keys.

Production orchestration should additionally enforce CPU and memory limits, restart policy, network policy, secret rotation and readiness checks.

PostgreSQL must not remain reachable through an alternate untrusted route with privileged credentials.
