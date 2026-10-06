import { createBrowserRouter, Navigate } from "react-router-dom";
import PublicLayout from "../layouts/PublicLayout";
import AuthLayout from "../layouts/auth/AuthLayout";
import ConsoleLayout from "../layouts/ConsoleLayout";

import {
  Home,
  Product,
  ProductDetail,
  Solutions,
  SolutionDetail,
  Pricing,
  Security,
  Developers,
  DeveloperDetail,
  Docs,
  DocsDetail,
  Changelog,
  ChangelogDetail,
  Company,
  Trust,
  Status,
  Contact,
  Support,
  SupportArticle,
  FAQ,
  Terms,
  Privacy,
} from "../pages/public/PublicPages";

import Login from "../pages/auth/Login";
import Signup from "../pages/auth/Signup";
import Recovery from "../pages/auth/Recovery";

import { Overview } from "../pages/console/Overview";
import PlaceholderPage from "../pages/console/PlaceholderPage";

const consoleRoutes = [
  { path: "tenants", label: "Tenants" },
  { path: "policies", label: "Policies" },
  { path: "nodes", label: "Nodes" },
  { path: "deployments", label: "Deployments" },
  { path: "verification", label: "Verification" },
  { path: "audit", label: "Audit" },
  { path: "security", label: "Security" },
  { path: "team", label: "Team" },
  { path: "billing", label: "Billing" },
  { path: "settings", label: "Settings" },
  { path: "developer", label: "Developer" },
  { path: "support", label: "Support" },
];

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: "/", element: <Home /> },

      { path: "/product", element: <Product /> },
      { path: "/product/operating-model", element: <ProductDetail kind="operating" /> },
      { path: "/product/enforcement", element: <ProductDetail kind="enforcement" /> },
      { path: "/product/verification", element: <ProductDetail kind="verification" /> },
      { path: "/product/evidence", element: <ProductDetail kind="evidence" /> },

      { path: "/solutions", element: <Solutions /> },
      { path: "/solutions/b2b-saas", element: <SolutionDetail kind="b2b-saas" /> },
      { path: "/solutions/enterprise-saas", element: <SolutionDetail kind="enterprise-saas" /> },
      { path: "/solutions/developer-platforms", element: <SolutionDetail kind="developer-platforms" /> },
      { path: "/solutions/security-sensitive-systems", element: <SolutionDetail kind="security-sensitive-systems" /> },
      { path: "/solutions/startups", element: <SolutionDetail kind="startups" /> },
      { path: "/solutions/platform-engineering", element: <SolutionDetail kind="platform-engineering" /> },

      { path: "/pricing", element: <Pricing /> },
      { path: "/security", element: <Security /> },

      { path: "/developers", element: <Developers /> },
      { path: "/developers/quickstart", element: <DeveloperDetail kind="quickstart" /> },
      { path: "/developers/authentication", element: <DeveloperDetail kind="authentication" /> },
      { path: "/developers/tenant-context", element: <DeveloperDetail kind="tenant-context" /> },
      { path: "/developers/verification", element: <DeveloperDetail kind="verification" /> },
      { path: "/developers/api-reference", element: <DeveloperDetail kind="api-reference" /> },
      { path: "/developers/webhooks", element: <DeveloperDetail kind="webhooks" /> },
      { path: "/developers/sdks", element: <DeveloperDetail kind="sdks" /> },
      { path: "/developers/cli", element: <DeveloperDetail kind="cli" /> },
      { path: "/developers/terraform", element: <DeveloperDetail kind="terraform" /> },

      { path: "/docs", element: <Docs /> },
      { path: "/docs/getting-started", element: <DocsDetail kind="getting-started" /> },
      { path: "/docs/core-concepts", element: <DocsDetail kind="core-concepts" /> },
      { path: "/docs/api-reference", element: <DocsDetail kind="api-reference" /> },
      { path: "/docs/security", element: <DocsDetail kind="security" /> },
      { path: "/docs/operations", element: <DocsDetail kind="operations" /> },
      { path: "/docs/troubleshooting", element: <DocsDetail kind="troubleshooting" /> },

      { path: "/changelog", element: <Changelog /> },
      { path: "/changelog/frontend-reconstruction", element: <ChangelogDetail kind="frontend-reconstruction" /> },
      { path: "/changelog/control-plane-foundation", element: <ChangelogDetail kind="control-plane-foundation" /> },
      { path: "/changelog/authentication-boundary", element: <ChangelogDetail kind="authentication-boundary" /> },
      { path: "/changelog/verification-model", element: <ChangelogDetail kind="verification-model" /> },
      { path: "/changelog/api-foundation", element: <ChangelogDetail kind="api-foundation" /> },

      { path: "/company", element: <Company /> },
      { path: "/trust", element: <Trust /> },
      { path: "/status", element: <Status /> },
      { path: "/contact", element: <Contact /> },

      { path: "/support", element: <Support /> },
      { path: "/support/:category/:article", element: <SupportArticle /> },

      { path: "/faq", element: <FAQ /> },
      { path: "/terms", element: <Terms /> },
      { path: "/privacy", element: <Privacy /> },
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
      ...consoleRoutes.map(({ path, label }) => ({
        path,
        element: <PlaceholderPage title={label} />,
      })),
    ],
  },

  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
