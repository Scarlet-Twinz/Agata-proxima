import { createBrowserRouter } from "react-router-dom";
import { PublicLayout } from "../layouts/PublicLayout";
import AuthLayout from "../layouts/auth/AuthLayout";
import { ConsoleLayout } from "../layouts/console/ConsoleLayout";

import { Home } from "../pages/public/Home";
import { Product } from "../pages/public/Product";
import { Solutions } from "../pages/public/Solutions";
import { Developers } from "../pages/public/Developers";
import { Pricing } from "../pages/public/Pricing";
import { Security } from "../pages/public/Security";
import { Trust } from "../pages/public/Trust";
import { Company } from "../pages/public/Company";
import { Docs } from "../pages/public/Docs";
import { Changelog } from "../pages/public/Changelog";
import { Status } from "../pages/public/Status";
import { FAQ } from "../pages/public/FAQ";
import { Support } from "../pages/public/Support";
import { Contact } from "../pages/public/Contact";
import { Legal } from "../pages/public/Legal";
import { NotFound } from "../pages/public/NotFound";
import { PublicDetail } from "../pages/public/PublicDetail";
import { SupportRequest } from "../pages/public/SupportRequest";

import Login from "../pages/auth/Login";
import Signup from "../pages/auth/Signup";
import Recovery from "../pages/auth/Recovery";

import { Overview } from "../pages/console/Overview";
import {
  Audit,
  Billing,
  Deployments,
  Developer,
  Nodes,
  Policies,
  Security as ConsoleSecurity,
  Settings,
  Support as ConsoleSupport,
  Team,
  Tenants,
  Verification,
} from "../pages/console/ConsoleSurfaces";
import { NestedResource } from "../pages/console/NestedResource";

const detailRoutes = [
  "/product/model", "/product/enforcement", "/product/verification", "/product/evidence",
  "/solutions/b2b-saas", "/solutions/enterprise-saas", "/solutions/developer-platforms",
  "/solutions/security-sensitive", "/solutions/startups", "/solutions/platform-engineering",
  "/developers/quickstart", "/developers/authentication", "/developers/organizations", "/developers/tenant-context",
  "/developers/policies", "/developers/fleet", "/developers/deployments", "/developers/verification", "/developers/audit",
  "/developers/webhooks", "/developers/events", "/developers/sdks", "/developers/cli",
  "/developers/terraform", "/developers/api-reference",
  "/docs/getting-started", "/docs/core-concepts", "/docs/api-reference", "/docs/security",
  "/docs/operations", "/docs/troubleshooting", "/docs/verification",
  "/changelog/frontend-reconstruction", "/changelog/control-plane-foundation",
];

const consoleResourceRoutes = [
  { path: "tenants", element: <Tenants /> },
  { path: "policies", element: <Policies /> },
  { path: "nodes", element: <Nodes /> },
  { path: "deployments", element: <Deployments /> },
  { path: "verification", element: <Verification /> },
  { path: "audit", element: <Audit /> },
  { path: "security", element: <ConsoleSecurity /> },
  { path: "team", element: <Team /> },
  { path: "billing", element: <Billing /> },
  { path: "settings", element: <Settings /> },
  { path: "developer", element: <Developer /> },
  { path: "support", element: <ConsoleSupport /> },
];

const nestedConsoleRoutes = [
  "tenants/:tenantId",
  "policies/:policyId",
  "nodes/:nodeId",
  "deployments/:deploymentId",
  "audit/:eventId",
  "security/tenant-isolation",
  "security/events",
  "billing/usage",
  "billing/plans",
  "billing/invoices",
  "developer/api-keys",
  "developer/tenant-context",
  "developer/webhooks",
  "developer/api-reference",
  "settings/authentication",
  "settings/identity",
  "settings/security",
].map((path) => ({
  path,
  element: <NestedResource />,
}));

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/product", element: <Product /> },
      { path: "/solutions", element: <Solutions /> },
      { path: "/developers", element: <Developers /> },
      { path: "/pricing", element: <Pricing /> },
      { path: "/security", element: <Security /> },
      { path: "/trust", element: <Trust /> },
      { path: "/company", element: <Company /> },
      { path: "/docs", element: <Docs /> },
      { path: "/changelog", element: <Changelog /> },
      { path: "/status", element: <Status /> },
      { path: "/faq", element: <FAQ /> },
      { path: "/support", element: <Support /> },
      { path: "/contact", element: <Contact /> },
      { path: "/support/request", element: <SupportRequest /> },
      { path: "/terms", element: <Legal /> },
      { path: "/privacy", element: <Legal /> },
      ...detailRoutes.map((path) => ({ path, element: <PublicDetail /> })),
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      { path: "/login", element: <Login /> },
      { path: "/signup", element: <Signup /> },
      { path: "/recovery", element: <Recovery /> },
    ],
  },
  {
    path: "/app",
    element: <ConsoleLayout />,
    children: [
      { index: true, element: <Overview /> },
      ...consoleResourceRoutes,
      ...nestedConsoleRoutes,
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);
