# External SaaS integration fixture

This fixture is intentionally small. It represents the shape of a real SaaS application that puts Proxima between its application process and PostgreSQL.

## Required topology

    SaaS application
          |
          | PostgreSQL TLS
          v
    Agata Proxima
          |
          | PostgreSQL TLS verify-full
          v
      PostgreSQL

## Integration acceptance tests

The external application must prove:

- tenant A sees only A;
- tenant B sees only B;
- A cannot read, insert, update or delete B;
- prepared statements preserve isolation;
- transaction rollback does not leak state;
- connection-pool reuse never changes the tenant identity of an existing session;
- expired, forged and duplicate tenant assertions are rejected;
- plaintext is rejected when TLS is required;
- certificate and hostname failures are rejected;
- reconnects establish fresh tenant context.

## What this repository can prove

The local Rust/PostgreSQL integration suite and tools/proxima-verify.sh prove the data-plane boundary. This fixture is the contract for the next step: connect an independently deployed SaaS application and run the same attack matrix against it.

That external deployment is deliberately not marked complete until real traffic produces evidence.
