import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowUpRight, CheckCircle2, ChevronRight, ExternalLink, KeyRound, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { ResourceSurface } from "../../components/console/ResourceSurface";
import { api, type ApiError } from "../../api/client";



type Config = {
  eyebrow: string;
  title: string;
  description: string;
  tabs: { label: string; href: string }[];
  endpoint?: string;
  detailBase?: string;
  createHref?: string;
  createLabel?: string;
  sections?: { title: string; text: string; href?: string }[];
};

const developerTabs = [
  {label:"API keys",href:"/app/developer/api-keys"},
  {label:"Service accounts",href:"/app/developer/service-accounts"},
  {label:"Authentication",href:"/app/developer/authentication"},
  {label:"Tenant context",href:"/app/developer/tenant-context"},
  {label:"Webhooks",href:"/app/developer/webhooks"},
  {label:"Events",href:"/app/developer/events"},
  {label:"Environments",href:"/app/developer/environments"},
  {label:"SDKs",href:"/app/developer/sdks"},
  {label:"CLI",href:"/app/developer/cli"},
  {label:"Terraform",href:"/app/developer/terraform"},
  {label:"API reference",href:"/app/developer/api-reference"},
];

const developerDocs: Record<string,{title:string;intro:string;sections:{title:string;body:string;code?:string}[]}> = {
  "/app/developer/tenant-context": {
    title:"Tenant context",
    intro:"Tenant identity is not ordinary metadata. It is part of the protected request path and must remain bound to the organization and enforcement boundary.",
    sections:[
      {title:"The contract",body:"Authenticate the caller, resolve the organization boundary, resolve the tenant boundary, then let the enforcement layer decide whether protected database access is permitted."},
      {title:"Recommended request flow",body:"Keep the application-side tenant selection explicit and auditable. Do not infer a tenant from arbitrary user-controlled data after the request has entered the protected database path.",code:"identity → organization → tenant → policy → Proxima → PostgreSQL"},
      {title:"Verify it",body:"Use the Verification area to exercise both expected-allow and expected-block paths and inspect the resulting evidence."},
    ],
  },
  "/app/developer/service-accounts": {
    title:"Service accounts",
    intro:"Manage non-human access for automation and integrations with organization-scoped machine credentials.",
    sections:[
      {title:"Machine credential management",body:"Create and revoke organization-scoped API keys in Developer → API keys. Each key has a visible prefix, creation time, last-use timestamp and revocation state; the full secret is shown once when the key is created."},
      {title:"Credential lifecycle",body:"Create a separate key for each integration, grant only the required permissions, store the secret in a server-side secret manager, rotate it on a defined schedule and revoke it immediately when it is no longer trusted."},
    ],
  },
  "/app/developer/authentication": {
    title:"Developer authentication",
    intro:"Understand the browser session, CSRF contract and machine credential boundary before integrating automation.",
    sections:[
      {title:"Browser sessions",body:"Human operators authenticate through the control plane and receive a secure session cookie plus a CSRF token for state-changing operations."},
      {title:"API keys",body:"API keys are organization-scoped machine credentials. The full secret is returned only at creation time."},
      {title:"Enterprise identity",body:"Microsoft Entra/OIDC is a separate enterprise identity path and remains deployment-gated until a real provider configuration is supplied."},
    ],
  },
  "/app/developer/events": {
    title:"Events",
    intro:"Treat security, verification and operational events as durable signals rather than UI notifications.",
    sections:[
      {title:"Event families",body:"Verification outcomes, deployment changes, tenant changes, credential lifecycle and security activity should be represented as explicit event types."},
      {title:"Delivery",body:"Use webhooks for external delivery and the Audit surface for organization-scoped history inside the control plane."},
    ],
  },
  "/app/developer/environments": {
    title:"Environments",
    intro:"Use explicit environment labels to keep node registration and deployment targets aligned.",
    sections:[
      {title:"Production",body:"Production is the default environment for new node registrations. Confirm the environment label before enrolling a node or creating a deployment."},
      {title:"Deployment relationship",body:"Nodes and deployments carry environment information. Review the target node, environment and desired state together before initiating a rollout."},
    ],
  },
  "/app/developer/sdks": {
    title:"SDKs",
    intro:"Build typed clients around the versioned Agata Proxima HTTP API without weakening organization and tenant authorization.",
    sections:[
      {title:"Available client example",body:"Use the Node.js client example in the integration starter kit as a working reference for authenticated requests, response handling and organization-scoped resources. The same HTTP contract can be consumed from TypeScript, Python, PowerShell or other server-side runtimes."},
      {title:"API contract",body:"Use the generated OpenAPI document as the source of truth for request fields, response shapes and status codes. Keep credentials server-side, preserve organization scope, handle authorization failures explicitly and never log bearer tokens."},
    ],
  },
  "/app/developer/cli": {
    title:"CLI workflows",
    intro:"Run repeatable Agata operations from PowerShell or Bash using the documented HTTP API and the included starter-kit scripts.",
    sections:[
      {title:"Core workflow",body:"Load a scoped API credential from a secret store, select the intended API origin, inspect resources, perform an explicitly authorized change, then review verification and audit evidence."},
      {title:"Available commands",body:"The integration starter kit includes runnable PowerShell and Bash smoke scripts. Use the HTTP API examples for custom automation and check each response before continuing.",code:"./cli/agata.sh\n./cli/agata.ps1\ncurl --fail --silent --show-error \"$AGATA_API_BASE_URL/api/v1/health\""},
    ],
  },
  "/app/developer/terraform": {
    title:"Terraform",
    intro:"Infrastructure-as-code should make Proxima configuration reviewable, repeatable and auditable.",
    sections:[
      {title:"Provider direction",body:"The future provider should map explicit Proxima resources rather than becoming a generic database configuration wrapper."},
      {title:"Resource candidates",body:"These are the initial resource candidates for the provider.",code:"agata_tenant\nagata_policy\nagata_node\nagata_deployment\nagata_webhook"},
    ],
  },
  "/app/developer/api-reference": {
    title:"API reference",
    intro:"The authenticated control-plane contract is the machine-readable interface behind the dashboard.",
    sections:[
      {title:"Core resources",body:"Organizations, tenants, policies, nodes, deployments, verification, audit, support, billing and developer credentials/events are the core resource groups."},
      {title:"OpenAPI",body:"Use the generated OpenAPI document as the detailed schema reference.",code:"GET /docs/openapi.json"},
    ],
  },
  "/app/settings/authentication": {
    title:"Authentication",
    intro:"Manage and understand the identity lifecycle that gates access to the workspace.",
    sections:[
      {title:"Email verification",body:"A new account must verify its email before a session can be created. Verification is a one-time account activation step, not a code required at every login."},
      {title:"Sessions",body:"Sessions are server-side records bound to the authenticated organization and protected by a CSRF token for writes."},
      {title:"Password recovery",body:"Password reset is a separate email-driven lifecycle and does not weaken the verification boundary."},
    ],
  },
  "/app/settings/identity": {
    title:"Enterprise identity",
    intro:"Configure Microsoft Entra/OIDC when the production identity-provider contract is ready.",
    sections:[
      {title:"Connection state",body:"The backend has issuer, client and organization mapping support. A real public callback, provider registration and production credentials are still required before this can be marked live."},
      {title:"JIT provisioning",body:"Just-in-time provisioning can map an accepted enterprise identity into the organization boundary according to the configured policy."},
    ],
  },
  "/app/settings/security": {
    title:"Security settings",
    intro:"Security controls should explain their operational effect instead of hiding behind generic configuration language.",
    sections:[
      {title:"Engine authority",body:"The Proxima Engine remains the runtime enforcement authority. The control plane manages intent, evidence and operations without becoming a data-plane bypass."},
      {title:"Session protection",body:"State-changing browser requests require the session's CSRF token and role-aware write authorization."},
    ],
  },
  "/app/settings/environments": {
    title:"Environments",
    intro:"Keep environment state explicit as production operations expand.",
    sections:[{title:"Current environment",body:"Production is the active local control-plane environment. Environment-aware node and deployment records are already part of the backend contract."}],
  },
  "/app/settings/notifications": {
    title:"Notifications",
    intro:"Notification preferences belong in one place so operational and security signals do not become scattered across resource pages.",
    sections:[{title:"Current delivery boundary",body:"Transactional verification, reset and invitation emails are delivered through the configured Resend integration. Operational notification preferences can be expanded here without changing the security boundary."}],
  },
};

function ContextShell({config,children}:{config:Config;children:ReactNode}) {
  const {pathname}=useLocation();
  const [open,setOpen]=useState(true);
  return <div className="context-page">
    <div className="context-toolbar"><Link className="back-link" to="/app"><ArrowLeft size={16}/> Command Center</Link><button className="context-toggle" onClick={()=>setOpen(v=>!v)}>{open?"Collapse navigation":"Open navigation"}</button></div>
    <div className={`context-layout ${open?"":"context-layout--collapsed"}`}>
      {open && <aside className="context-sidebar"><div className="context-sidebar-title">{config.eyebrow}</div>{config.tabs.map(tab=><Link key={tab.href} to={tab.href} className={pathname===tab.href?"is-active":""}>{tab.label}<ChevronRight size={14}/></Link>)}</aside>}
      <main className="context-main">{children}</main>
    </div>
  </div>;
}

function DeveloperDoc({config,doc}:{config:Config;doc:{title:string;intro:string;sections:{title:string;body:string;code?:string}[]}}){
  return <ContextShell config={config}><div className="page-heading"><div><span className="eyebrow">{config.eyebrow}</span><h1>{doc.title}</h1><p>{doc.intro}</p></div></div>{doc.sections.map(section=><section className="surface context-doc-section" key={section.title}><h2>{section.title}</h2><p>{section.body}</p>{section.code&&<pre className="context-code">{section.code}</pre>}</section>)}<div className="context-next"><Link to="/app/developer/api-reference">Open API reference <ArrowUpRight size={15}/></Link><Link to="/docs">Open public documentation <ExternalLink size={15}/></Link></div></ContextShell>;
}

const identitySettingsConfig: Config = {
  eyebrow: "SETTINGS",
  title: "Enterprise identity",
  description: "Configure the expected Microsoft Entra tenant for this organization.",
  tabs: [
    {label:"Authentication",href:"/app/settings/authentication"},
    {label:"Enterprise identity",href:"/app/settings/identity"},
    {label:"Security",href:"/app/settings/security"},
    {label:"Environments",href:"/app/settings/environments"},
    {label:"Notifications",href:"/app/settings/notifications"},
  ],
};

function EntraIdentitySettings() {
  const [tenantId,setTenantId] = useState("");
  const [organizationSlug,setOrganizationSlug] = useState("");
  const [jitProvisioning,setJitProvisioning] = useState(false);
  const [configured,setConfigured] = useState(false);
  const [canManage,setCanManage] = useState(false);
  const [available,setAvailable] = useState(true);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [linking,setLinking] = useState(false);
  const [error,setError] = useState("");
  const [message,setMessage] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const settings = await api.get<{organization:{slug:string;role:string}}>("/api/v1/settings");
        if (!active) return;
        setOrganizationSlug(settings.organization.slug);
        const manager = ["owner","admin"].includes(settings.organization.role);
        setCanManage(manager);
        const connection = await api.get<{configured:boolean;tenant_id?:string|null;jit_provisioning?:boolean}>("/api/v1/organization/oidc/entra");
        if (!active) return;
        setConfigured(connection.configured);
        setTenantId(connection.tenant_id ?? "");
        setJitProvisioning(Boolean(connection.jit_provisioning));
        setAvailable(true);
      } catch (err) {
        if (active) {
          setAvailable(false);
          setError(err instanceof Error ? err.message : "Unable to load Microsoft Entra configuration.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  async function linkMicrosoftIdentity() {
    setError("");
    setMessage("");
    setLinking(true);
    try {
      const result = await api.post<{ok:boolean;authorization_url:string}>("/api/v1/auth/oidc/link/start", {});
      if (!result.authorization_url.startsWith("https://login.microsoftonline.com/")) {
        throw new Error("The server returned an unexpected Microsoft authorization URL.");
      }
      window.location.assign(result.authorization_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start Microsoft identity linking.");
      setLinking(false);
    }
  }

  async function saveConnection(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    const value = tenantId.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      setError("Enter a valid Microsoft Entra tenant ID in UUID format.");
      return;
    }
    setSaving(true);
    try {
      const result = await api.post<{ok:boolean;tenant_id:string}>("/api/v1/organization/oidc/entra", {
        tenant_id: value,
        jit_provisioning: jitProvisioning,
      });
      setConfigured(Boolean(result.ok));
      setTenantId(result.tenant_id || value);
      setMessage("Microsoft Entra tenant mapping saved. Complete a real sign-in test before treating SSO as production-ready.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save Microsoft Entra configuration.");
    } finally {
      setSaving(false);
    }
  }

  return <ContextShell config={identitySettingsConfig}>
    <div className="page-heading">
      <div><span className="eyebrow">SETTINGS · IDENTITY</span><h1>Microsoft Entra SSO</h1><p>Bind this organization to its expected Microsoft Entra tenant. The client secret is configured in the deployment secret store, never here.</p></div>
    </div>
    {message && <div className="settings-banner settings-banner--success"><CheckCircle2 size={16}/>{message}</div>}
    {error && <div className="settings-banner settings-banner--error">{error}</div>}
    {loading ? <div className="surface empty-state"><strong>Loading identity configuration…</strong><span>Checking your organization role and SSO settings.</span></div> :
      !available ? <div className="surface empty-state"><ShieldCheck size={24}/><strong>SSO configuration unavailable</strong><span>Microsoft Entra SSO requires the Growth plan or higher and the Control Plane must be configured with the app registration's client ID.</span></div> :
      <>
        <section className="settings-section">
          <div className="settings-section-heading"><div><h2>Connection status</h2><p>Configuration state is not the same as successful end-to-end sign-in.</p></div><ShieldCheck size={19}/></div>
          <div className="settings-readonly"><strong>{configured ? "Tenant mapping configured" : "Not configured yet"}</strong><small>Organization slug: {organizationSlug || "unavailable"}</small></div>
        </section>
        {canManage && (
        <section className="settings-section">
          <div className="settings-section-heading"><div><h2>Expected Entra tenant</h2><p>Use the Microsoft Entra Directory (tenant) ID for the customer organization, not the Agata application (client) ID.</p></div><ShieldCheck size={19}/></div>
          <form className="agata-form" onSubmit={saveConnection}>
            <label className="settings-field"><span>Directory (tenant) ID</span><input value={tenantId} onChange={e=>setTenantId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autoComplete="off" required disabled={!canManage}/></label>
            <label className="settings-toggle"><span><strong>Just-in-time provisioning</strong><small>Allow eligible Entra users to be provisioned into this organization according to the server's configured role policy.</small></span><input type="checkbox" checked={jitProvisioning} onChange={e=>setJitProvisioning(e.target.checked)} disabled={!canManage}/></label>
            <button className="primary-action" type="submit" disabled={saving || !canManage || !tenantId.trim()}><Save size={15}/>{saving ? "Saving…" : "Save Entra configuration"}</button>
          </form>
        </section>
        )}
        <section className="settings-section">
          <div className="settings-section-heading"><div><h2>Link your existing account</h2><p>Sign in with Microsoft using the same email as your current Agata account. This explicitly links the identity; it never transfers an identity already linked elsewhere.</p></div><ShieldCheck size={19}/></div>
          <button className="secondary-action" type="button" onClick={linkMicrosoftIdentity} disabled={linking || !configured}>{linking ? "Opening Microsoft…" : "Link Microsoft Entra identity"}</button>
        </section>
        {canManage && (
        <section className="settings-section">
          <div className="settings-section-heading"><div><h2>Required before live SSO</h2><p>This page stores the organization mapping only.</p></div></div>
          <ol>
            <li>Create a multitenant Web app registration in Microsoft Entra ID.</li>
            <li>Set <code>PROXIMA_OIDC_CLIENT_ID</code> and <code>PROXIMA_OIDC_CLIENT_SECRET</code> in the deployment secret store.</li>
            <li>Set the browser-facing <code>AGATA_PUBLIC_BASE_URL</code> and route the callback under the same origin.</li>
            <li>Register <code>/api/v1/auth/oidc/callback</code> as the exact Web redirect URI.</li>
            <li>Test login, organization mapping, session creation and audit evidence against a real Entra tenant.</li>
          </ol>
          <p><a href="https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app?tabs=client-secret" target="_blank" rel="noreferrer">Microsoft's official app registration guide</a></p>
        </section>
        )}

      </>
    }
  </ContextShell>;
}

function DetailPage({config,id}:{config:Config;id:string}){
  const [record,setRecord]=useState<Record<string,unknown>|null>(null);
  const [loading,setLoading]=useState(true); const [error,setError]=useState("");
  useEffect(()=>{let active=true; (async()=>{try{const data=await api.get<unknown>(config.endpoint!);const rows=Array.isArray(data)?data:(data&&typeof data==="object"?Object.values(data as Record<string,unknown>).find(Array.isArray):[]);const found=(Array.isArray(rows)?rows:[]).find((row)=>row&&typeof row==="object"&&String((row as Record<string,unknown>).id)===id) as Record<string,unknown>|undefined;if(active)setRecord(found??null)}catch(e){if(active)setError((e as ApiError)?.message??"Unable to load this resource.")}finally{if(active)setLoading(false)}})();return()=>{active=false}},[config.endpoint,id]);
  const entries=useMemo(()=>record?Object.entries(record).filter(([key])=>key!=="id"):[],[record]);
  return <ContextShell config={config}><div className="page-heading"><div><span className="eyebrow">{config.eyebrow}</span><h1>{record?.name ? String(record.name) : config.title+" detail"}</h1><p>{config.description}</p></div><button className="console-refresh-button" onClick={()=>window.location.reload()}><RefreshCw size={15}/> Refresh</button></div>{loading&&<div className="surface empty-state"><strong>Loading resource…</strong><span>Reading the authenticated control-plane record.</span></div>}{!loading&&error&&<div className="surface empty-state resource-error"><strong>{error}</strong><span>Refresh after confirming the secure session and control plane.</span></div>}{!loading&&!error&&!record&&<div className="surface empty-state"><strong>Resource not found.</strong><span>The record may have been removed or may not belong to this organization.</span></div>}{record&&<><div className="resource-identity"><ShieldCheck size={19}/><div><span>Resource ID</span><strong>{id}</strong></div></div><section className="detail-grid">{entries.map(([key,value])=><div className="surface detail-field" key={key}><span>{key.replaceAll("_"," ")}</span><strong>{typeof value==="object"?JSON.stringify(value,null,2):String(value??"—")}</strong></div>)}</section><div className="context-next"><Link to={config.detailBase ?? (config.endpoint ? config.endpoint.replace("/api/v1","/app") : "/app")}>Back to resource</Link><Link to="/app/audit">Open audit <ArrowUpRight size={15}/></Link></div></>}</ContextShell>;
}

const teamTabs=[{label:"Members",href:"/app/team"},{label:"Invitations",href:"/app/team/invitations"},{label:"Roles",href:"/app/team/roles"}];

const baseConfigs:Record<string,Config>={
 "/app/tenants":{eyebrow:"TENANTS",title:"Tenant registry",description:"Review customer boundaries and open an organization-scoped tenant record to inspect its current state.",tabs:[{label:"Tenants",href:"/app/tenants"},{label:"Policies",href:"/app/policies"},{label:"Verification",href:"/app/verification"}],endpoint:"/api/v1/tenants",detailBase:"/app/tenants"},
 "/app/policies":{eyebrow:"POLICIES",title:"Policy control",description:"Review versioned enforcement intent and inspect the policy record associated with a deployment.",tabs:[{label:"Policies",href:"/app/policies"},{label:"Deployments",href:"/app/deployments"},{label:"Verification",href:"/app/verification"}],endpoint:"/api/v1/policies",detailBase:"/app/policies"},
 "/app/nodes":{eyebrow:"INFRASTRUCTURE",title:"Node inventory",description:"Inspect registered enforcement targets, their environment and reported health before relying on them for a rollout.",tabs:[{label:"Nodes",href:"/app/nodes"},{label:"Deployments",href:"/app/deployments"},{label:"Security",href:"/app/security"}],endpoint:"/api/v1/nodes",detailBase:"/app/nodes"},
 "/app/deployments":{eyebrow:"DEPLOYMENTS",title:"Deployment control",description:"Review desired state, target placement and observed deployment records. Open a deployment to inspect its recorded fields.",tabs:[{label:"Deployments",href:"/app/deployments"},{label:"Policies",href:"/app/policies"},{label:"Verification",href:"/app/verification"}],endpoint:"/api/v1/deployments",detailBase:"/app/deployments"},
 "/app/audit":{eyebrow:"AUDIT",title:"Audit explorer",description:"Inspect organization-scoped administrative and security evidence. Open an event to review its recorded details.",tabs:[{label:"Audit",href:"/app/audit"},{label:"Verification",href:"/app/verification"},{label:"Security",href:"/app/security"}],endpoint:"/api/v1/audit",detailBase:"/app/audit"},
 "/app/security/tenant-isolation":{eyebrow:"SECURITY",title:"Tenant isolation",description:"Inspect tenant-isolation verification evidence and enforcement state.",tabs:[{label:"Overview",href:"/app/security"},{label:"Tenant isolation",href:"/app/security/tenant-isolation"},{label:"Security events",href:"/app/security/events"}],endpoint:"/api/v1/verifications",detailBase:"/app/verification"},
 "/app/verification":{eyebrow:"VERIFICATION",title:"Verification evidence",description:"Open individual verification runs and inspect their evidence.",tabs:[{label:"Overview",href:"/app/verification"},{label:"Security posture",href:"/app/security"},{label:"Audit",href:"/app/audit"}],endpoint:"/api/v1/verifications",detailBase:"/app/verification"},
 "/app/team/invitations":{eyebrow:"TEAM",title:"Organization invitations",description:"Track invitations and their lifecycle inside the active organization.",tabs:teamTabs,sections:[
  {title:"Invitation lifecycle",text:"Invite the person's exact email address, assign the least-privileged role, and ask them to accept using that same address. Review expiry and revoke invitations that should no longer be usable.",href:"/app/team"},
  {title:"Access safety",text:"Treat invitation links as sensitive. Do not forward them to another person or use an invitation as a substitute for reviewing the recipient's role.",href:"/app/team/roles"},
  {title:"Delivery troubleshooting",text:"If an invitation does not arrive, verify the address, inspect email delivery configuration and check spam before sending another invitation.",href:"/docs/troubleshooting"},
 ]},
 "/app/team/roles":{eyebrow:"TEAM",title:"Organization roles",description:"Choose access according to responsibility and review privileged membership regularly.",tabs:teamTabs,sections:[
  {title:"Owner",text:"Accountable for organization authority and the highest-impact administrative actions. Keep ownership limited and recoverable."},
  {title:"Admin",text:"Manages organization membership and workspace configuration. Grant only to people who need administrative control."},
  {title:"Operator",text:"Runs day-to-day operational workflows such as resources, deployments and verification without automatically needing ownership."},
  {title:"Viewer",text:"Use for read-oriented access when a teammate needs to inspect state or evidence but should not change it."},
 ]},
 "/app/team/members":{eyebrow:"TEAM",title:"Team member",description:"Inspect an organization member and their current access role.",tabs:teamTabs,endpoint:"/api/v1/organization/team",detailBase:"/app/team",sections:[
  {title:"Review access",text:"Confirm the member's identity, current role and reason for access. Reassess access when responsibilities change."},
  {title:"Least privilege",text:"Use the narrowest role that supports the person's work and remove access when it is no longer required.",href:"/app/team/roles"},
 ]},
 "/app/security/events":{eyebrow:"SECURITY",title:"Security events",description:"Inspect organization-scoped security and control-plane events.",tabs:[{label:"Overview",href:"/app/security"},{label:"Tenant isolation",href:"/app/security/tenant-isolation"},{label:"Security events",href:"/app/security/events"}],endpoint:"/api/v1/audit",detailBase:"/app/audit"},
 "/app/billing/usage":{eyebrow:"BILLING",title:"Usage",description:"See current entitlement limits and resource consumption.",tabs:[{label:"Usage",href:"/app/billing/usage"},{label:"Plans",href:"/app/billing/plans"},{label:"Invoices",href:"/app/billing/invoices"}],endpoint:"/api/v1/billing/entitlements"},
 "/app/billing/plans":{eyebrow:"BILLING",title:"Plans",description:"Compare the commercial catalog against the active workspace entitlement.",tabs:[{label:"Usage",href:"/app/billing/usage"},{label:"Plans",href:"/app/billing/plans"},{label:"Invoices",href:"/app/billing/invoices"}],endpoint:"/api/v1/billing/plans"},
 "/app/billing/invoices":{eyebrow:"BILLING",title:"Invoices",description:"Inspect the billing account and invoice-facing records.",tabs:[{label:"Usage",href:"/app/billing/usage"},{label:"Plans",href:"/app/billing/plans"},{label:"Invoices",href:"/app/billing/invoices"}],endpoint:"/api/v1/billing"},
 "/app/settings/members":{eyebrow:"SETTINGS",title:"Workspace membership",description:"Review who belongs to the active organization and how access is granted, changed and removed.",tabs:[{label:"Workspace settings",href:"/app/settings"},{label:"Members",href:"/app/settings/members"},{label:"Team",href:"/app/team"},{label:"Roles",href:"/app/team/roles"}],sections:[
  {title:"Membership source",text:"Organization membership is managed in the Team area. Review the person's identity and role there rather than assuming a workspace setting automatically changes access.",href:"/app/team"},
  {title:"Role changes",text:"Grant the least-privileged role required for the work. Reassess access after a role or responsibility change.",href:"/app/team/roles"},
  {title:"Access lifecycle",text:"When access is no longer required, remove or revoke it through the supported membership workflow and inspect the audit history.",href:"/app/audit"},
 ]},
 "/app/settings/api":{eyebrow:"SETTINGS",title:"API and workspace access",description:"Understand how browser sessions, machine credentials and organization membership govern access.",tabs:[{label:"Authentication",href:"/app/settings/authentication"},{label:"Enterprise identity",href:"/app/settings/identity"},{label:"Security",href:"/app/settings/security"},{label:"API access",href:"/app/settings/api"},{label:"Environments",href:"/app/settings/environments"}],sections:[
  {title:"Browser sessions",text:"Human users sign in through the application session flow. Protect session cookies and use the expected CSRF protection for state-changing requests.",href:"/app/settings/authentication"},
  {title:"Machine credentials",text:"Create organization-scoped API keys for trusted integrations, keep secrets in a server-side secret manager and revoke credentials immediately when no longer trusted.",href:"/app/developer/api-keys"},
  {title:"Auditability",text:"Review administrative and security events after important access or configuration changes.",href:"/app/audit"},
 ]},
 "/app/settings/danger":{eyebrow:"SETTINGS",title:"Sensitive workspace actions",description:"Review the consequences and recovery requirements before making high-impact organization changes.",tabs:[{label:"Authentication",href:"/app/settings/authentication"},{label:"Security",href:"/app/settings/security"},{label:"API access",href:"/app/settings/api"},{label:"Sensitive actions",href:"/app/settings/danger"}],sections:[
  {title:"Before changing access",text:"Confirm the active organization, the affected identity and the intended outcome. Preserve at least one trusted administrator and verify recovery access."},
  {title:"Before revoking credentials",text:"Identify integrations that depend on the credential, rotate to a replacement where appropriate, verify the replacement and then revoke the old secret.",href:"/app/developer/api-keys"},
  {title:"Before destructive operations",text:"Confirm the documented retention and recovery behavior for the specific resource. Do not assume a destructive action can be undone.",href:"/docs/operations"},
 ]},
 "/app/developer/api-keys":{eyebrow:"DEVELOPER",title:"API keys",description:"Create, revoke and inspect organization-scoped machine credentials.",tabs:developerTabs,endpoint:"/api/v1/developer/api-keys",detailBase:"/app/developer/api-keys",createHref:"/app/developer/api-keys/new",createLabel:"Create API key"},
 "/app/developer/webhooks":{eyebrow:"DEVELOPER",title:"Webhooks",description:"Create endpoints, select events and inspect delivery history.",tabs:developerTabs,endpoint:"/api/v1/developer/webhooks",detailBase:"/app/developer/webhooks",createHref:"/app/developer/webhooks/new",createLabel:"Add webhook"},
};

type BillingPlan = {
  key: string;
  name: string;
  monthly_usd: number;
  description: string;
  checkout_available: boolean;
  limits: Record<string, number>;
  features: Record<string, boolean>;
  support_level: string;
};
type BillingCatalog = { currency: string; billing_interval: string; provider: string; plans: BillingPlan[] };
type BillingAccount = { configured: boolean; provider: string; plan: string; status: string; subscription_id?: string | null; current_period_end?: string | null; cancel_at_period_end?: boolean };
type BillingVerification = { verified: boolean; status: string; plan: string };

function BillingPlans() {
  const [searchParams] = useSearchParams();
  const billingReturn = searchParams.get("billing");
  const checkoutReference = searchParams.get("reference") ?? searchParams.get("tx_ref");
  const flutterwaveTransactionId = searchParams.get("transaction_id");
  const [catalog, setCatalog] = useState<BillingCatalog | null>(null);
  const [account, setAccount] = useState<BillingAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyPlan, setBusyPlan] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [plans, current] = await Promise.all([
          api.get<BillingCatalog>("/api/v1/billing/plans"),
          api.get<BillingAccount>("/api/v1/billing"),
        ]);
        if (cancelled) return;
        setCatalog(plans);
        setAccount(current);
        if (billingReturn === "return" && checkoutReference && flutterwaveTransactionId) {
          try {
            const verification = await api.get<BillingVerification>(`/api/v1/billing/verify?reference=${encodeURIComponent(checkoutReference)}&transaction_id=${encodeURIComponent(flutterwaveTransactionId)}`);
            if (!cancelled) {
              setNotice(verification.verified
                ? "Payment confirmed. Your plan status has been refreshed."
                : "Checkout returned successfully. We are waiting for the signed billing confirmation; paid access will update automatically once verified.");
              const refreshed = await api.get<BillingAccount>("/api/v1/billing");
              if (!cancelled) setAccount(refreshed);
            }
          } catch {
            if (!cancelled) setNotice("Checkout returned. Billing confirmation is still processing; please refresh shortly.");
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load billing plans.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [billingReturn, checkoutReference]);

  async function startCheckout(plan: BillingPlan) {
    setBusyPlan(plan.key); setError(""); setNotice("");
    try {
      const result = await api.post<{ checkout_url: string; reference: string; amount: number; currency: string }>("/api/v1/billing/checkout", { price_id: plan.key });
      if (!result.checkout_url || !result.checkout_url.startsWith("https://") || !result.reference) throw new Error("Flutterwave did not return a secure hosted checkout URL.");
      window.location.assign(result.checkout_url);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to start Flutterwave checkout."); setBusyPlan(""); }
  }

  async function openPortal() {
    setBusyPlan("portal");
    setError("");
    try {
      const result = await api.post<{ portal_url: string }>("/api/v1/billing/portal", {});
      if (!result.portal_url || !result.portal_url.startsWith("https://")) throw new Error("The customer portal is not available yet.");
      window.location.assign(result.portal_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open the billing portal.");
      setBusyPlan("");
    }
  }

  const money = (amount: number) => amount === 0 ? "Free" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
  const labelForFeature = (key: string) => key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const currentPlan = account?.plan ?? "free";

  return <div className="resource-page billing-plans-page">
    <div className="page-heading">
      <div><span className="eyebrow">BILLING · FLUTTERWAVE</span><h1>Plans and billing</h1><p>Choose a monthly plan. USD prices are displayed and the configured USD monthly amount is verified server-side before access is enabled.</p></div>
      {account?.subscription_id && <button type="button" className="console-refresh-button" onClick={() => void openPortal()} disabled={busyPlan !== ""}>{busyPlan === "portal" ? "Opening portal…" : "Manage subscription (support)"}</button>}
    </div>
    {account && <section className="surface billing-current-plan">
      <div><span className="eyebrow">CURRENT WORKSPACE PLAN</span><h2>{currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}</h2><p>Status: <strong>{account.status}</strong>{account.current_period_end ? ` · Period ends ${new Date(account.current_period_end).toLocaleDateString()}` : ""}{account.cancel_at_period_end ? " · Cancellation scheduled" : ""}</p></div>
      <span className={account.status === "active" || account.status === "non-renewing" ? "console-status console-status--active" : "console-status console-status--pending"}>{account.status}</span>
    </section>}
    {notice && <div className="settings-banner settings-banner--success" role="status">{notice}</div>}
    {error && <div className="settings-banner settings-banner--error" role="alert">{error}</div>}
    {loading && <div className="empty-state"><strong>Loading billing catalog…</strong><span>Reading the live plan catalog and workspace subscription.</span></div>}
    {!loading && !error && catalog && <div className="billing-plan-grid">
      {catalog.plans.map((plan) => {
        const isCurrent = currentPlan === plan.key && account?.configured && ["active", "non-renewing", "attention", "past_due"].includes(account.status);
        const isEnterprise = plan.key === "enterprise";
        const isFree = plan.key === "free";
        return <section className={`surface billing-plan-card ${isCurrent ? "billing-plan-card--current" : ""}`} key={plan.key}>
          <div className="billing-plan-card-heading"><span className="eyebrow">{plan.key.toUpperCase()}</span>{isCurrent && <span className="console-status console-status--active">Current plan</span>}</div>
          <h2>{plan.name}</h2>
          <p className="billing-plan-description">{plan.description}</p>
          <div className="billing-plan-price"><strong>{isEnterprise ? "Custom" : money(plan.monthly_usd)}</strong>{!isEnterprise && plan.monthly_usd > 0 && <span>/ month</span>}</div>
          <div className="billing-plan-detail"><strong>{plan.limits.nodes ?? "—"}</strong><span>nodes</span><strong>{plan.limits.tenants ?? "—"}</strong><span>tenants</span><strong>{plan.limits.integrations ?? "—"}</strong><span>integrations</span></div>
          <div className="billing-plan-features"><strong>Included capabilities</strong><ul>{Object.entries(plan.features).filter(([, enabled]) => enabled).map(([key]) => <li key={key}>{labelForFeature(key)}</li>)}<li>{labelForFeature(plan.support_level)} support</li></ul></div>
          {isEnterprise
            ? <Link className="primary-action" to="/contact">Contact sales <ArrowUpRight size={15}/></Link>
            : isFree
              ? <button type="button" className="primary-action" disabled>{isCurrent ? "Current free plan" : "Free tier"}</button>
              : <button type="button" className="primary-action" onClick={() => void startCheckout(plan)} disabled={!plan.checkout_available || isCurrent || busyPlan !== ""}>{busyPlan === plan.key ? "Preparing checkout…" : isCurrent ? "Current plan" : plan.checkout_available ? `Choose ${plan.name}` : "Checkout not configured"}</button>}
        </section>;
      })}
    </div>}
    {!loading && catalog && !catalog.plans.some((plan) => plan.checkout_available) && <div className="empty-state"><strong>Checkout is not configured yet.</strong><span>Configure the Flutterwave live secret key, webhook secret hash, three unique monthly payment-plan IDs and matching NGN amounts before checkout is enabled.</span></div>}
  </div>;
}


type ApiKeyRecord = {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
};

function ApiKeysManager() {
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadKeys = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
      setError("");
    }
    try {
      const result = await api.get<ApiKeyRecord[]>("/api/v1/developer/api-keys");
      setKeys(result);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load API keys.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadKeys(false); }, [loadKeys]);

  async function revokeKey(key: ApiKeyRecord) {
    if (key.revoked_at) return;
    const confirmed = window.confirm(
      `Revoke "${key.name}" (${key.key_prefix})? This takes effect immediately and any integration using it will stop authenticating. This cannot be undone.`,
    );
    if (!confirmed) return;
    setRevoking(key.id);
    setError("");
    setNotice("");
    try {
      await api.delete<{ok:boolean;message:string}>(`/api/v1/developer/api-keys/${key.id}`);
      setNotice(`API key "${key.name}" was revoked. The revocation is recorded in the audit stream.`);
      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to revoke this API key.");
    } finally {
      setRevoking("");
    }
  }

  return (
    <div className="api-keys-manager">
      <div className="page-heading">
        <div>
          <span className="eyebrow">DEVELOPER · API KEYS</span>
          <h1>API keys</h1>
          <p>Create credentials for integrations and revoke any key that is no longer trusted. The full secret is shown only once.</p>
        </div>
        <Link className="primary-action" to="/app/developer/api-keys/new"><KeyRound size={15}/>Create API key</Link>
      </div>
      <div className="api-key-policy-note">
        <ShieldCheck size={17} />
        <p><strong>Credential safety</strong><span>Revocation is immediate and is never capped by a lifetime counter. Confirm each action carefully; the API records successful revocations in the organization audit log.</span></p>
      </div>
      {notice && <div className="settings-banner settings-banner--success" role="status">{notice}</div>}
      {error && <div className="settings-banner settings-banner--error" role="alert">{error}</div>}
      {loading ? (
        <div className="surface empty-state"><strong>Loading API keys…</strong><span>Reading keys for the active organization.</span></div>
      ) : keys.length === 0 ? (
        <div className="surface empty-state"><KeyRound size={24}/><strong>No API keys yet.</strong><span>Create a key for an integration. The full secret is displayed only once.</span></div>
      ) : (
        <div className="api-key-list">
          {keys.map((key) => (
            <article className="surface api-key-row" key={key.id}>
              <div className="api-key-details">
                <div className="api-key-title"><KeyRound size={17}/><strong>{key.name}</strong><span className={key.revoked_at ? "api-key-status api-key-status--revoked" : "api-key-status"}>{key.revoked_at ? "Revoked" : "Active"}</span></div>
                <code>{key.key_prefix}…¢…¢…¢…¢…¢…¢…¢…¢</code>
                <div className="api-key-meta">
                  <span>Created {new Date(key.created_at).toLocaleString()}</span>
                  <span>{key.last_used_at ? `Last used ${new Date(key.last_used_at).toLocaleString()}` : "Never used"}</span>
                  {key.revoked_at && <span>Revoked {new Date(key.revoked_at).toLocaleString()}</span>}
                </div>
              </div>
              {!key.revoked_at && <button className="api-key-revoke" type="button" onClick={() => void revokeKey(key)} disabled={revoking !== ""}>{revoking === key.id ? "Revoking…" : "Revoke key"}</button>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}


type WebhookRecord = {
  id:string; name:string; endpoint_url:string; events:string[]; enabled:boolean;
  signing_secret_hint?:string; created_at:string; updated_at:string;
};
type WebhookDelivery = {
  id:string; event_type:string; event_id:string; status:string; status_code:number|null;
  response_ms:number|null; attempt_count:number; max_attempts:number; next_attempt_at:string;
  last_attempt_at:string|null; delivered_at:string|null; last_error:string|null;
  response_excerpt:string|null; created_at:string;
};
type WebhookCreated = { id:string; signing_secret:string; message:string };

function WebhooksManager() {
  const [items,setItems]=useState<WebhookRecord[]>([]);
  const [deliveries,setDeliveries]=useState<Record<string,WebhookDelivery[]>>({});
  const [name,setName]=useState("");
  const [endpoint,setEndpoint]=useState("");
  const [events,setEvents]=useState("*");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [oneTimeSecret,setOneTimeSecret]=useState("");
  const [expanded,setExpanded]=useState("");

  const load=useCallback(async()=>{
    setLoading(true); setError("");
    try { setItems(await api.get<WebhookRecord[]>("/api/v1/developer/webhooks")); }
    catch(e){setError(e instanceof Error?e.message:"Unable to load webhook endpoints.");}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);

  async function createWebhook(e:FormEvent<HTMLFormElement>){
    e.preventDefault(); setBusy("create"); setError(""); setNotice(""); setOneTimeSecret("");
    try {
      const created=await api.post<WebhookCreated>("/api/v1/developer/webhooks",{
        name,endpoint_url:endpoint,events:events.split(",").map(v=>v.trim()).filter(Boolean)
      });
      setOneTimeSecret(created.signing_secret);
      setNotice("Webhook endpoint created. Copy the signing secret now; it cannot be retrieved later.");
      setName(""); setEndpoint(""); setEvents("*"); await load();
    } catch(err){setError(err instanceof Error?err.message:"Unable to create webhook endpoint.");}
    finally{setBusy("");}
  }

  async function loadDeliveries(id:string){
    setExpanded(id); setError("");
    try {
      const result=await api.get<WebhookDelivery[]>(`/api/v1/developer/webhooks/${id}/deliveries`);
      setDeliveries(old=>({...old,[id]:result}));
    } catch(err){setError(err instanceof Error?err.message:"Unable to load delivery history.");}
  }
  async function setEnabled(item:WebhookRecord){
    setBusy(item.id);setError("");setNotice("");
    try{await api.post(`/api/v1/developer/webhooks/${item.id}/enabled`,{enabled:!item.enabled});setNotice(`Webhook ${!item.enabled?"enabled":"disabled"}.`);await load();}
    catch(err){setError(err instanceof Error?err.message:"Unable to update webhook.");}
    finally{setBusy("");}
  }
  async function rotate(item:WebhookRecord){
    if(!window.confirm(`Rotate the signing secret for "${item.name}"? The receiver must be updated immediately.`))return;
    setBusy(item.id);setError("");setNotice("");setOneTimeSecret("");
    try{const result=await api.post<WebhookCreated>(`/api/v1/developer/webhooks/${item.id}/rotate-secret`,{});setOneTimeSecret(result.signing_secret);setNotice(`Signing secret rotated for "${item.name}". Copy it now.`);await load();}
    catch(err){setError(err instanceof Error?err.message:"Unable to rotate signing secret.");}
    finally{setBusy("");}
  }
  async function remove(item:WebhookRecord){
    if(!window.confirm(`Delete "${item.name}" and its delivery history? This cannot be undone.`))return;
    setBusy(item.id);setError("");setNotice("");
    try{await api.delete(`/api/v1/developer/webhooks/${item.id}`);setNotice(`Webhook "${item.name}" deleted.`);if(expanded===item.id)setExpanded("");await load();}
    catch(err){setError(err instanceof Error?err.message:"Unable to delete webhook.");}
    finally{setBusy("");}
  }
  async function retry(item:WebhookRecord,delivery:WebhookDelivery){
    setBusy(delivery.id);setError("");setNotice("");
    try{await api.post(`/api/v1/developer/webhooks/${item.id}/deliveries/${delivery.id}/retry`,{});setNotice("Delivery queued for retry.");await loadDeliveries(item.id);}
    catch(err){setError(err instanceof Error?err.message:"Unable to retry delivery.");}
    finally{setBusy("");}
  }

  return <div className="webhooks-manager">
    <div className="page-heading"><div><span className="eyebrow">DEVELOPER · WEBHOOKS</span><h1>Webhooks</h1><p>Subscribe to real Agata audit events, deliver signed payloads, and inspect recorded attempts.</p></div><button className="console-refresh-button" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> Refresh</button></div>
    {notice&&<div className="settings-banner settings-banner--success" role="status">{notice}</div>}
    {error&&<div className="settings-banner settings-banner--error" role="alert">{error}</div>}
    {oneTimeSecret&&<section className="surface webhook-secret-notice"><strong>Signing secret — shown once</strong><p>Copy this into your receiving service's secret store now. It will not be displayed again.</p><code>{oneTimeSecret}</code><button type="button" className="console-refresh-button" onClick={()=>void navigator.clipboard?.writeText(oneTimeSecret)}>Copy secret</button></section>}
    <form className="surface webhook-create-form" onSubmit={createWebhook}>
      <div><span className="eyebrow">NEW ENDPOINT</span><h2>Add webhook</h2><p>Production destinations must use HTTPS and resolve to public IP addresses.</p></div>
      <label>Endpoint name<input value={name} onChange={e=>setName(e.target.value)} required maxLength={120} placeholder="Production event receiver"/></label>
      <label>HTTPS endpoint URL<input value={endpoint} onChange={e=>setEndpoint(e.target.value)} type="url" required placeholder="https://example.com/agata/events"/></label>
      <label>Event types<input value={events} onChange={e=>setEvents(e.target.value)} required placeholder="* or developer.api_key.created,tenant.created"/><small>Enter exact audit action names separated by commas, or * to receive all audit events.</small></label>
      <button className="primary-action" type="submit" disabled={busy==="create"}>{busy==="create"?"Creating…":"Create endpoint"}</button>
    </form>
    <div className="webhook-endpoint-list">
      {loading?<div className="surface empty-state"><strong>Loading webhook endpoints…</strong><span>Reading endpoint records from the control plane.</span></div>:
       items.length===0?<div className="surface empty-state"><strong>No webhook endpoints yet.</strong><span>Create an endpoint above to receive signed audit events.</span></div>:
       items.map(item=><article className="surface webhook-endpoint-card" key={item.id}>
         <div className="webhook-endpoint-heading"><div><span className="eyebrow">WEBHOOK ENDPOINT</span><h2>{item.name}</h2><code>{item.endpoint_url}</code></div><span className={item.enabled?"console-status console-status--active":"console-status console-status--pending"}>{item.enabled?"Enabled":"Disabled"}</span></div>
         <div className="webhook-event-tags">{item.events.map(ev=><span key={ev}>{ev}</span>)}</div>
         <p className="webhook-endpoint-meta">Created {new Date(item.created_at).toLocaleString()} · Secret hint: {item.signing_secret_hint??"rotate required for legacy endpoint"}</p>
         <div className="webhook-actions">
           <button type="button" onClick={()=>void loadDeliveries(item.id)}>{expanded===item.id?"Refresh deliveries":"Delivery history"}</button>
           <button type="button" disabled={busy===item.id} onClick={()=>void setEnabled(item)}>{item.enabled?"Disable":"Enable"}</button>
           <button type="button" disabled={busy===item.id} onClick={()=>void rotate(item)}>Rotate secret</button>
           <button type="button" className="webhook-danger-action" disabled={busy===item.id} onClick={()=>void remove(item)}>Delete</button>
         </div>
         {expanded===item.id&&<div className="webhook-delivery-list"><h3>Delivery attempts</h3>
           {(deliveries[item.id]??[]).length===0?<p>No delivery records are available for this endpoint yet.</p>:
             (deliveries[item.id]??[]).map(delivery=><div className="webhook-delivery-row" key={delivery.id}>
               <div><strong>{delivery.event_type}</strong><span>{delivery.status} · attempt {delivery.attempt_count}/{delivery.max_attempts} · {delivery.status_code?`HTTP ${delivery.status_code}`:"no HTTP response"}</span><code>{delivery.id}</code>{delivery.last_error&&<small>{delivery.last_error}</small>}</div>
               <time>{new Date(delivery.created_at).toLocaleString()}</time>
               {["failed","dead_letter","delivered"].includes(delivery.status)&&<button type="button" disabled={busy===delivery.id||!item.enabled} onClick={()=>void retry(item,delivery)}>{busy===delivery.id?"Queueing…":"Retry / replay"}</button>}
             </div>)}
         </div>}
       </article>)}
    </div>
  </div>;
}

export function NestedResource(){
  const {pathname}=useLocation(); const params=useParams();
  const detailId=params.tenantId??params.policyId??params.nodeId??params.deploymentId??params.runId??params.eventId??params.apiKeyId??params.webhookId;
  const base=detailId?pathname.replace(/\/[^/]+$/,""):pathname;
  const config=baseConfigs[base]??baseConfigs[pathname];
  if(pathname === "/app/developer/api-keys" && config) return <ContextShell config={config}><ApiKeysManager /></ContextShell>;
  if(pathname === "/app/developer/webhooks" && config) return <ContextShell config={config}><WebhooksManager /></ContextShell>;
  if(pathname === "/app/billing/plans" && config) return <ContextShell config={config}><BillingPlans /></ContextShell>;
  if(detailId && config?.endpoint) return <DetailPage config={config} id={detailId}/>;
  if(config) return <ContextShell config={config}><ResourceSurface eyebrow={config.eyebrow} title={config.title} description={config.description} endpoint={config.endpoint} detailBase={config.detailBase} createHref={config.createHref} createLabel={config.createLabel} sections={config.sections}/></ContextShell>;
  if (pathname === "/app/settings/identity") return <EntraIdentitySettings />;
  const doc=developerDocs[pathname];
  const routeLabel = pathname.split("/").filter(Boolean).at(-1)?.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) ?? "Workspace";
  const generic:Config={eyebrow:pathname.startsWith("/app/developer")?"DEVELOPER":"SETTINGS",title:doc?.title??routeLabel,description:doc?.intro??"Reference guidance and next steps for this workspace area.",tabs:pathname.startsWith("/app/developer")?developerTabs:[{label:"Authentication",href:"/app/settings/authentication"},{label:"Enterprise identity",href:"/app/settings/identity"},{label:"Security",href:"/app/settings/security"},{label:"API access",href:"/app/settings/api"},{label:"Sensitive actions",href:"/app/settings/danger"},{label:"Notifications",href:"/app/settings/notifications"}]};
  if(doc) return <DeveloperDoc config={generic} doc={doc}/>;
  return (
    <ContextShell config={generic}>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{generic.eyebrow}</span>
          <h1>{generic.title}</h1>
        </div>
      </div>
    </ContextShell>
  );
}