# Contributing

Thank you for helping improve Agata Proxima.

## Before opening a pull request

1. Check existing code, documentation, migrations, and tests before adding a duplicate implementation.
2. Keep changes focused and explain the user or engineering problem they solve.
3. Never commit credentials, access tokens, private customer data, or local environment files.
4. Do not weaken tenant-isolation, authentication, authorization, signature verification, or launch gates to make a check pass.
5. Do not present a planned capability as implemented or a CI result as production acceptance.

## Validation

Run the checks relevant to the files changed. For Rust workspace changes, start with:

```bash
cargo fmt --all -- --check
cargo check --workspace --all-targets
cargo test --workspace --all-targets
cargo clippy --workspace --all-targets --all-features -- -D warnings
```

Frontend changes should be linted and built from `frontend/`. Database-dependent checks should be run with the documented PostgreSQL test environment. State clearly which checks were run and which could not be run.

## Pull request description

Include:

- **Problem:** what is wrong or missing.
- **Change:** what was changed and why.
- **Validation:** commands and results.
- **Risk and limitations:** behavior that remains unverified or requires a configured external service.

Use small, reviewable pull requests. Preserve migration history and compatibility contracts unless a change explicitly addresses them.
