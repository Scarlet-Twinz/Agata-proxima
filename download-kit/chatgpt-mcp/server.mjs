import { timingSafeEqual } from 'node:crypto';
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { AgataClient } from '../node/agata-client.mjs';

const port = Number(process.env.PORT || 8787);
const accessToken = process.env.AGATA_MCP_ACCESS_TOKEN;
if (!accessToken || accessToken.length < 32) {
  throw new Error('AGATA_MCP_ACCESS_TOKEN must be a random secret with at least 32 characters');
}
const agata = new AgataClient();
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb', type: ['application/json', 'application/*+json'] }));

function authorized(req) {
  const value = req.get('authorization') || '';
  const prefix = 'Bearer ';
  if (!value.startsWith(prefix)) return false;
  const supplied = Buffer.from(value.slice(prefix.length));
  const expected = Buffer.from(accessToken);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function createMcpServer() {
  const server = new McpServer({ name: 'agata-proxima-connector', version: '1.0.0' });
  server.tool('agata_health', 'Check the configured Agata Proxima control-plane health.', {}, async () => {
    const result = await agata.health();
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  });
  server.tool('agata_list_plans', 'Read the public Agata Proxima plan catalogue.', {}, async () => {
    const result = await agata.plans();
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  });
  server.tool('agata_list_tenants', 'Read tenants visible to the organization-scoped Agata API key. Do not use this tool to infer authorization for another organization.', {}, async () => {
    const result = await agata.tenants();
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  });
  return server;
}

app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));
app.post('/mcp', async (req, res) => {
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('close', () => { void transport.close(); void server.close(); });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ error: 'mcp_request_failed' });
    console.error('MCP request failed:', error instanceof Error ? error.message : 'unknown error');
  }
});
app.all('/mcp', (_req, res) => res.status(405).json({ error: 'method_not_allowed' }));
app.listen(port, '0.0.0.0', () => console.log(`Agata MCP endpoint listening on port ${port}`));
