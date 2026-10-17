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
const login = read('pages/auth/Login.tsx');
const authApi = read('api/auth.ts');
const recovery = read('pages/auth/Recovery.tsx');
const resetPassword = read('pages/auth/ResetPassword.tsx');
const consoleSurfaces = read('pages/console/ConsoleSurfaces.tsx');
const actionPage = read('pages/console/ActionPage.tsx');
const footer = read('components/layout/PublicFooter.tsx');
const activityChart = read('components/console/charts/ActivityChart.tsx');
const controlPlane = fs.readFileSync(path.join(root, 'crates', 'proxima-control-plane', 'src', 'main.rs'), 'utf8');
const tenantScopeMigration = fs.readFileSync(path.join(root, 'crates', 'proxima-control-plane', 'migrations', '0025_tenant_organization_boundary.sql'), 'utf8');

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
addCheck('Keep me signed in is wired from checkbox to persistent server session', /rememberMe/.test(login) && /login\(email,password,rememberMe\)/.test(login) && /remember_me:rememberMe/.test(authApi) && /interval '30 days'/.test(controlPlane) && /interval '12 hours'/.test(controlPlane));
addCheck('Tenant organization scope is backfilled and constrained by its owning project', /0025_tenant_organization_boundary\.sql/.test(controlPlane) && /UPDATE tenants AS t/.test(tenantScopeMigration) && /ALTER COLUMN organization_id SET NOT NULL/.test(tenantScopeMigration) && /tenants_project_organization_fkey/.test(tenantScopeMigration));
addCheck('Password recovery request and confirmation are connected', /requestPasswordReset\(email\.trim\(\)\)/.test(recovery) && /resetPassword\(token,\s*password\)/.test(resetPassword) && /password-reset\/request/.test(authApi) && /password-reset\/confirm/.test(authApi) && router.includes('path: "/reset-password"'));
addCheck('Security posture uses authenticated live control-plane signals', /api\.get<SecurityOverview>\("\/api\/v1\/control-plane\/overview"\)/.test(consoleSurfaces) && /tenantIsolation/.test(consoleSurfaces) && /databaseProtection/.test(consoleSurfaces));
addCheck('Verification UI and backend distinguish operator-reported evidence from executed tests', /operator_reported/.test(controlPlane) && /form\.status\|\|"review"/.test(actionPage) && /does not execute the test/.test(actionPage));
addCheck('Activity chart labels a full daily series and handles zero activity', /generate_series\(/.test(controlPlane) && /interval '29 days'/.test(controlPlane) && /chart-axis-labels/.test(activityChart) && /No verification records in the last 30 days/.test(activityChart));
addCheck('Homepage exposes the integration starter kit and footer includes requested social brands', /to="\/developers\/downloads"/.test(home) && ['GitHub','LinkedIn','Twitter','Hacker News'].every(label => footer.includes(label)));

console.log('\nAgata Proxima public/dashboard static acceptance audit');
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'}  ${check.label}${check.detail ? ` — ${check.detail}` : ''}`);
}
console.log(`\nSummary: ${checks.filter((check) => check.ok).length}/${checks.length} checks passed; ${internalTargets.length} literal internal navigation targets inspected.`);
if (failures.length) process.exit(1);
