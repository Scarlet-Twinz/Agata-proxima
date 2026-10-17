#!/usr/bin/env node
import { AgataClient } from "../node/agata-client.mjs";

const usage = `Agata Proxima CLI (Node.js 22+)

Usage:
  agata health
  agata whoami
  agata plans list
  agata tenants list
  agata policies list
  agata nodes list
  agata deployments list
  agata verification list
  agata audit list
  agata api-keys list
  agata api-keys create --name "CI integration"
  agata api-keys revoke <key-id>
  agata webhooks list
  agata webhooks deliveries <webhook-id>
  agata webhooks retry <webhook-id> <delivery-id>
  agata webhooks enable <webhook-id>
  agata webhooks disable <webhook-id>
  agata webhooks rotate-secret <webhook-id>
  agata environments list
  agata environments create --name "Staging" [--slug staging] [--description "..."]
  agata environments enable <environment-id>
  agata environments disable <environment-id>
  agata environments delete <environment-id>

Configuration:
  AGATA_API_BASE_URL  Control Plane API origin
  AGATA_API_KEY       Organization-scoped API key (aga_...)

Security:
  Keep the API key in a server-side secret store. A newly created API key's
  full value is printed once; capture it securely. Environment labels are not
  a network/database/secret isolation boundary.`;

function option(args, name) {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  if (index + 1 >= args.length || args[index + 1].startsWith("--")) {
    throw new Error(`Option ${name} requires a value.`);
  }
  return args[index + 1];
}
function required(value, label) {
  if (!value?.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

const [resource, action, ...args] = process.argv.slice(2);
if (!resource || ["help", "--help", "-h"].includes(resource)) {
  console.log(usage);
  process.exit(resource ? 0 : 2);
}
try {
  const client = new AgataClient();
  let result;
  if (resource === "health" && !action) result = await client.health();
  else if (resource === "whoami" && !action) result = await client.session();
  else if (resource === "plans" && action === "list") result = await client.listPlans();
  else if (resource === "tenants" && action === "list") result = await client.listTenants();
  else if (resource === "policies" && action === "list") result = await client.listPolicies();
  else if (resource === "nodes" && action === "list") result = await client.listNodes();
  else if (resource === "deployments" && action === "list") result = await client.listDeployments();
  else if (resource === "verification" && action === "list") result = await client.listVerifications();
  else if (resource === "audit" && action === "list") result = await client.listAuditEvents();
  else if (resource === "api-keys" && action === "list") result = await client.listApiKeys();
  else if (resource === "api-keys" && action === "create") result = await client.createApiKey(required(option(args, "--name"), "--name"));
  else if (resource === "api-keys" && action === "revoke") result = await client.revokeApiKey(required(args[0], "API key ID"));
  else if (resource === "webhooks" && action === "list") result = await client.listWebhooks();
  else if (resource === "webhooks" && action === "deliveries") result = await client.listWebhookDeliveries(required(args[0], "Webhook ID"));
  else if (resource === "webhooks" && action === "retry") result = await client.retryWebhookDelivery(required(args[0], "Webhook ID"), required(args[1], "Delivery ID"));
  else if (resource === "webhooks" && ["enable", "disable"].includes(action)) result = await client.setWebhookEnabled(required(args[0], "Webhook ID"), action === "enable");
  else if (resource === "webhooks" && action === "rotate-secret") result = await client.rotateWebhookSecret(required(args[0], "Webhook ID"));
  else if (resource === "environments" && action === "list") result = await client.listEnvironments();
  else if (resource === "environments" && action === "create") {
    result = await client.createEnvironment({
      name: required(option(args, "--name"), "--name"),
      ...(option(args, "--slug") ? { slug: option(args, "--slug") } : {}),
      ...(option(args, "--description") ? { description: option(args, "--description") } : {}),
    });
  } else if (resource === "environments" && ["enable", "disable"].includes(action)) {
    result = await client.updateEnvironment(required(args[0], "Environment ID"), { status: action === "enable" ? "active" : "disabled" });
  } else if (resource === "environments" && action === "delete") {
    result = await client.deleteEnvironment(required(args[0], "Environment ID"));
  } else {
    console.error(usage);
    process.exitCode = 2;
  }
  if (result !== undefined) console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const status = error?.status ? ` (HTTP ${error.status})` : "";
  console.error(`Agata CLI error${status}: ${error?.message ?? String(error)}`);
  if (error?.code) console.error(`Code: ${error.code}`);
  if (error?.requestId) console.error(`Request ID: ${error.requestId}`);
  process.exitCode = 1;
}
