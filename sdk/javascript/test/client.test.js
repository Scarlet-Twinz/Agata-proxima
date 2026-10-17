import test from "node:test";
import assert from "node:assert/strict";
import { AgataApiError, AgataClient } from "../src/index.js";
const response = (status, body, headers = {}) => ({ ok: status >= 200 && status < 300, status, text: async () => body === undefined ? "" : JSON.stringify(body), headers: { get: (key) => headers[key.toLowerCase()] ?? null } });

test("validates API origin and key", () => {
  assert.throws(() => new AgataClient({ baseUrl: "bad", apiKey: "aga_test" }), /HTTP/);
  assert.throws(() => new AgataClient({ baseUrl: "https://api.example.test", apiKey: "bad" }), /Agata API key/);
});
test("sends bearer auth and JSON for environment creation", async () => {
  let seen;
  const client = new AgataClient({ baseUrl: "https://api.example.test/", apiKey: "aga_test", fetchImpl: async (url, init) => { seen = { url, init }; return response(201, { id: "env-1" }); } });
  assert.equal((await client.createEnvironment({ name: "Staging", slug: "staging" })).id, "env-1");
  assert.equal(seen.url, "https://api.example.test/api/v1/developer/environments");
  assert.equal(seen.init.method, "POST");
  assert.equal(seen.init.headers.Authorization, "Bearer aga_test");
  assert.deepEqual(JSON.parse(seen.init.body), { name: "Staging", slug: "staging" });
});
test("encodes identifiers for webhook retry", async () => {
  let seen;
  const client = new AgataClient({ baseUrl: "https://api.example.test", apiKey: "aga_test", fetchImpl: async (url, init) => { seen = { url, init }; return response(200, { ok: true }); } });
  await client.retryWebhookDelivery("hook/one", "delivery two");
  assert.equal(seen.url, "https://api.example.test/api/v1/developer/webhooks/hook%2Fone/deliveries/delivery%20two/retry");
  assert.equal(seen.init.method, "POST");
});
test("preserves HTTP status, error code and request ID", async () => {
  const client = new AgataClient({ baseUrl: "https://api.example.test", apiKey: "aga_test", fetchImpl: async () => response(403, { message: "Forbidden", error: "FORBIDDEN" }, { "x-request-id": "req-123" }) });
  await assert.rejects(client.health(), (e) => e instanceof AgataApiError && e.status === 403 && e.code === "FORBIDDEN" && e.requestId === "req-123");
});
test("rejects paths outside versioned API", async () => {
  const client = new AgataClient({ baseUrl: "https://api.example.test", apiKey: "aga_test", fetchImpl: async () => response(200, {}) });
  await assert.rejects(client.request("https://evil.example"), /begin with \/api\/v1\//);
});
