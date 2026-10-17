import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pub = path.join(root, 'frontend', 'src', 'pages', 'public');
const read = (name) => fs.readFileSync(path.join(pub, name), 'utf8');
const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });

const faq = read('FAQ.tsx');
const home = read('Home.tsx');
const docs = read('Docs.tsx');
const details = read('PublicDetail.tsx');
const usage = read('UsageGuide.tsx');
const company = read('Company.tsx');
const troubleStart = details.indexOf('  \"/docs/troubleshooting\": {');
const troubleEnd = details.indexOf('  \"/docs/verification\": {', troubleStart);
const troubleshooting = details.slice(troubleStart, troubleEnd);

check('FAQ contains at least 15 substantive questions', (faq.match(/^  \["/gm) || []).length >= 15, `count=${(faq.match(/^  \["/gm) || []).length}`);
check('Company page explains purpose, audience, limits and progress', ['The problem we are focused on', 'Who it is for', 'What Agata Proxima is not', 'How we measure progress'].every(s => company.includes(s)));
check('Updated public content does not introduce billing-provider claims', !['Paystack', 'Paddle', 'Lemon Squeezy', 'Flutterwave'].some(name => fs.readdirSync(pub).filter(f => f.endsWith('.tsx') && f !== 'Pricing.tsx').some(f => fs.readFileSync(path.join(pub, f), 'utf8').toLowerCase().includes(name.toLowerCase()))));
check('Usage guide does not duplicate plan quota values', !/Free: 1 node|Starter: 2 nodes|Growth: 5 nodes|Scale: 15 nodes/.test(usage));
check('Docs home contains an ordered first-integration workflow', docs.includes('FIRST INTEGRATION') && docs.includes('docs-step-list'));
check('Getting-started guide includes step-by-step acceptance', details.includes('Step 1 — Sign in and confirm organization') && details.includes('Completion criteria'));
check('Troubleshooting covers authentication, API, resources, data path, webhooks, email, billing and migrations', ['Sign-in fails', 'API returns 401', 'A list or detail page is empty', 'Tenant, policy, node or deployment', 'Webhook endpoint exists', 'Email verification', 'Billing or plan features', 'Database migration'].every(s => troubleshooting.includes(s)));
check('Webhook guide documents signature, retry and acceptance procedure', details.includes('HMAC-SHA256 input') && details.includes('Acceptance checklist'));
check('API guide includes authenticated request example without a hardcoded API key', details.includes('AGATA_API_KEY is not set') && !details.includes('Bearer aga_'));
check('SDK/CLI/Terraform guides describe release verification without implying an unverified artifact', details.includes('Versioned source and documented command contract') && details.includes('must be published under a verified registry namespace') && details.includes('Install a versioned package or binary only from its verified release source'));

let failed = 0;
for (const item of checks) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}${item.detail ? ` (${item.detail})` : ''}`);
  if (!item.ok) failed++;
}
console.log(`\nPublic content audit: ${checks.length - failed}/${checks.length} passed.`);
if (failed) process.exit(1);
