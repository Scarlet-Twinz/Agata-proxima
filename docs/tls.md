# TLS Security Boundary

Proxima uses two explicit TLS boundaries when TLS-required modes are enabled:

```
Application --TLS--> Proxima --TLS--> PostgreSQL
```

## Client -> Proxima

Set:

- `PROXIMA_TLS_MODE=required`
- `PROXIMA_TLS_CERT_FILE=/path/server-cert.pem`
- `PROXIMA_TLS_KEY_FILE=/path/server-key.pem`
- `PROXIMA_TLS_HANDSHAKE_TIMEOUT_MS=10000`

The listener requires the PostgreSQL SSLRequest first, returns `S`, and then terminates TLS. Plaintext startup packets are rejected. Rustls safe protocol defaults are used.

## Proxima -> PostgreSQL

Set:

- `PROXIMA_UPSTREAM_TLS_MODE=required`
- `PROXIMA_UPSTREAM_TLS_CA_FILE=/path/ca.pem`
- `PROXIMA_UPSTREAM_TLS_SERVER_NAME=postgres.example.internal`

The upstream certificate chain is validated against the configured CA and the server name is verified by rustls. There is no certificate-verification bypass switch. If PostgreSQL refuses the SSLRequest or the handshake fails, the session is terminated.

## Security properties

- no silent TLS downgrade;
- handshake timeouts are bounded;
- client and upstream trust are independent;
- private keys are loaded from configured files, never logged;
- tenant enforcement runs after client TLS termination and before query relay;
- wrong-host upstream certificates fail;
- invalid TLS material fails closed.

Production deployments should use an external certificate/secret manager and rotate certificates without committing them to the repository.
