import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";

const secret = process.env.AGATA_WEBHOOK_SIGNING_SECRET;
const port = Number(process.env.PORT || 8788);
const MAX_BODY_BYTES = 1024 * 1024;
const SIGNATURE_TOLERANCE_SECONDS = 300;
const DEDUPE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_DEDUPE_ENTRIES = 10_000;

if (!secret) throw new Error("Set AGATA_WEBHOOK_SIGNING_SECRET from the endpoint creation/rotation response.");
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be a valid TCP port.");

const acceptedDeliveries = new Map();

function verify(rawBody, header, toleranceSeconds = SIGNATURE_TOLERANCE_SECONDS) {
  const values = Object.fromEntries(String(header || "").split(",").map((part) => {
    const i = part.indexOf("=");
    return i > 0 ? [part.slice(0, i).trim(), part.slice(i + 1).trim()] : ["", ""];
  }).filter(([key]) => key));
  const timestamp = Number(values.t);
  const signature = values.v1 || "";
  if (!Number.isSafeInteger(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false;
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.`).update(rawBody).digest();
  const actual = Buffer.from(signature, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function pruneDedupe(now = Date.now()) {
  for (const [id, acceptedAt] of acceptedDeliveries) {
    if (now - acceptedAt > DEDUPE_TTL_MS) acceptedDeliveries.delete(id);
  }
  while (acceptedDeliveries.size > MAX_DEDUPE_ENTRIES) {
    acceptedDeliveries.delete(acceptedDeliveries.keys().next().value);
  }
}

function respond(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

const server = createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/webhooks/agata") {
    respond(res, 404, { error: "not_found" });
    return;
  }
  if (!String(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
    respond(res, 415, { error: "application_json_required" });
    return;
  }

  const chunks = [];
  let size = 0;
  let tooLarge = false;
  req.on("data", (chunk) => {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      tooLarge = true;
      chunks.length = 0;
      return;
    }
    if (!tooLarge) chunks.push(chunk);
  });
  req.on("error", () => {
    if (!res.headersSent) respond(res, 400, { error: "request_read_failed" });
  });
  req.on("end", () => {
    if (tooLarge) {
      respond(res, 413, { error: "payload_too_large", max_bytes: MAX_BODY_BYTES });
      return;
    }
    const rawBody = Buffer.concat(chunks);
    if (!verify(rawBody, req.headers["x-agata-signature"])) {
      respond(res, 401, { error: "invalid_signature" });
      return;
    }

    let event;
    try { event = JSON.parse(rawBody.toString("utf8")); }
    catch { respond(res, 400, { error: "invalid_json" }); return; }

    const deliveryId = String(req.headers["x-agata-delivery-id"] || "");
    if (!deliveryId || deliveryId.length > 200) {
      respond(res, 400, { error: "invalid_delivery_id" });
      return;
    }

    pruneDedupe();
    if (acceptedDeliveries.has(deliveryId)) {
      respond(res, 202, { accepted: true, duplicate: true });
      return;
    }

    // Demo-only idempotency: replace this Map with a durable table that has
    // a UNIQUE delivery_id constraint before triggering production side effects.
    acceptedDeliveries.set(deliveryId, Date.now());
    pruneDedupe();

    // Do not log the full payload: it may contain customer or operational data.
    console.log(JSON.stringify({
      accepted: true,
      deliveryId,
      eventId: req.headers["x-agata-event-id"] || event.id || null,
      eventType: req.headers["x-agata-event"] || event.type || "unknown",
    }));
    respond(res, 202, { accepted: true, duplicate: false });
  });
});

server.requestTimeout = 10_000;
server.headersTimeout = 12_000;
server.listen(port, () => console.log(`Agata webhook receiver listening on port ${port}`));
