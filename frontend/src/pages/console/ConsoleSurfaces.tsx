import { Link } from "react-router-dom";
import { ResourceSurface } from "../../components/console/ResourceSurface";
import { ActivityStream } from "../../components/console/activity/ActivityStream";
import { InfrastructureTopology } from "../../components/console/topology/InfrastructureTopology";
import { useOverview } from "../../hooks/useOverview";
import { RefreshCw, ShieldCheck } from "lucide-react";

export function Security() {
  const { data, isLoading, isError, isFetching, dataUpdatedAt, refetch } = useOverview();
  const metrics = [
    { label: "Customer tenants", value: data?.metrics?.tenants, detail: "Tenant inventory in this organization" },
    { label: "Configured policies", value: data?.metrics?.policies, detail: "Policies recorded by the control plane" },
    { label: "Registered nodes", value: data?.metrics?.nodes, detail: "Node inventory, not a heartbeat guarantee" },
    { label: "Deployments needing attention", value: data?.metrics?.active_deployments, detail: "Non-healthy, non-rolled-back deployments" },
  ];
  const checks = [
    { label: "Tenant inventory", value: (data?.metrics?.tenants ?? 0) > 0 ? "CONFIGURED" : "NOT CONFIGURED", detail: "Inventory alone does not prove cross-tenant isolation." },
    { label: "Policy inventory", value: (data?.metrics?.policies ?? 0) > 0 ? "CONFIGURED" : "NOT CONFIGURED", detail: "Confirm policy assignment and deployment before relying on enforcement." },
    { label: "Latest recorded verification", value: data?.protection?.verification ?? "NO DATA", detail: "Shows the latest result returned by the control plane; it does not imply a new test was run now." },
    { label: "Overview endpoint", value: isError ? "UNAVAILABLE" : isLoading ? "CHECKING" : "RESPONDING", detail: "The authenticated overview endpoint returned successfully; this does not independently prove every control is enforced." },
  ];
  return <div className="command-center">
    <div className="page-heading">
      <div><span className="eyebrow">SECURITY</span><h1>Security posture</h1><p>Live organization-scoped inventory, verification evidence and operational activity.</p></div>
      <div className="heading-actions"><span className="live-overview-status">{isFetching ? "Refreshing live data" : dataUpdatedAt ? `Updated ${new Date(dataUpdatedAt).toLocaleTimeString()}` : "Waiting for data"}</span><button className="console-refresh-button" type="button" onClick={() => void refetch()} disabled={isFetching}><RefreshCw size={15} className={isFetching ? "is-spinning" : ""}/> Refresh</button></div>
    </div>
    {isError && <div className="system-notice system-notice--warning"><strong>Security telemetry unavailable.</strong><span>Confirm the authenticated session and control-plane health before relying on this view.</span></div>}
    <section className="overview-metrics" aria-label="Security inventory metrics">
      {metrics.map(({label,value,detail}) => <article className="overview-metric" key={label}><span className="overview-metric-icon"><ShieldCheck size={18}/></span><span className="overview-metric-copy"><span className="overview-metric-label">{label}</span><strong>{isLoading ? "—" : value ?? "—"}</strong><small>{detail}</small></span></article>)}
    </section>
    <section className="surface">
      <div className="surface-heading"><div><span className="eyebrow">CONTROL CHECKS</span><h2>Current configuration signals</h2></div></div>
      <div className="resource-section-grid">{checks.map(({label,value,detail}) => <article className="surface resource-info-card" key={label}><span className="eyebrow">{label}</span><h2>{isLoading ? "CHECKING" : value}</h2><p>{detail}</p></article>)}</div>
    </section>
    <section className="surface surface--wide">
      <div className="surface-heading"><div><span className="eyebrow">INFRASTRUCTURE</span><h2>Proxima topology</h2></div><Link className="table-detail-link" to="/app/nodes">Manage nodes</Link></div>
      <InfrastructureTopology nodes={data?.nodes ?? []}/>
    </section>
    <section className="surface">
      <div className="surface-heading"><div><span className="eyebrow">AUDIT</span><h2>Recent security activity</h2></div><Link className="table-detail-link" to="/app/audit">Open audit</Link></div>
      <ActivityStream items={data?.recentActivity ?? []}/>
    </section>
    <div className="resource-links surface"><span className="eyebrow">RELATED WORKFLOWS</span><Link to="/app/verification">Verification evidence</Link><Link to="/app/audit">Audit explorer</Link><Link to="/app/tenants">Tenant registry</Link><Link to="/app/policies">Policy control</Link><Link to="/docs/security">Security documentation</Link></div>
  </div>;
}

export function Access() {
  return <ResourceSurface endpoint="/api/v1/organization/team" detailBase="/app/team/members" eyebrow="ACCESS" title="Access and membership" description="Review live organization membership and role assignments. Use Team to invite members, revoke invitations and manage the access lifecycle." sections={[
    {title:"Member management",text:"Invite or remove members and review current roles in the Team workspace.",href:"/app/team"},
    {title:"Role responsibilities",text:"Use owner, admin, operator and viewer roles according to the least-privilege principle.",href:"/app/team/roles"},
    {title:"Authentication",text:"Review session behavior and enterprise identity configuration.",href:"/app/settings/authentication"},
  ]} links={[
    {label:"Team management",href:"/app/team"},{label:"Role guide",href:"/app/team/roles"},{label:"Audit access changes",href:"/app/audit"},
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
