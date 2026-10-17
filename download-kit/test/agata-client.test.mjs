import test from "node:test";
import assert from "node:assert/strict";
import { AgataApiError, AgataClient } from "../node/agata-client.mjs";

function clientWith(handler) {
  return new AgataClient({
    baseUrl: "https://api.example.test/",
    apiKey: "aga_test_key",
    fetchImpl: async (url, options) => {
      assert.equal(url.startsWith("https://api.example.test/api/v1/"), true);
      assert.equal(options.headers.Authorization, "Bearer aga_test_key");
      return handler(url, options);
    },
  });
}
function response(status, body, headers = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

test("rejects missing or malformed configuration", () => {
  assert.throws(() => new AgataClient({ baseUrl: "not-a-url", apiKey: "aga_x" }), /HTTP\(S\)/);
  assert.throws(() => new AgataClient({ baseUrl: "https://api.example.test", apiKey: "bad" }), /organization-scoped Agata API key/);
  assert.throws(() => new AgataClient({ baseUrl: "https://api.example.test", apiKey: "aga_x", timeoutMs: 0 }), /timeoutMs/);
});

test("sends bearer auth and parses JSON", async () => {
  const client = clientWith(async (_url, options) => {
    assert.equal(options.method, "GET");
    return response(200, { status: "ok" });
  });
  assert.deepEqual(await client.health(), { status: "ok" });
});

test("rejects paths outside the versioned API", async () => {
  const client = clientWith(async () => response(200, {}));
  await assert.rejects(client.request("/admin"), /begin with \/api\/v1\//);
});

test("surfaces status, error code and request id", async () => {
  const client = clientWith(async (_url, _options) => response(401, { message: "Unauthorized", error: "UNAUTHORIZED" }, { "x-request-id": "req-test" }));
  await assert.rejects(client.health(), (error) => {
    assert.ok(error instanceof AgataApiError);
    assert.equal(error.status, 401);
    assert.equal(error.code, "UNAUTHORIZED");
    assert.equal(error.requestId, "req-test");
    return true;
  });
});

test("creates and updates environments using versioned endpoints", async () => {
  const calls = [];
  const client = clientWith(async (url, options) => {
    calls.push({ url, method: options.method, body: options.body ? JSON.parse(options.body) : undefined });
    return response(200, { ok: true });
  });
  await client.createEnvironment({ name: "Staging", slug: "staging" });
  await client.updateEnvironment("env/123", { status: "disabled" });
  await client.deleteEnvironment("env/123");
  assert.deepEqual(calls.map((call) => [call.url.replace("https://api.example.test", ""), call.method]), [
    ["/api/v1/developer/environments", "POST"],
    ["/api/v1/developer/environments/env%2F123", "PATCH"],
    ["/api/v1/developer/environments/env%2F123", "DELETE"],
  ]);
  assert.deepEqual(calls[0].body, { name: "Staging", slug: "staging" });
});

test("starter example uses methods exposed by the client", async () => {
  const fs = await import("node:fs/promises");
  const source = await fs.readFile(new URL("../node/example.mjs", import.meta.url), "utf8");
  assert.match(source, /listPlans\(/);
  assert.match(source, /listTenants\(/);
  assert.doesNotMatch(source, /\.plans\(|\.tenants\(/);
});

test("webhook lifecycle methods call the supported API routes", async () => {
  const calls = [];
  const client = clientWith(async (url, options) => {
    calls.push({ path: url.replace("https://api.example.test", ""), method: options.method, body: options.body ? JSON.parse(options.body) : undefined });
    return response(200, { ok: true });
  });
  await client.createWebhook({ name: "Audit", endpoint_url: "https://receiver.example.test/hook", events: ["*"] });
  await client.listWebhookDeliveries("hook/1");
  await client.setWebhookEnabled("hook/1", false);
  await client.retryWebhookDelivery("hook/1", "delivery/2");
  await client.rotateWebhookSecret("hook/1");
  await client.deleteWebhook("hook/1");
  assert.deepEqual(calls.map(({ path, method }) => [path, method]), [
    ["/api/v1/developer/webhooks", "POST"],
    ["/api/v1/developer/webhooks/hook%2F1/deliveries", "GET"],
    ["/api/v1/developer/webhooks/hook%2F1/enabled", "POST"],
    ["/api/v1/developer/webhooks/hook%2F1/deliveries/delivery%2F2/retry", "POST"],
    ["/api/v1/developer/webhooks/hook%2F1/rotate-secret", "POST"],
    ["/api/v1/developer/webhooks/hook%2F1", "DELETE"],
  ]);
  assert.deepEqual(calls[2].body, { enabled: false });
});
