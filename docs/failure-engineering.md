# Failure Engineering

The highest-value property of Proxima is not that every dependency is always available. It is that a dependency failure does not silently become a security failure.

## Control plane outage

Existing engine enforcement continues locally. Cloud connectivity is never treated as authorization. The last accepted policy remains active according to its documented validity rules, and operators see degraded control-plane telemetry.

## PostgreSQL outage

New upstream connections fail within the configured timeout. Client sessions receive a real connection failure. No stale tenant session is reused and recovery does not cross tenant boundaries.

## Policy publication failure

Invalid bundles are rejected before activation. The previous valid policy remains active. Failed publication is auditable and partial writes are not treated as success.

## Node disappearance

Fleet health becomes stale. The control plane never reports the node as healthy while it is missing. UI state cannot override engine enforcement.

## TLS failure

Required client TLS rejects plaintext. verify-full upstream TLS requires CA trust and server-name verification. Handshake timeouts prevent indefinite resource consumption.
