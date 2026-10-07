import { ResourceSurface } from "../../components/console/ResourceSurface";

export function Security() {
  return <ResourceSurface eyebrow="SECURITY" title="Security posture" description="Observe the controls protecting the Proxima isolation boundary." sections={[
    {title:"Tenant isolation",text:"Review the explicit tenant-isolation boundary and verification workflow.",href:"/app/security/tenant-isolation"},
    {title:"Security events",text:"Inspect security-oriented events recorded by the control plane.",href:"/app/security/events"},
  ]} links={[
    {label:"Tenant isolation",href:"/app/security/tenant-isolation"},
    {label:"Verification",href:"/app/verification"},
    {label:"Security events",href:"/app/security/events"},
  ]}/>;
}

export function Tenants() {
  return <ResourceSurface endpoint="/api/v1/tenants" eyebrow="TENANTS" title="Tenant registry" description="Manage and inspect protected tenant contexts." links={[
    {label:"Policies",href:"/app/policies"},{label:"Verification",href:"/app/verification"},{label:"Nodes",href:"/app/nodes"},
  ]}/>;
}

export function Policies() {
  return <ResourceSurface endpoint="/api/v1/policies" eyebrow="POLICIES" title="Policy control" description="Inspect enforcement policies, versions and deployment state." links={[
    {label:"Deployments",href:"/app/deployments"},{label:"Verification",href:"/app/verification"},
  ]}/>;
}

export function Nodes() {
  return <ResourceSurface endpoint="/api/v1/nodes" eyebrow="INFRASTRUCTURE" title="Node inventory" description="Inspect Proxima enforcement infrastructure and topology." links={[
    {label:"Deployments",href:"/app/deployments"},{label:"Security",href:"/app/security"},
  ]}/>;
}

export function Deployments() {
  return <ResourceSurface endpoint="/api/v1/deployments" eyebrow="DEPLOYMENTS" title="Deployment history" description="Track desired and observed deployment state." links={[
    {label:"Policies",href:"/app/policies"},{label:"Verification",href:"/app/verification"},{label:"Nodes",href:"/app/nodes"},
  ]}/>;
}

export function Verification() {
  return <ResourceSurface endpoint="/api/v1/verifications" eyebrow="VERIFICATION" title="Verification evidence" description="Inspect recorded tenant-isolation verification results." links={[
    {label:"Security",href:"/app/security"},{label:"Audit",href:"/app/audit"},
  ]}/>;
}

export function Audit() {
  return <ResourceSurface endpoint="/api/v1/audit" eyebrow="AUDIT" title="Audit stream" description="Search organization-scoped control-plane and security evidence." links={[
    {label:"Verification",href:"/app/verification"},{label:"Security",href:"/app/security"},
  ]}/>;
}

export function Team() {
  return <ResourceSurface endpoint="/api/v1/organization/team" eyebrow="TEAM" title="Team and access" description="Inspect organization members, roles and access state." links={[
    {label:"Settings",href:"/app/settings"},{label:"Authentication",href:"/app/settings/authentication"},
  ]}/>;
}

export function Billing() {
  return <ResourceSurface endpoint="/api/v1/billing" eyebrow="BILLING" title="Billing" description="Inspect subscription, plan and billing-account state." links={[
    {label:"Usage",href:"/app/billing/usage"},{label:"Plans",href:"/app/billing/plans"},{label:"Invoices",href:"/app/billing/invoices"},
  ]}/>;
}

export function Developer() {
  return <ResourceSurface eyebrow="DEVELOPER" title="Developer platform" description="Build integrations against the Proxima control plane." sections={[
    {title:"API keys",text:"Review integration credential policy and the security boundary around machine access.",href:"/app/developer/api-keys"},
    {title:"Tenant context",text:"Understand how authenticated identity and tenant context meet at the protected request boundary.",href:"/app/developer/tenant-context"},
    {title:"Webhooks",text:"Review event delivery, idempotency and safe retry behavior.",href:"/app/developer/webhooks"},
    {title:"API reference",text:"Explore the authenticated control-plane contract.",href:"/app/developer/api-reference"},
  ]} links={[
    {label:"API keys",href:"/app/developer/api-keys"},{label:"Tenant context",href:"/app/developer/tenant-context"},{label:"Webhooks",href:"/app/developer/webhooks"},{label:"API reference",href:"/app/developer/api-reference"},
  ]}/>;
}

export function Settings() {
  return <ResourceSurface eyebrow="SETTINGS" title="Workspace settings" description="Configure workspace identity, authentication, security and environments." sections={[
    {title:"Authentication",text:"Review email verification, password authentication and session protection.",href:"/app/settings/authentication"},
    {title:"Enterprise identity",text:"Review enterprise identity and OIDC configuration.",href:"/app/settings/identity"},
    {title:"Security",text:"Review workspace security controls and session behavior.",href:"/app/settings/security"},
  ]} links={[
    {label:"Authentication",href:"/app/settings/authentication"},{label:"Enterprise identity",href:"/app/settings/identity"},{label:"Security",href:"/app/settings/security"},
  ]}/>;
}

export function Support() {
  return <ResourceSurface endpoint="/api/v1/support" eyebrow="SUPPORT" title="Support" description="Inspect support requests associated with this workspace." links={[
    {label:"Documentation",href:"/docs"},{label:"Contact support",href:"/contact"},{label:"Security",href:"/app/security"},
  ]}/>;
}
