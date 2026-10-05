import { createBrowserRouter, Navigate } from "react-router-dom";
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

