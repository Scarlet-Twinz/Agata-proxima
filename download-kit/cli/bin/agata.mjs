#!/usr/bin/env node
import { AgataClient } from "../node/agata-client.mjs";

const usage = `Agata Proxima CLI

Read commands:
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
  agata webhooks deliveries <webhook-id>
  agata environments list

Environment management:
  agata environments create --name "Staging" [--slug staging] [--description "..."]
  agata environments update <id> [--name "..."] [--description "..."] [--status active|disabled]
  agata environments enable <id>
  agata environments disable <id>
  agata environments delete <id>

Webhook management:
  agata webhooks create --name "Audit receiver" --url https://example.test/hooks --events "*"
  agata webhooks enable <id>
  agata webhooks disable <id>
  agata webhooks delete <id>
  agata webhooks retry <id> <delivery-id>
  agata webhooks rotate-secret <id>

Configuration:
  AGATA_API_BASE_URL  Control Plane API origin
  AGATA_API_KEY       Organization-scoped API key (aga_...)

Options accept --name value, --slug value, --description value, --status value,
--url value and --events comma,separated. Quote values containing spaces.
The CLI cannot create/revoke API keys: the API deliberately restricts that to an
authenticated dashboard session. The server enforces organization scope and roles.`;

function parseFlags(args) {
  const values = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!key.startsWith("--") || i + 1 >= args.length || args[i + 1].startsWith("--")) throw new Error("Expected a flag followed by a value: " + key);
    values[key.slice(2)] = args[++i];
  }
  return values;
}
function requireValue(value, name) {
  if (!value || !value.trim()) throw new Error("--" + name + " is required.");
  return value.trim();
}
const [resource, action, ...rest] = process.argv.slice(2);
if (!resource || ["--help", "-h", "help"].includes(resource)) {
  console.log(usage);
  process.exit(resource ? 0 : 2);
}

try {
  const client = new AgataClient();
  let result;
  if (resource === "whoami" && !action) result = await client.session();
  else if (resource === "health" && !action) result = await client.health();
  else if (resource === "plans" && action === "list" && rest.length === 0) result = await client.listPlans();
  else if (resource === "tenants" && action === "list" && rest.length === 0) result = await client.listTenants();
  else if (resource === "policies" && action === "list" && rest.length === 0) result = await client.listPolicies();
  else if (resource === "nodes" && action === "list" && rest.length === 0) result = await client.listNodes();
  else if (resource === "deployments" && action === "list" && rest.length === 0) result = await client.listDeployments();
  else if (resource === "verification" && action === "list" && rest.length === 0) result = await client.listVerifications();
  else if (resource === "audit" && action === "list" && rest.length === 0) result = await client.listAuditEvents();
  else if (resource === "environments" && action === "list" && rest.length === 0) result = await client.listEnvironments();
  else if (resource === "environments" && action === "create") {
    const flags = parseFlags(rest);
    result = await client.createEnvironment({ name: requireValue(flags.name, "name"), ...(flags.slug ? { slug: flags.slug } : {}), ...(flags.description ? { description: flags.description } : {}) });
  } else if (resource === "environments" && action === "update") {
    const [id, ...flagsArgs] = rest; if (!id) throw new Error("Environment ID is required.");
    const flags = parseFlags(flagsArgs), body = {};
    if (flags.name) body.name = flags.name;
    if (flags.description !== undefined) body.description = flags.description;
    if (flags.status) { if (!["active", "disabled"].includes(flags.status)) throw new Error("--status must be active or disabled."); body.status = flags.status; }
    if (!Object.keys(body).length) throw new Error("Provide at least one of --name, --description or --status.");
    result = await client.updateEnvironment(id, body);
  } else if (resource === "environments" && ["enable", "disable"].includes(action) && rest.length === 1) {
    result = await client.updateEnvironment(rest[0], { status: action === "enable" ? "active" : "disabled" });
  } else if (resource === "environments" && action === "delete" && rest.length === 1) result = await client.deleteEnvironment(rest[0]);
  else if (resource === "webhooks" && action === "list" && rest.length === 0) result = await client.listWebhooks();
  else if (resource === "webhooks" && action === "deliveries" && rest.length === 1) result = await client.listWebhookDeliveries(rest[0]);
  else if (resource === "webhooks" && action === "create") {
    const flags = parseFlags(rest);
    const events = requireValue(flags.events, "events").split(",").map((event) => event.trim()).filter(Boolean);
    if (!events.length) throw new Error("--events must contain at least one event or *.");
    result = await client.createWebhook({ name: requireValue(flags.name, "name"), endpoint_url: requireValue(flags.url, "url"), events });
  } else if (resource === "webhooks" && ["enable", "disable"].includes(action) && rest.length === 1) result = await client.setWebhookEnabled(rest[0], action === "enable");
  else if (resource === "webhooks" && action === "delete" && rest.length === 1) result = await client.deleteWebhook(rest[0]);
  else if (resource === "webhooks" && action === "retry" && rest.length === 2) result = await client.retryWebhookDelivery(rest[0], rest[1]);
  else if (resource === "webhooks" && action === "rotate-secret" && rest.length === 1) result = await client.rotateWebhookSecret(rest[0]);
  else { console.error(usage); process.exitCode = 2; }
  if (result !== undefined) console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const status = error?.status ? " (HTTP " + error.status + ")" : "";
  console.error("Agata CLI error" + status + ": " + (error?.message ?? String(error)));
  if (error?.code) console.error("Code: " + error.code);
  if (error?.requestId) console.error("Request ID: " + error.requestId);
  process.exitCode = 1;
}
