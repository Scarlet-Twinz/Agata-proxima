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
