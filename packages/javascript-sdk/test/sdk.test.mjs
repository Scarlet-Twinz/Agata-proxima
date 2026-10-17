import test from "node:test";
import assert from "node:assert/strict";
import { AgataClient } from "../src/index.mjs";

test("SDK authenticates requests and exposes environment methods", async () => {
  const calls = [];
  const client = new AgataClient({
    baseUrl: "https://api.example.test",
    apiKey: "aga_test",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
  });
  assert.deepEqual(await client.listEnvironments(), { ok: true });
  assert.deepEqual(await client.createEnvironment({ name: "Test", slug: "test" }), { ok: true });
  assert.equal(calls[0].options.headers.Authorization, "Bearer aga_test");
  assert.equal(calls[1].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[1].options.body), { name: "Test", slug: "test" });
});

test("SDK rejects non-versioned paths", async () => {
  const client = new AgataClient({ baseUrl: "https://api.example.test", apiKey: "aga_test" });
  await assert.rejects(client.request("/private"), /begin with \/api\/v1\//);
});

test("SDK exposes service-account and webhook lifecycle routes", async () => {
  const calls = [];
  const client = new AgataClient({
    baseUrl: "https://api.example.test",
    apiKey: "aga_test",
    fetchImpl: async (url, options) => {
      calls.push({ url, method: options.method, body: options.body ? JSON.parse(options.body) : undefined });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
  });
  await client.listServiceAccounts();
  await client.createWebhook({ name: "Receiver", endpoint_url: "https://receiver.example.test/events", events: ["*"] });
  await client.setWebhookEnabled("hook-1", false);
  await client.retryWebhookDelivery("hook-1", "delivery-1");
  assert.equal(calls[0].url, "https://api.example.test/api/v1/developer/service-accounts");
  assert.equal(calls[1].url, "https://api.example.test/api/v1/developer/webhooks");
  assert.equal(calls[1].method, "POST");
  assert.deepEqual(calls[2].body, { enabled: false });
  assert.equal(calls[3].url, "https://api.example.test/api/v1/developer/webhooks/hook-1/deliveries/delivery-1/retry");
});
