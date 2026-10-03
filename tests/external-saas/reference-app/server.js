const http = require("node:http");
const { Client } = require("pg");

const HOST = process.env.APP_BIND || "127.0.0.1";
const PORT = Number(process.env.APP_PORT || 8788);
const DATABASE_URL = process.env.DATABASE_URL;
const MAX_BODY = 64 * 1024;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store"
  });
  res.end(payload);
}

function tokenFrom(req) {
  const value = req.headers["x-proxima-tenant-token"];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function withDatabase(token, fn) {
  // The reference app does not decide whether a tenant token is valid.
  // Proxima is the enforcement boundary; the token is passed through startup options.
  const client = new Client({
    connectionString: DATABASE_URL,
    options: `-c proxima_tenant_token=${token}`
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => {
      data += chunk;
      if (Buffer.byteLength(data) > MAX_BODY) {
        reject(new Error("request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, { ok: true, service: "external-saas-reference" });
    }

    const token = tokenFrom(req);
    if (!token) {
      return json(res, 401, { ok: false, error: "x-proxima-tenant-token is required" });
    }

    if (req.method === "GET" && url.pathname === "/records") {
      const requestedTenant = url.searchParams.get("tenant_id");
      const rows = await withDatabase(token, async client => {
        if (requestedTenant) {
          return client.query(
            "SELECT id, tenant_id, payload FROM proxima_test.records WHERE tenant_id = $1 ORDER BY id",
            [requestedTenant]
          );
        }
        return client.query(
          "SELECT id, tenant_id, payload FROM proxima_test.records ORDER BY id"
        );
      });
      return json(res, 200, { ok: true, records: rows.rows });
    }

    if (req.method === "POST" && url.pathname === "/records") {
      const body = JSON.parse(await readBody(req));
      const tenantId = String(body.tenant_id || "");
      if (!tenantId) {
        return json(res, 400, { ok: false, error: "tenant_id is required" });
      }
      const rows = await withDatabase(token, async client => client.query(
        "INSERT INTO proxima_test.records (tenant_id, payload) VALUES ($1, $2::jsonb) RETURNING id, tenant_id, payload",
        [tenantId, JSON.stringify(body.payload ?? {})]
      ));
      return json(res, 201, { ok: true, record: rows.rows[0] });
    }

    return json(res, 404, { ok: false, error: "not found" });
  } catch (error) {
    console.error(error);
    // PostgreSQL auth/privilege failures are surfaced as a boundary denial.
    // The application still does not inspect or validate the tenant token itself.
    const code = error && typeof error.code === "string" ? error.code : "";
    if (["28P01", "28000", "42501"].includes(code)) {
      return json(res, 403, { ok: false, error: "proxima_boundary_denied" });
    }
    return json(res, 500, { ok: false, error: "reference application error" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Agata Proxima external SaaS reference listening on http://${HOST}:${PORT}`);
});
