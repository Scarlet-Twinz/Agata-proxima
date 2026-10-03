# Security Policy

Agata Proxima is security infrastructure. Security reports are treated as product-critical issues.

## Reporting a vulnerability

Do not open a public issue for an undisclosed vulnerability.

Until a dedicated security contact is published, report security-sensitive findings privately to the repository owner through GitHub.

Include:

- affected component and version/commit;
- reproduction steps;
- expected versus observed behavior;
- security impact;
- logs or proof of concept where safe to provide.

Do not include production credentials, customer data, or other secrets.

## Security principles

Proxima will:

1. define security guarantees against an explicit threat model;
2. prefer PostgreSQL-native enforcement where appropriate;
3. treat tenant identity as untrusted until authenticated and bound to the request/session;
4. test connection reuse, transactions, prepared statements, and privileged operations;
5. avoid claiming protection for traffic it cannot actually inspect or authenticate.

A passing happy-path test is not considered evidence of tenant isolation.
