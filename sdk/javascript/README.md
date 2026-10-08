# Agata Proxima JavaScript SDK

The SDK is a thin customer-side integration layer. It never contains the control-plane session cookie and never decides authorization.

## Flow

1. Configure the control-plane URL, environment ID and environment credential from the customer's secret store.
2. Resolve the authenticated application tenant.
3. Request a short-lived tenant context from `POST /api/v1/customer/context`.
4. Pass the returned context as PostgreSQL startup option `proxima_tenant_token`.
5. Connect through the Proxima Engine.
6. Refresh the context when a connection is created or the short-lived context expires.

The SDK deliberately does not persist credentials, embed secrets in frontend code, or make cross-tenant authorization decisions.
