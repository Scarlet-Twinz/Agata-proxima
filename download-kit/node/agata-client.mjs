export class AgataClient {
  constructor({ baseUrl = process.env.AGATA_API_BASE_URL, apiKey = process.env.AGATA_API_KEY, fetchImpl = fetch } = {}) {
    if (!baseUrl) throw new Error('AGATA_API_BASE_URL is required');
    if (!apiKey || !apiKey.startsWith('aga_')) throw new Error('AGATA_API_KEY must be an organization-scoped Agata key');
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
  }

  async request(path, { method = 'GET', body, signal } = {}) {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : undefined; }
    catch { data = { message: text.slice(0, 500) }; }
    if (!response.ok) {
      const error = new Error(data?.message || `Agata API returned ${response.status}`);
      error.status = response.status;
      error.code = data?.error;
      throw error;
    }
    return data;
  }

  health(options) { return this.request('/api/v1/health', options); }
  plans(options) { return this.request('/api/v1/billing/plans', options); }
  tenants(options) { return this.request('/api/v1/tenants', options); }
}
