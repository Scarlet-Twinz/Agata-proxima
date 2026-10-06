import { Route, Routes } from "react-router-dom";
import PublicLayout from "./layouts/PublicLayout";
import AuthLayout from "./layouts/auth/AuthLayout";
import { RequireAuth } from "./layouts/auth/RequireAuth";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import Recovery from "./pages/auth/Recovery";
import NotFound from "./pages/NotFound";
import {
  Home, Product, ProductDetail, Solutions, SolutionDetail, Pricing, Security,
  Docs, DocsDetail, Changelog, ChangelogDetail,
  Company, Trust, Status, FAQ, Terms, Privacy,
} from "./pages/public/PublicPages";
import DeveloperPortal from "./pages/public/DeveloperPortal";
import {
  Contact,
  Support,
  SupportArticle,
} from "./pages/public/PublicContactSupport";
import { ConsoleLayout } from "./layouts/console/ConsoleLayout";
import { Overview } from "./pages/console/Overview";
import {
  Audit,
  Billing,
  Deployments,
  Nodes,
  Policies,
  Security as ConsoleSecurity,
  Support as ConsoleSupport,
  Team,
  Tenants,
  Verification,
} from "./pages/console/ConsoleSurfaces";
import {
  AuditEvent,
  BillingInvoices,
  BillingPlans,
  BillingUsage,
  DeveloperArea,
  DeveloperApiKeys,
  DeveloperAuthentication,
  DeveloperApiReference,
  DeveloperCli,
  DeveloperEnvironments,
  DeveloperEvents,
  DeveloperServiceAccounts,
  DeveloperSdks,
  DeveloperTenantContext,
  DeveloperTerraform,
  DeveloperWebhooks,
  DeploymentDetail,
  NodeDetail,
  PolicyDetail,
  SecurityEvents,
  SecurityTenantIsolation,
  SettingsArea,
  SettingsAuthentication,
  SettingsDanger,
  SettingsEnvironments,
  SettingsIdentity,
  SettingsMembers,
  SettingsNotifications,
  SettingsSecurity,
  TeamInvitations,
  TeamMember,
  TeamRoles,
  TenantDetail,
  VerificationDetail,
} from "./pages/console/ConsoleDetailSurfaces";

export function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="product" element={<Product />} />
        <Route path="product/operating-model" element={<ProductDetail kind="operating" />} />
        <Route path="product/enforcement" element={<ProductDetail kind="enforcement" />} />
        <Route path="product/verification" element={<ProductDetail kind="verification" />} />
        <Route path="product/evidence" element={<ProductDetail kind="evidence" />} />
        <Route path="solutions" element={<Solutions />} />
        <Route path="solutions/b2b-saas" element={<SolutionDetail kind="b2b-saas" />} />
        <Route path="solutions/enterprise-saas" element={<SolutionDetail kind="enterprise-saas" />} />
        <Route path="solutions/developer-platforms" element={<SolutionDetail kind="developer-platforms" />} />
        <Route path="solutions/security-sensitive-systems" element={<SolutionDetail kind="security-sensitive-systems" />} />
        <Route path="solutions/startups" element={<SolutionDetail kind="startups" />} />
        <Route path="solutions/platform-engineering" element={<SolutionDetail kind="platform-engineering" />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="security" element={<Security />} />
        <Route path="developers" element={<DeveloperPortal />} />
        <Route path="developers/:kind" element={<DeveloperPortal />} />
        <Route path="docs" element={<Docs />} />
        <Route path="docs/getting-started" element={<DocsDetail kind="getting-started" />} />
        <Route path="docs/core-concepts" element={<DocsDetail kind="core-concepts" />} />
        <Route path="docs/api-reference" element={<DocsDetail kind="api-reference" />} />
        <Route path="docs/security" element={<DocsDetail kind="security" />} />
        <Route path="docs/operations" element={<DocsDetail kind="operations" />} />
        <Route path="docs/troubleshooting" element={<DocsDetail kind="troubleshooting" />} />
        <Route path="changelog" element={<Changelog />} />
        <Route path="changelog/frontend-reconstruction" element={<ChangelogDetail kind="frontend-reconstruction" />} />
        <Route path="changelog/control-plane-foundation" element={<ChangelogDetail kind="control-plane-foundation" />} />
        <Route path="changelog/authentication-boundary" element={<ChangelogDetail kind="authentication-boundary" />} />
        <Route path="changelog/verification-model" element={<ChangelogDetail kind="verification-model" />} />
        <Route path="changelog/api-foundation" element={<ChangelogDetail kind="api-foundation" />} />
        <Route path="company" element={<Company />} />
        <Route path="trust" element={<Trust />} />
        <Route path="status" element={<Status />} />
        <Route path="contact" element={<Contact />} />
        <Route path="support" element={<Support />} />
        <Route path="support/:category/:article" element={<SupportArticle />} />
        <Route path="faq" element={<FAQ />} />
        <Route path="terms" element={<Terms />} />
        <Route path="privacy" element={<Privacy />} />
      </Route>

      <Route element={<AuthLayout />}>
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />
        <Route path="recovery" element={<Recovery />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route path="app" element={<ConsoleLayout />}>
          <Route index element={<Overview />} />
          <Route path="security" element={<ConsoleSecurity />} />
          <Route path="security/tenant-isolation" element={<SecurityTenantIsolation />} />
          <Route path="security/events" element={<SecurityEvents />} />
          <Route path="security/events/:eventId" element={<AuditEvent />} />
          <Route path="tenants" element={<Tenants />} />
          <Route path="tenants/:tenantId" element={<TenantDetail />} />
          <Route path="policies" element={<Policies />} />
          <Route path="policies/:policyId" element={<PolicyDetail />} />
          <Route path="nodes" element={<Nodes />} />
          <Route path="nodes/:nodeId" element={<NodeDetail />} />
          <Route path="deployments" element={<Deployments />} />
          <Route path="deployments/:deploymentId" element={<DeploymentDetail />} />
          <Route path="verification" element={<Verification />} />
          <Route path="verification/:runId" element={<VerificationDetail />} />
          <Route path="audit" element={<Audit />} />
          <Route path="audit/:eventId" element={<AuditEvent />} />
          <Route path="team" element={<Team />} />
          <Route path="team/members/:memberId" element={<TeamMember />} />
          <Route path="team/invitations" element={<TeamInvitations />} />
          <Route path="team/roles" element={<TeamRoles />} />
          <Route path="billing" element={<Billing />} />
          <Route path="billing/usage" element={<BillingUsage />} />
          <Route path="billing/plans" element={<BillingPlans />} />
          <Route path="billing/invoices" element={<BillingInvoices />} />
          <Route path="developer" element={<DeveloperArea />} />
          <Route path="developer/api-keys" element={<DeveloperApiKeys />} />
          <Route path="developer/service-accounts" element={<DeveloperServiceAccounts />} />
          <Route path="developer/authentication" element={<DeveloperAuthentication />} />
          <Route path="developer/tenant-context" element={<DeveloperTenantContext />} />
          <Route path="developer/webhooks" element={<DeveloperWebhooks />} />
          <Route path="developer/events" element={<DeveloperEvents />} />
          <Route path="developer/environments" element={<DeveloperEnvironments />} />
          <Route path="developer/sdks" element={<DeveloperSdks />} />
          <Route path="developer/cli" element={<DeveloperCli />} />
          <Route path="developer/terraform" element={<DeveloperTerraform />} />
          <Route path="developer/api-reference" element={<DeveloperApiReference />} />
          <Route path="settings" element={<SettingsArea />} />
          <Route path="settings/members" element={<SettingsMembers />} />
          <Route path="settings/authentication" element={<SettingsAuthentication />} />
          <Route path="settings/identity" element={<SettingsIdentity />} />
          <Route path="settings/api" element={<SettingsArea />} />
          <Route path="settings/security" element={<SettingsSecurity />} />
          <Route path="settings/environments" element={<SettingsEnvironments />} />
          <Route path="settings/notifications" element={<SettingsNotifications />} />
          <Route path="settings/danger" element={<SettingsDanger />} />
          <Route path="support" element={<ConsoleSupport />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
