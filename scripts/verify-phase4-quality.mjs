import fs from "node:fs";
import assert from "node:assert/strict";

const read = (path) => fs.readFileSync(path, "utf8");
const router = read("frontend/src/app/router.tsx");
const overview = read("frontend/src/pages/console/Overview.tsx");
const guide = read("frontend/src/pages/console/DashboardGuide.tsx");
const company = read("frontend/src/pages/public/Company.tsx");
const detail = read("frontend/src/pages/public/PublicDetail.tsx");

const checks = [
  ["Dedicated dashboard guide route exists", /path: "guide", element: <DashboardGuide \/>/.test(router)],
  ["Overview links to detailed dashboard guide", /to="\/app\/guide"/.test(overview) && /Dashboard guide/.test(overview)],
  ["Guide gives detailed API-key creation steps", /Create an API key and make an API request/.test(guide) && /secure secret store/.test(guide)],
  ["Guide links to support", /Contact support/.test(guide) && /to="\/app\/support"/.test(guide)],
  ["Guide includes tenant, policy, deployment and verification workflows", ["Create and manage tenants", "Configure policies, nodes and deployments", "Run verification and inspect evidence"].every((s) => guide.includes(s))],
  ["Guide warns that configuration is not proof of runtime enforcement", /does not prove that a runtime has received or enforced it/.test(guide)],
  ["Company page explains problem, audience, limitations and progress", ["The problem we are focused on", "Who it is for", "What Agata Proxima is not", "How we measure progress"].every((s) => company.includes(s))],
  ["SDK guide does not claim an official SDK release", /official Agata Proxima SDK package has been released/.test(detail)],
  ["CLI guide distinguishes API automation from a released CLI", /official Agata Proxima CLI binary or package is actually published/.test(detail)],
  ["Terraform guide avoids inventing a provider address", /official Agata Proxima Terraform provider is currently published/.test(detail)],
  ["API examples guard against missing credentials and avoid hardcoded keys", /AGATA_API_KEY is not set/.test(detail) && !/Bearer aga_[A-Za-z0-9]/.test(detail)],
  ["Code examples are rendered by the public detail page", /section\.code && <pre className="public-code-block"/.test(detail)],
];

let failed = 0;
for (const [label, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"} ${label}`);
  if (!passed) failed += 1;
}
console.log(`\nPhase 4 focused checks: ${checks.length - failed}/${checks.length} passed`);
if (failed) process.exitCode = 1;
