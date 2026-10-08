export class AgataError extends Error {
  constructor(message, status = 0, body = null) {
    super(message);
    this.name = "AgataError";
    this.status = status;
    this.body = body;
  }
}

export class AgataProxima {
  constructor({ controlPlaneUrl, environmentId, credential, fetchImpl = globalThis.fetch }) {
    if (!controlPlaneUrl) throw new TypeError("controlPlaneUrl is required");
    if (!environmentId) throw new TypeError("environmentId is required");
    if (!credential) throw new TypeError("credential is required");
    if (typeof fetchImpl !== "function") throw new TypeError("fetch is required");
    this.baseUrl = controlPlaneUrl.replace(/\/$/, "");
    this.environmentId = environmentId;
    this.credential = credential;
    this.fetch = fetchImpl;
  }

  async tenantContext(tenantId) {
    const response = await this.fetch(this.baseUrl + "/api/v1/customer/context", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer " + this.credential
      },
      body: JSON.stringify({
        environment_id: this.environmentId,
        tenant_id: tenantId
      })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.token) {
      throw new AgataError(body.message || "Agata tenant-context exchange failed.", response.status, body);
    }
    return {
      token: body.token,
      tenantId: body.tenant_id,
      organizationId: body.organization_id,
      environmentId: body.environment_id,
      integrationId: body.integration_id,
      expiresAt: body.expires_at
    };
  }

  postgresOptions(token) {
    if (!token) throw new TypeError("tenant context token is required");
    return { options: "-c proxima_tenant_token=" + token };
  }

  connectionEnvironment(token) {
    return {
      ...this.postgresOptions(token),
      environmentId: this.environmentId
    };
  }
}
