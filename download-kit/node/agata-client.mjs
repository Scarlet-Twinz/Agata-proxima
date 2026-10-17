/**
 * Agata Proxima server-side JavaScript client.
 * Requires Node.js 22+ and an organization-scoped API key.
 * Keep credentials in a server-side environment or secret manager.
 */
export class AgataApiError extends Error {
  constructor(message, { status, code, requestId } = {}) {
    super(message);
    this.name = "AgataApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}
export class AgataClient {
  constructor({ baseUrl = process.env.AGATA_API_BASE_URL, apiKey = process.env.AGATA_API_KEY, fetchImpl = fetch, timeoutMs = 15000 } = {}) {
    if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) throw new Error("Set AGATA_API_BASE_URL to an HTTP(S) API origin.");
    if (!apiKey || !apiKey.startsWith("aga_")) throw new Error("AGATA_API_KEY must be an organization-scoped Agata API key.");
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new Error("timeoutMs must be a positive integer.");
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }
  async request(path, { method = "GET", body, signal, headers = {} } = {}) {
    if (!path.startsWith("/api/v1/")) throw new Error("API paths must begin with /api/v1/.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method, signal: controller.signal,
        headers: { Accept: "application/json", Authorization: `Bearer ${this.apiKey}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const text = await response.text();
      let data;
      try { data = text ? JSON.parse(text) : undefined; } catch { data = { message: text.slice(0, 500) }; }
      if (!response.ok) throw new AgataApiError(data?.message || `Agata API returned HTTP ${response.status}.`, { status: response.status, code: data?.error, requestId: response.headers.get("x-request-id") ?? undefined });
      return data;
    } catch (error) {
      if (error instanceof AgataApiError) throw error;
      if (controller.signal.aborted) throw new AgataApiError("The Agata API request timed out or was cancelled.", { code: "REQUEST_ABORTED" });
      throw error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  }
  session(options) { return this.request("/api/v1/session", options); }
  health(options) { return this.request("/api/v1/health", options); }
  listPlans(options) { return this.request("/api/v1/billing/plans", options); }
  listTenants(options) { return this.request("/api/v1/tenants", options); }
  async organizationScopedInput(input, options) {
    if (input.organization_id) return input;
    const context = await this.session(options);
    if (!context?.organization_id) throw new Error("The authenticated session did not return an organization_id.");
    return { ...input, organization_id: context.organization_id };
  }
  async createTenant(input, options) { return this.request("/api/v1/tenants", { ...options, method: "POST", body: await this.organizationScopedInput(input, options) }); }
  listPolicies(options) { return this.request("/api/v1/policies", options); }
  async createPolicy(input, options) { return this.request("/api/v1/policies", { ...options, method: "POST", body: await this.organizationScopedInput(input, options) }); }
  listNodes(options) { return this.request("/api/v1/nodes", options); }
  async createNode(input, options) { return this.request("/api/v1/nodes", { ...options, method: "POST", body: await this.organizationScopedInput(input, options) }); }
  listDeployments(options) { return this.request("/api/v1/deployments", options); }
  async createDeployment(input, options) { return this.request("/api/v1/deployments", { ...options, method: "POST", body: await this.organizationScopedInput(input, options) }); }
  listVerifications(options) { return this.request("/api/v1/verifications", options); }
  async createVerificationRecord(input, options) { return this.request("/api/v1/verifications", { ...options, method: "POST", body: await this.organizationScopedInput(input, options) }); }
  listAuditEvents(options) { return this.request("/api/v1/audit", options); }
  listWebhooks(options) { return this.request("/api/v1/developer/webhooks", options); }
}
