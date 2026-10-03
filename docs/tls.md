# Proxima TLS Boundary

Phase 18 establishes two independent TLS boundaries:

Application -> TLS -> Proxima -> TLS -> PostgreSQL

With PROXIMA_TLS_MODE=required, Proxima performs the standard PostgreSQL SSLRequest exchange, sends exactly S, terminates the client TLS session, and only then parses the startup packet and tenant token.

The upstream side can independently use PROXIMA_UPSTREAM_TLS_MODE=required. Proxima sends PostgreSQL's SSLRequest, requires S, then verifies the PostgreSQL certificate against the configured CA and server name.

There is no trust-any-certificate or silent plaintext downgrade mode.

The client certificate is not the tenant identity. Tenant identity remains the signed Proxima tenant token and the PostgreSQL role selected from that verified context.

Required release tests cover successful TLS, plaintext rejection, handshake timeout/failure, invalid certificate material, upstream TLS refusal, wrong CA, hostname mismatch, and tenant isolation after TLS termination.
