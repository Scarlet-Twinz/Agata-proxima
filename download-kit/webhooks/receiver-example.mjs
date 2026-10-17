import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';

const secret = process.env.AGATA_WEBHOOK_SIGNING_SECRET;
const port = Number(process.env.PORT || 8788);
if (!secret) throw new Error('Set AGATA_WEBHOOK_SIGNING_SECRET from the endpoint creation/rotation response.');

function verify(rawBody, header, toleranceSeconds = 300) {
  const values = Object.fromEntries(String(header || '').split(',').map((part) => {
    const i = part.indexOf('='); return i > 0 ? [part.slice(0, i), part.slice(i + 1)] : ['', ''];
  }).filter(([k]) => k));
  const timestamp = Number(values.t);
  const signature = values.v1 || '';
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest();
  let actual;
  try { actual = Buffer.from(signature, 'hex'); } catch { return false; }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const server = createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/webhooks/agata') { res.writeHead(404).end(); return; }
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const rawBody = Buffer.concat(chunks);
    if (!verify(rawBody, req.headers['x-agata-signature'])) { res.writeHead(401).end('Invalid signature'); return; }
    let event;
    try { event = JSON.parse(rawBody.toString('utf8')); }
    catch { res.writeHead(400).end('Invalid JSON'); return; }
    const deliveryId = req.headers['x-agata-delivery-id'];
    if (!deliveryId) { res.writeHead(400).end('Missing delivery ID'); return; }
    // TODO: persist deliveryId with a UNIQUE constraint before side effects.
    // TODO: deduplicate repeats and durably queue downstream work.
    console.log(JSON.stringify({ accepted: true, deliveryId, eventType: event.type }));
    res.writeHead(202, { 'Content-Type': 'application/json' }).end(JSON.stringify({ accepted: true }));
  });
});
server.listen(port, () => console.log(`Example receiver listening on ${port}`));
