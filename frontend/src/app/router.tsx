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
  Support as ConsoleSupport,
  Tenants,
  Verification,
} from "../pages/console/ConsoleSurfaces";
import { NestedResource } from "../pages/console/NestedResource";
import { ActionPage } from "../pages/console/ActionPage";
import { SettingsHub } from "../pages/console/SettingsHub";
import { Notifications } from "../pages/console/Notifications";
import { TeamManagement } from "../pages/console/TeamManagement";
import { TeamInvitations, TeamRoles } from "../pages/console/TeamAccessDetails";
import { Integrations, Environments, DatabaseConnections } from "../pages/console/IntegrationFoundation";

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
  { path: "team", element: <TeamManagement /> },
  { path: "integrations", element: <Integrations /> },
  { path: "environments", element: <Environments /> },
  { path: "database", element: <DatabaseConnections /> },
  { path: "notifications", element: <Notifications /> },
  { path: "billing", element: <Billing /> },
  { path: "settings", element: <SettingsHub /> },
  { path: "developer", element: <Developer /> },
  { path: "support", element: <ConsoleSupport /> },
];

const nestedConsoleRoutes = [
  "tenants/:tenantId",
  "policies/:policyId",
  "nodes/:nodeId",
  "deployments/:deploymentId",
  "audit/:eventId",
  "verification/:runId",
  "team/members/:memberId",
  "support/:supportId",
  "security/tenant-isolation",
  "security/events",
  "billing/usage",
  "billing/plans",
  "billing/invoices",
  "developer/api-keys",
  "developer/service-accounts",
  "developer/authentication",
  "developer/api-keys/:apiKeyId",
  "developer/tenant-context",
  "developer/events",
  "developer/environments",
  "developer/webhooks",
  "developer/webhooks/:webhookId",
  "developer/api-reference",
  "developer/sdks",
  "developer/cli",
  "developer/terraform",
  "settings/authentication",
  "settings/identity",
  "settings/security",
  "settings/environments",
  "settings/notifications",
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
      { path: "team/invitations", element: <TeamInvitations /> },
      { path: "team/roles", element: <TeamRoles /> },
      ...nestedConsoleRoutes,
      { path: "tenants/new", element: <ActionPage /> },
      { path: "policies/new", element: <ActionPage /> },
      { path: "nodes/new", element: <ActionPage /> },
      { path: "deployments/new", element: <ActionPage /> },
      { path: "verification/new", element: <ActionPage /> },
      { path: "support/new", element: <ActionPage /> },
      { path: "developer/api-keys/new", element: <ActionPage /> },
      { path: "developer/webhooks/new", element: <ActionPage /> },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);
