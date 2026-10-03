# Deep Adversarial Verification

Proxima Verify is organized around security invariants.

Protocol cases: malformed, truncated and oversized startup/frame inputs; unsupported startup packets; duplicate, missing, expired, tampered and overlong tenant context; unexpected authentication ordering.

Database cases: cross-tenant SELECT, INSERT, UPDATE and DELETE; prepared statements; transactions and rollback; RLS/BYPASSRLS deployment assumptions.

Transport cases: plaintext to TLS-required listener; invalid client certificate; TLS handshake interruption; wrong upstream CA; hostname mismatch; upstream TLS refusal; attempted TLS downgrade.

Every new security guarantee should have an executable test or an explicit architectural proof.
