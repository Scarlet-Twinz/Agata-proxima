#!/usr/bin/env node
import { AgataClient } from "../node/agata-client.mjs";

const usage = `Agata Proxima CLI

Usage:
  agata whoami
  agata health
  agata plans list
  agata tenants list
  agata policies list
  agata nodes list
  agata deployments list
  agata verification list
  agata audit list
  agata webhooks list
  agata environments list

Configuration:
  AGATA_API_BASE_URL  Control Plane API origin
  AGATA_API_KEY       Organization-scoped API key (aga_...)

Examples:
  agata whoami
  agata health
  agata tenants list
  agata verification list
  agata environments list

This CLI reads organization-scoped resources. It does not claim to execute
runtime tenant-isolation tests; verification list shows recorded results.`;

const [resource, action] = process.argv.slice(2);
if (!resource || resource === "--help" || resource === "-h" || resource === "help") {
  console.log(usage);
  process.exit(resource ? 0 : 2);
}
const commands = {
  whoami: [undefined, (client) => client.session()],
  health: ["health", (client) => client.health()],
  plans: ["list", (client) => client.listPlans()],
  tenants: ["list", (client) => client.listTenants()],
  policies: ["list", (client) => client.listPolicies()],
  nodes: ["list", (client) => client.listNodes()],
  deployments: ["list", (client) => client.listDeployments()],
  verification: ["list", (client) => client.listVerifications()],
  audit: ["list", (client) => client.listAuditEvents()],
  webhooks: ["list", (client) => client.listWebhooks()],
  environments: ["list", (client) => client.listEnvironments()],
};
const command = commands[resource];
if (!command || (resource === "health" && action !== undefined) || (resource === "whoami" && action !== undefined) || (resource !== "health" && resource !== "whoami" && action !== command[0])) {
  console.error(usage);
  process.exit(2);
}
try {
  const client = new AgataClient();
  const result = await command[1](client);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const status = error?.status ? ` (HTTP ${error.status})` : "";
  console.error(`Agata CLI error${status}: ${error?.message ?? String(error)}`);
  if (error?.code) console.error(`Code: ${error.code}`);
  if (error?.requestId) console.error(`Request ID: ${error.requestId}`);
  process.exitCode = 1;
}
