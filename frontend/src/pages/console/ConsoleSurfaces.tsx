import { ResourceSurface } from "../../components/console/ResourceSurface";

export function Security() {
  return <ResourceSurface eyebrow="SECURITY" title="Security posture" description="A live security workspace for tenant isolation, verification evidence and security events." sections={[
    {title:"Tenant isolation",text:"Inspect enforcement mode, verification history and tenant-level isolation evidence.",href:"/app/security/tenant-isolation"},
    {title:"Security events",text:"Search organization-scoped events and open individual event records.",href:"/app/security/events"},
    {title:"Verification evidence",text:"Review the tests that establish expected allow and expected block behavior.",href:"/app/verification"},
  ]} links={[
    {label:"Verification",href:"/app/verification"},{label:"Audit",href:"/app/audit"},{label:"Security documentation",href:"/docs/security"},
  ]}/>;
}

export function Tenants() {
  return <ResourceSurface endpoint="/api/v1/tenants" detailBase="/app/tenants" createHref="/app/tenants/new" createLabel="Create tenant" eyebrow="TENANTS" title="Tenant registry" description="Manage customer boundaries, isolation modes and project placement." links={[
    {label:"Policies",href:"/app/policies"},{label:"Verification",href:"/app/verification"},{label:"Nodes",href:"/app/nodes"},
  ]}/>;
}

export function Policies() {
  return <ResourceSurface endpoint="/api/v1/policies" detailBase="/app/policies" createHref="/app/policies/new" createLabel="Create policy" eyebrow="POLICIES" title="Policy control" description="Author and inspect versioned enforcement intent before it moves into deployment." links={[
    {label:"Deployments",href:"/app/deployments"},{label:"Verification",href:"/app/verification"},{label:"Policy documentation",href:"/docs/core-concepts"},
  ]}/>;
}

export function Nodes() {
  return <ResourceSurface endpoint="/api/v1/nodes" detailBase="/app/nodes" createHref="/app/nodes/new" createLabel="Register node" eyebrow="INFRASTRUCTURE" title="Node inventory" description="Register and inspect Proxima enforcement infrastructure, environments and health." links={[
    {label:"Deployments",href:"/app/deployments"},{label:"Security posture",href:"/app/security"},{label:"Fleet documentation",href:"/developers/fleet"},
  ]}/>;
}

export function Deployments() {
  return <ResourceSurface endpoint="/api/v1/deployments" detailBase="/app/deployments" createHref="/app/deployments/new" createLabel="Create deployment" eyebrow="DEPLOYMENTS" title="Deployment control" description="Track desired state, observed state, node placement and deployment lifecycle." links={[
    {label:"Policies",href:"/app/policies"},{label:"Verification",href:"/app/verification"},{label:"Nodes",href:"/app/nodes"},
  ]}/>;
}

export function Verification() {
  return <ResourceSurface endpoint="/api/v1/verifications" detailBase="/app/verification" createHref="/app/verification/new" createLabel="Run verification" eyebrow="VERIFICATION" title="Verification evidence" description="Inspect and record tenant-isolation verification outcomes and evidence." links={[
    {label:"Security posture",href:"/app/security"},{label:"Audit",href:"/app/audit"},{label:"Verification documentation",href:"/docs/verification"},
  ]}/>;
}

export function Audit() {
  return <ResourceSurface endpoint="/api/v1/audit" detailBase="/app/audit" eyebrow="AUDIT" title="Audit explorer" description="Search organization-scoped administrative and security evidence with direct event detail." links={[
    {label:"Verification",href:"/app/verification"},{label:"Security",href:"/app/security"},{label:"Operations",href:"/docs/operations"},
  ]}/>;
}

export function Team() {
  return <ResourceSurface endpoint="/api/v1/organization/team" detailBase="/app/team/members" eyebrow="TEAM" title="Team and access" description="Inspect organization members and roles. Invitations and access policy live alongside the workspace identity model." sections={[
    {title:"Invitations",text:"Review pending organization invitations and their lifecycle.",href:"/app/team/invitations"},
    {title:"Roles",text:"Understand owner, admin, operator and viewer responsibilities.",href:"/app/team/roles"},
  ]} links={[
    {label:"Settings",href:"/app/settings"},{label:"Authentication",href:"/app/settings/authentication"},
  ]}/>;
}

export function Billing() {
  return <ResourceSurface endpoint="/api/v1/billing" eyebrow="BILLING" title="Billing command center" description="Understand the active commercial account, subscription state and entitlement controls." sections={[
    {title:"Usage",text:"See actual resource consumption against the current entitlement limits.",href:"/app/billing/usage"},
    {title:"Plans",text:"Compare the live plan catalog and the workspace's current entitlement.",href:"/app/billing/plans"},
    {title:"Invoices",text:"Inspect billing-account and invoice-facing records.",href:"/app/billing/invoices"},
  ]} links={[
    {label:"Plans",href:"/app/billing/plans"},{label:"Usage",href:"/app/billing/usage"},{label:"Invoices",href:"/app/billing/invoices"},
  ]}/>;
}

export function Developer() {
  return <ResourceSurface eyebrow="DEVELOPER" title="Developer platform" description="Credentials, tenant context, webhooks, SDK guidance, CLI workflows and the authenticated API contract." sections={[
    {title:"API keys",text:"Create, revoke and inspect machine credentials. Secrets are shown once.",href:"/app/developer/api-keys"},
    {title:"Tenant context",text:"Follow the identity → organization → tenant → enforcement contract.",href:"/app/developer/tenant-context"},
    {title:"Webhooks",text:"Create endpoints, select events, inspect signing configuration and delivery history.",href:"/app/developer/webhooks"},
    {title:"API reference",text:"Explore resource groups and request/response contracts.",href:"/app/developer/api-reference"},
    {title:"SDKs",text:"Language-level integration guidance with examples and links to the underlying API contract.",href:"/app/developer/sdks"},
    {title:"CLI",text:"Command-line workflows for authentication, inspection and verification.",href:"/app/developer/cli"},
    {title:"Terraform",text:"Infrastructure-as-code guidance for repeatable Proxima configuration.",href:"/app/developer/terraform"},
  ]} links={[
    {label:"API keys",href:"/app/developer/api-keys"},{label:"Webhooks",href:"/app/developer/webhooks"},{label:"API reference",href:"/app/developer/api-reference"},
  ]}/>;
}

export function Settings() {
  return <ResourceSurface eyebrow="SETTINGS" title="Workspace settings" description="A navigable configuration area for identity, authentication, security, environments, notifications and workspace controls." sections={[
    {title:"Authentication",text:"Email verification, password and active session behavior.",href:"/app/settings/authentication"},
    {title:"Enterprise identity",text:"Microsoft Entra/OIDC connection state, configuration and readiness.",href:"/app/settings/identity"},
    {title:"Security",text:"Security controls and workspace protection preferences.",href:"/app/settings/security"},
    {title:"Environments",text:"Understand production and future environment boundaries.",href:"/app/settings/environments"},
    {title:"Notifications",text:"Operational and security notification preferences.",href:"/app/settings/notifications"},
  ]} links={[
    {label:"Authentication",href:"/app/settings/authentication"},{label:"Enterprise identity",href:"/app/settings/identity"},{label:"Security",href:"/app/settings/security"},
  ]}/>;
}

export function Support() {
  return <ResourceSurface endpoint="/api/v1/support" detailBase="/app/support" createHref="/app/support/new" createLabel="Open support request" eyebrow="SUPPORT" title="Support workspace" description="Inspect support requests and move from a problem report to an actionable support workflow." links={[
    {label:"Documentation",href:"/docs"},{label:"Contact support",href:"/contact"},{label:"Security",href:"/app/security"},
  ]}/>;
}
