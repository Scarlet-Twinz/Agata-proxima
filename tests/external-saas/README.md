# External SaaS Acceptance Environment

This directory is the contract for the first real application acceptance test.

The required topology is:

Application -> Proxima -> PostgreSQL

The application under test must provide at least three tenants and exercise CRUD, transactions, prepared statements, connection pooling, concurrent traffic, TLS on both hops, application restart and Proxima restart.

The acceptance run must deliberately attempt:
- tenant A reading tenant B;
- tenant B reading tenant C;
- tenant C reading tenant A;
- the same three cross-tenant write directions.

The result is accepted only when legitimate same-tenant operations succeed and every deliberate cross-tenant operation is denied.

This repository does not claim an external customer integration is complete until a real application is run through this contract.
