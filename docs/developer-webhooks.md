# Outbound webhooks

Agata Proxima emits organization-scoped webhook deliveries from persisted audit events. An endpoint subscribes to exact audit action names (for example, `developer.api_key.created`) or `*` for all audit actions.

## Signing secret and environment

Set `AGATA_WEBHOOK_ENCRYPTION_KEY` to a unique random secret of at least 32 characters before creating or rotating endpoints. Generate one with `openssl rand -hex 32`. Keep the value stable and back it up securely: changing it makes existing encrypted webhook secrets unreadable. Do not commit the key. Existing endpoints created before the delivery pipeline migration have no encrypted secret and must use **Rotate secret** before deliveries can be sent.

`AGATA_WEBHOOK_ALLOW_LOCAL_HTTP` defaults to false. Enable it only for local development when testing against `localhost` or loopback. Production destinations must use HTTPS and resolve to public IP addresses. Redirects are not followed.

## Event and signature contract

Each JSON delivery includes `id`, `type`, `created_at`, `organization_id`, `actor_id`, `resource`, and `data`. Headers include:

- `X-Agata-Event`: audit action name
- `X-Agata-Event-Id`: persisted audit event UUID
- `X-Agata-Delivery-Id`: stable delivery UUID
- `X-Agata-Signature`: `t=<unix-seconds>,v1=<hex HMAC-SHA256>`

The signature is HMAC-SHA256 over the UTF-8 bytes of `<timestamp>.<raw request body>`, using the endpoint's signing secret. Receivers should compare signatures in constant time, reject timestamps outside their chosen tolerance, and deduplicate by delivery ID.

## Retries and recovery

Delivery attempts have a 10-second request timeout, do not follow redirects, and record HTTP status, response time, a bounded response excerpt, and failure details. Non-2xx responses and transport failures retry with bounded backoff. After eight attempts, the delivery moves to `dead_letter`. Organization members with write permission can retry failed/dead-letter deliveries from the API. Successful deliveries can also be explicitly replayed; receivers should deduplicate using `X-Agata-Delivery-Id`.

## API operations

- `GET/POST /api/v1/developer/webhooks`
- `GET/DELETE /api/v1/developer/webhooks/{id}`
- `GET /api/v1/developer/webhooks/{id}/deliveries`
- `POST /api/v1/developer/webhooks/{id}/deliveries/{delivery_id}/retry`
- `POST /api/v1/developer/webhooks/{id}/rotate-secret`
- `POST /api/v1/developer/webhooks/{id}/enabled` with `{"enabled":true|false}`

Creation returns the signing secret once. Rotation returns the replacement secret once and requires an organization administrator. The control plane never returns stored secrets from list/detail endpoints.

## Acceptance

Before production use, verify successful delivery against a controlled HTTPS receiver, valid/invalid signatures, 2xx and non-2xx responses, timeout handling, retry scheduling, replay, endpoint-disable behavior, secret rotation, and cross-organization authorization. Production acceptance also requires the encryption key to be provisioned in the actual runtime environment.
