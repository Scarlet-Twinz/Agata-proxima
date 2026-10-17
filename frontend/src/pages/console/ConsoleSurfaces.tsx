import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, RefreshCw, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { ResourceSurface } from "../../components/console/ResourceSurface";

type SecurityOverview = {
  metrics?: { tenants?: number; policies?: number; nodes?: number; active_deployments?: number };
  protection?: { tenantIsolation?: string; policyEnforcement?: string; verification?: string; databaseProtection?: string };
};

export function Security() {
  const [data, setData] = useState<SecurityOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api.get<SecurityOverview>("/api/v1/control-plane/overview"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load security posture.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const protection = data?.protection;
  const signals = [
    { label: "Tenant boundary", value: protection?.tenantIsolation ?? "NO DATA", detail: "Tenant inventory is configuration state; runtime behavior is shown by verification evidence." },
    { label: "Policy inventory", value: protection?.policyEnforcement ?? "NO DATA", detail: "Versioned policy records available for deployment and verification." },
    { label: "Latest verification", value: protection?.verification ?? "NO DATA", detail: "Most recent recorded verification result for the active organization." },
    { label: "Control-plane database", value: protection?.databaseProtection ?? "NO DATA", detail: "Live database connectivity signal from the authenticated overview endpoint." },
  ];

  return <div className="resource-page">
    <div className="page-heading">
      <div><span className="eyebrow">SECURITY</span><h1>Security posture</h1><p>Review live configuration signals, verification evidence and organization-scoped security activity.</p></div>
      <button className="console-refresh-button" type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={15} className={loading ? "is-spinning" : ""}/>{loading ? "Refreshing" : "Refresh"}</button>
    </div>
    {error && <div className="surface empty-state resource-error" role="alert"><strong>Security posture unavailable</strong><span>{error}</span></div>}
    {loading && <div className="surface empty-state"><strong>Loading security signals…</strong><span>Reading the authenticated control-plane overview.</span></div>}
    {!loading && !error && <section className="surface">
      <div className="surface-heading"><div><span className="eyebrow">LIVE SECURITY SIGNALS</span><h2>Current organization state</h2></div><ShieldCheck size={20}/></div>
      <div className="protection-strip">
        {signals.map(signal => <div className="protection-state" key={signal.label}><span>{signal.label}</span><strong>{signal.value}</strong><small>{signal.detail}</small></div>)}
      </div>
      <div className="overview-metrics" aria-label="Security-related resource counts">
        {[["Tenants", data?.metrics?.tenants, "/app/tenants"], ["Policies", data?.metrics?.policies, "/app/policies"], ["Nodes", data?.metrics?.nodes, "/app/nodes"], ["Deployments needing attention", data?.metrics?.active_deployments, "/app/deployments"]].map(([label, value, href]) => <Link className="overview-metric" to={String(href)} key={String(label)}><span className="overview-metric-copy"><span className="overview-metric-label">{String(label)}</span><strong>{value === undefined ? "—" : String(value)}</strong></span><ArrowUpRight size={15}/></Link>)}
      </div>
    </section>}
    <div className="resource-section-grid">
      <Link className="surface resource-info-card resource-info-card--link" to="/app/security/tenant-isolation"><span className="eyebrow">REVIEW</span><h2>Tenant isolation <ArrowUpRight size={15}/></h2><p>Inspect verification runs and review expected-allow and expected-block evidence.</p></Link>
      <Link className="surface resource-info-card resource-info-card--link" to="/app/security/events"><span className="eyebrow">INVESTIGATE</span><h2>Security events <ArrowUpRight size={15}/></h2><p>Open organization-scoped audit and security activity with individual event details.</p></Link>
      <Link className="surface resource-info-card resource-info-card--link" to="/app/verification"><span className="eyebrow">VERIFY</span><h2>Verification evidence <ArrowUpRight size={15}/></h2><p>Run and inspect tenant-local checks and prohibited cross-tenant access attempts.</p></Link>
    </div>
    <aside className="surface resource-links"><span className="eyebrow">RELATED</span><Link to="/app/audit">Audit explorer</Link><Link to="/docs/security">Security documentation</Link><Link to="/docs/troubleshooting">Troubleshooting</Link></aside>
  </div>;
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
    {title:"Environments",text:"Review environment labels across registered nodes and deployment targets.",href:"/app/settings/environments"},
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
