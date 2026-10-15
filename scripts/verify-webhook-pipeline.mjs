import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const read = (file) => fs.readFileSync(path.resolve(file), "utf8");
const main = read("crates/proxima-control-plane/src/main.rs");
const worker = read("crates/proxima-control-plane/src/webhooks.rs");
const migration = read("crates/proxima-control-plane/migrations/0021_webhook_delivery_pipeline.sql");
const ui = read("frontend/src/pages/console/NestedResource.tsx");
const css = read("frontend/src/styles/console.css");
const lock = read("Cargo.lock");
const cargo = read("crates/proxima-control-plane/Cargo.toml");

const checks = [
  ["webhook worker module is wired into control plane", main.includes("mod webhooks;") && main.includes("webhooks::worker_tick")],
  ["new migration is executed at startup", main.includes("0021_webhook_delivery_pipeline.sql")],
  ["audit events enqueue subscribed webhook deliveries", main.includes("webhooks::enqueue_audit_event") && worker.includes("INSERT INTO webhook_deliveries")],
  ["signing secrets are encrypted at rest", worker.includes("AES_256_GCM") && worker.includes("signing_secret_ciphertext")],
  ["signatures use HMAC-SHA256", worker.includes("type HmacSha256 = Hmac<Sha256>") && worker.includes("X-Agata-Signature")],
  ["destinations reject private address resolution and redirects", worker.includes("public_ip(addr.ip())") && worker.includes("redirect(reqwest::redirect::Policy::none())")],
  ["delivery attempts are bounded and retried", migration.includes("max_attempts") && worker.includes("dead_letter") && worker.includes("schedule_failure")],
  ["manual retry, secret rotation and enable/disable routes exist", main.includes("retry_webhook_delivery") && main.includes("rotate_webhook_secret") && main.includes("set_webhook_enabled")],
  ["dashboard uses live webhook APIs", ui.includes("/api/v1/developer/webhooks") && ui.includes("/deliveries") && ui.includes("rotate-secret")],
  ["dashboard contains real endpoint and delivery controls", ui.includes("Create endpoint") && ui.includes("Delivery history") && css.includes(".webhook-delivery-row")],
  ["ring dependency is locked", cargo.includes('ring = "0.17.14"') && lock.includes('"ring",')],
  ["no fake delivery records are inserted by the dashboard", !ui.includes("mockWebhook") && !ui.includes("fakeDelivery")],
];

let failed = 0;
for (const [name, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
  if (!passed) failed++;
}
console.log(`\nWebhook static audit: ${checks.length - failed}/${checks.length} checks passed.`);
if (failed) process.exit(1);
