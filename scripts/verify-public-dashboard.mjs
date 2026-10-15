import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'frontend', 'src');
const failures = [];
const checks = [];

function read(relative) {
  const file = path.join(src, relative);
  if (!fs.existsSync(file)) {
    failures.push(`Missing required source file: ${relative}`);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
}

function addCheck(label, ok, detail = '') {
  checks.push({ label, ok, detail });
  if (!ok) failures.push(`${label}${detail ? `: ${detail}` : ''}`);
}

const router = read('app/router.tsx');
const publicDetail = read('pages/public/PublicDetail.tsx');
const home = read('pages/public/Home.tsx');
const docs = read('pages/public/Docs.tsx');
const overview = read('pages/console/Overview.tsx');
const resourceSurface = read('components/console/ResourceSurface.tsx');
const nested = read('pages/console/NestedResource.tsx');

const declaredRoutes = new Set([
  '/', '/product', '/solutions', '/developers', '/pricing', '/security', '/trust',
  '/company', '/docs', '/docs/usage', '/changelog', '/status', '/faq', '/support',
  '/contact', '/support/request', '/terms', '/privacy', '/login', '/signup',
  '/recovery', '/app',
]);

const detailBlock = router.match(/const detailRoutes\s*=\s*\[([\s\S]*?)\n\];/);
if (!detailBlock) {
  addCheck('Public detail route registry exists', false);
} else {
  const detailRoutes = [...detailBlock[1].matchAll(/"([^\"]+)"/g)].map((match) => match[1]);
  detailRoutes.forEach((route) => declaredRoutes.add(route));
  const detailKeys = new Set([...publicDetail.matchAll(/^\s*"(\/[^"\n]+)"\s*:/gm)].map((match) => match[1]));
  const missingArticles = detailRoutes.filter((route) => !detailKeys.has(route));
  addCheck('Every PublicDetail route has an article definition', missingArticles.length === 0, missingArticles.join(', '));
}

const consoleResourceBlock = router.match(/const consoleResourceRoutes\s*=\s*\[([\s\S]*?)\n\];/);
if (consoleResourceBlock) {
  for (const match of consoleResourceBlock[1].matchAll(/path:\s*"([^\"]+)"/g)) declaredRoutes.add(`/app/${match[1]}`);
}
const nestedBlock = router.match(/const nestedConsoleRoutes\s*=\s*\[([\s\S]*?)\n\]\.map/);
const nestedPaths = nestedBlock ? [...nestedBlock[1].matchAll(/"([^\"]+)"/g)].map((match) => `/app/${match[1]}`) : [];
nestedPaths.forEach((route) => declaredRoutes.add(route));
for (const match of router.matchAll(/\{\s*path:\s*"([^\"]+)"\s*,\s*element:\s*<ActionPage/g)) declaredRoutes.add(`/app/${match[1]}`);

const routePatterns = [...declaredRoutes].map((route) => new RegExp(`^${route.split('/').map((segment) => segment.startsWith(':') ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('/')}$`));
const internalTargets = [];
const tsxFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (entry.isFile() && entry.name.endsWith('.tsx')) tsxFiles.push(absolute);
  }
}
walk(src);
for (const file of tsxFiles) {
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(/\bto="(\/[^"]*)"/g)) {
    const target = match[1].split(/[?#]/, 1)[0];
    if (target.startsWith('/api/') || target.startsWith('/assets/') || target.startsWith('/verify-email') || target.startsWith('/reset-password') || target.startsWith('/accept-invite')) continue;
    internalTargets.push({ target, file: path.relative(root, file) });
  }
}
const missingTargets = internalTargets.filter(({ target }) => !routePatterns.some((pattern) => pattern.test(target)));
addCheck('Literal internal navigation targets resolve to declared routes', missingTargets.length === 0, missingTargets.map(({ target, file }) => `${target} (${file})`).join('; '));

const nestedConfigKeys = new Set([...nested.matchAll(/^\s*"(\/app\/[^"\n]+)"\s*:/gm)].map((match) => match[1]));
const dynamicBases = [...new Set(nestedPaths.filter((route) => route.includes('/:')).map((route) => route.replace(/\/:[^/]+$/, '')))];
const missingDynamicConfigs = dynamicBases.filter((base) => !nestedConfigKeys.has(base));
addCheck('Dynamic console detail routes have explicit resource configurations', missingDynamicConfigs.length === 0, missingDynamicConfigs.join(', '));

for (const base of dynamicBases.filter((route) => ['/app/tenants', '/app/policies', '/app/nodes', '/app/deployments', '/app/audit', '/app/verification', '/app/team/members', '/app/developer/api-keys', '/app/developer/webhooks'].includes(route))) {
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const entry = nested.match(new RegExp(`^\\s*"${escaped}"\\s*:\\s*\\{([^\\n]*)`, 'm'));
  addCheck(`Dynamic detail configuration includes an API endpoint (${base})`, Boolean(entry && /endpoint\s*:/.test(entry[1])));
}

addCheck('Homepage describes Agata integration capabilities without unrelated provider promotions', /Authenticated APIs/.test(home) && /Webhooks and events/.test(home) && !/Resend|Stripe/.test(home));
addCheck('Documentation home includes learning path and provider-neutral integration guidance', /RECOMMENDED PATH/.test(docs) && /Authenticated APIs/.test(docs) && /Webhooks and automation/.test(docs) && !/Resend|Stripe/.test(docs));
addCheck('Dashboard overview includes an operating guide', /WORKSPACE GUIDE/.test(overview) && /Verification guide/.test(overview));
addCheck('Resource pages include actionable empty-state guidance', /No records have been created yet/.test(resourceSurface) && /Troubleshoot missing data/.test(resourceSurface));
addCheck('Missing ArrowLeft icon import is corrected', /import\s*\{[^}]*\bArrowLeft\b[^}]*\}\s*from\s*"lucide-react"/.test(resourceSurface));

console.log('\nAgata Proxima public/dashboard static acceptance audit');
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'}  ${check.label}${check.detail ? ` — ${check.detail}` : ''}`);
}
console.log(`\nSummary: ${checks.filter((check) => check.ok).length}/${checks.length} checks passed; ${internalTargets.length} literal internal navigation targets inspected.`);
if (failures.length) process.exit(1);
