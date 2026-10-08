import test from "node:test";
import assert from "node:assert/strict";
import { AgataProxima, AgataError } from "../src/index.js";

test("exchanges an environment credential for a tenant-bound context", async () => {
  let request;
  const sdk = new AgataProxima({
    controlPlaneUrl: "https://control.example",
    environmentId: "environment-1",
    credential: "credential-1",
    fetchImpl: async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify({
        token: "v2.org.tenant.env.integration.123.jti.signature",
        tenant_id: "tenant-1",
        organization_id: "org-1",
        environment_id: "environment-1",
        integration_id: "integration-1",
        expires_at: 123
      }), { status: 200, headers: {"content-type":"application/json"} });
    }
  });
  const context = await sdk.tenantContext("tenant-1");
  assert.equal(context.tenantId, "tenant-1");
  assert.equal(request.url, "https://control.example/api/v1/customer/context");
  assert.equal(request.init.headers.authorization, "Bearer credential-1");
});

test("surfaces provider failures without leaking credential material", async () => {
  const sdk = new AgataProxima({
    controlPlaneUrl: "https://control.example",
    environmentId: "environment-1",
    credential: "credential-secret",
    fetchImpl: async () => new Response(JSON.stringify({message:"credential invalid"}), {status:401})
  });
  await assert.rejects(() => sdk.tenantContext("tenant-1"), AgataError);
});
