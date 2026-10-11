# Dependency advisory exceptions

This file records the narrow, reviewable exceptions used by supply-chain CI. An exception is not a claim that an advisory is harmless; its scope must remain enforced by CI.

## RUSTSEC-2023-0071 — RSA Marvin timing side channel

- **Advisory:** [RustSec RUSTSEC-2023-0071](https://rustsec.org/advisories/RUSTSEC-2023-0071.html), also tracked as CVE-2023-49092.
- **Reported package:** `rsa` 0.9.x; RustSec reported no patched version as of its 2026-09 update.
- **Why it appears:** SQLx 0.8.6 resolves its optional `sqlx-mysql` driver into `Cargo.lock`, which brings in `rsa`. Cargo audit reads the lockfile, so it can report optional dependencies that are not compiled into the application.
- **Current scope:** the Control Plane configures SQLx with `default-features = false` and the PostgreSQL feature only. MySQL must not appear in the active dependency graph, and the application must not add direct RSA usage.
- **Guardrails:** supply-chain CI checks the manifest, runs `cargo tree --locked -i sqlx-mysql` and fails if MySQL is active, then applies the one advisory exception to `cargo audit`. The active graph check must not be replaced with a manifest-only assertion.
- **Revisit when:** SQLx removes this optional dependency, a fixed RSA release becomes available, SQLx is upgraded, or any MySQL/RSA use is proposed. Remove the exception as soon as it is no longer needed.

Do not enable SQLx MySQL while this exception remains. If the active graph check fails or cannot resolve reliably, CI must fail closed rather than silently ignore the finding.
