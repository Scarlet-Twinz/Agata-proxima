import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowUpRight, BookOpen, ChevronRight, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
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
    intro:"Machine identities should have explicit ownership, narrow credentials and an auditable lifecycle.",
    sections:[
      {title:"Current contract",body:"Agata's API-key resource provides the first machine-credential surface. Service-account grouping remains the conceptual home for future non-human identity controls."},
      {title:"Credential discipline",body:"Create credentials for a single integration purpose, store them outside source control, rotate them deliberately and revoke them immediately when no longer trusted."},
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
    intro:"Environment boundaries keep production, staging and future isolated workloads understandable as the platform grows.",
    sections:[
      {title:"Production",body:"The current workspace exposes Production as the active environment. Future environment management belongs here rather than being hidden in unrelated pages."},
      {title:"Deployment relationship",body:"Nodes and deployments carry environment information so desired state can be connected to an explicit operating boundary."},
    ],
  },
  "/app/developer/sdks": {
    title:"SDKs",
    intro:"SDKs should make the API contract easier to consume without hiding the tenant-security model.",
    sections:[
      {title:"SDK design",body:"Generated or maintained SDKs should expose typed organizations, tenants, policies, nodes, deployments, verification, audit and developer resources."},
      {title:"Source of truth",body:"The OpenAPI contract remains authoritative. SDKs should not invent semantics that the control-plane API does not provide."},
    ],
  },
  "/app/developer/cli": {
    title:"CLI",
    intro:"A serious infrastructure product needs a command-line path for engineers who work faster outside the browser.",
    sections:[
      {title:"Core workflow",body:"Authenticate → select organization → inspect resources → create/change resources → run verification → inspect evidence."},
      {title:"Example",body:"The CLI follows the same authenticated resource model as the dashboard.",code:"agata login\nagata tenants list\nagata verification list\nagata verification run\nagata audit list"},
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

function DetailPage({config,id}:{config:Config;id:string}){
  const [record,setRecord]=useState<Record<string,unknown>|null>(null);
  const [loading,setLoading]=useState(true); const [error,setError]=useState("");
  useEffect(()=>{let active=true; (async()=>{try{const data=await api.get<unknown>(config.endpoint!);const rows=Array.isArray(data)?data:(data&&typeof data==="object"?Object.values(data as Record<string,unknown>).find(Array.isArray):[]);const found=(Array.isArray(rows)?rows:[]).find((row)=>row&&typeof row==="object"&&String((row as Record<string,unknown>).id)===id) as Record<string,unknown>|undefined;if(active)setRecord(found??null)}catch(e){if(active)setError((e as ApiError)?.message??"Unable to load this resource.")}finally{if(active)setLoading(false)}})();return()=>{active=false}},[config.endpoint,id]);
  const entries=useMemo(()=>record?Object.entries(record).filter(([key])=>key!=="id"):[],[record]);
  return <ContextShell config={config}><div className="page-heading"><div><span className="eyebrow">{config.eyebrow}</span><h1>{record?.name ? String(record.name) : config.title+" detail"}</h1><p>{config.description}</p></div><button className="console-refresh-button" onClick={()=>window.location.reload()}><RefreshCw size={15}/> Refresh</button></div>{loading&&<div className="surface empty-state"><strong>Loading resource…</strong><span>Reading the authenticated control-plane record.</span></div>}{!loading&&error&&<div className="surface empty-state resource-error"><strong>{error}</strong><span>Refresh after confirming the secure session and control plane.</span></div>}{!loading&&!error&&!record&&<div className="surface empty-state"><strong>Resource not found.</strong><span>The record may have been removed or may not belong to this organization.</span></div>}{record&&<><div className="resource-identity"><ShieldCheck size={19}/><div><span>Resource ID</span><strong>{id}</strong></div></div><section className="detail-grid">{entries.map(([key,value])=><div className="surface detail-field" key={key}><span>{key.replaceAll("_"," ")}</span><strong>{typeof value==="object"?JSON.stringify(value,null,2):String(value??"—")}</strong></div>)}</section><div className="context-next"><Link to={config.endpoint ? config.endpoint.replace("/api/v1","/app") : "/app"}>Back to resource</Link><Link to="/app/audit">Open audit <ArrowUpRight size={15}/></Link></div></>}</ContextShell>;
}

const teamTabs=[{label:"Members",href:"/app/team"},{label:"Invitations",href:"/app/team/invitations"},{label:"Roles",href:"/app/team/roles"}];

const baseConfigs:Record<string,Config>={
 "/app/security/tenant-isolation":{eyebrow:"SECURITY",title:"Tenant isolation",description:"Inspect tenant-isolation verification evidence and enforcement state.",tabs:[{label:"Overview",href:"/app/security"},{label:"Tenant isolation",href:"/app/security/tenant-isolation"},{label:"Security events",href:"/app/security/events"}],endpoint:"/api/v1/verifications",detailBase:"/app/verification"},
 "/app/verification":{eyebrow:"VERIFICATION",title:"Verification evidence",description:"Open individual verification runs and inspect their evidence.",tabs:[{label:"Overview",href:"/app/verification"},{label:"Security posture",href:"/app/security"},{label:"Audit",href:"/app/audit"}],endpoint:"/api/v1/verifications",detailBase:"/app/verification"},
 "/app/team/invitations":{eyebrow:"TEAM",title:"Organization invitations",description:"Track invitations and their lifecycle inside the active organization.",tabs:teamTabs},
 "/app/team/roles":{eyebrow:"TEAM",title:"Roles",description:"Understand the responsibilities attached to each organization role.",tabs:teamTabs},
 "/app/team/members":{eyebrow:"TEAM",title:"Team member",description:"Inspect an organization member and their current access role.",tabs:teamTabs},
 "/app/security/events":{eyebrow:"SECURITY",title:"Security events",description:"Inspect organization-scoped security and control-plane events.",tabs:[{label:"Overview",href:"/app/security"},{label:"Tenant isolation",href:"/app/security/tenant-isolation"},{label:"Security events",href:"/app/security/events"}],endpoint:"/api/v1/audit",detailBase:"/app/audit"},
 "/app/billing/usage":{eyebrow:"BILLING",title:"Usage",description:"See current entitlement limits and resource consumption.",tabs:[{label:"Usage",href:"/app/billing/usage"},{label:"Plans",href:"/app/billing/plans"},{label:"Invoices",href:"/app/billing/invoices"}],endpoint:"/api/v1/billing/entitlements"},
 "/app/billing/plans":{eyebrow:"BILLING",title:"Plans",description:"Compare the commercial catalog against the active workspace entitlement.",tabs:[{label:"Usage",href:"/app/billing/usage"},{label:"Plans",href:"/app/billing/plans"},{label:"Invoices",href:"/app/billing/invoices"}],endpoint:"/api/v1/billing/plans"},
 "/app/billing/invoices":{eyebrow:"BILLING",title:"Invoices",description:"Inspect the billing account and invoice-facing records.",tabs:[{label:"Usage",href:"/app/billing/usage"},{label:"Plans",href:"/app/billing/plans"},{label:"Invoices",href:"/app/billing/invoices"}],endpoint:"/api/v1/billing"},
 "/app/developer/api-keys":{eyebrow:"DEVELOPER",title:"API keys",description:"Create, revoke and inspect organization-scoped machine credentials.",tabs:developerTabs,endpoint:"/api/v1/developer/api-keys",detailBase:"/app/developer/api-keys",createHref:"/app/developer/api-keys/new",createLabel:"Create API key"},
 "/app/developer/webhooks":{eyebrow:"DEVELOPER",title:"Webhooks",description:"Create endpoints, select events and inspect delivery history.",tabs:developerTabs,endpoint:"/api/v1/developer/webhooks",detailBase:"/app/developer/webhooks",createHref:"/app/developer/webhooks/new",createLabel:"Add webhook"},
};

export function NestedResource(){
  const {pathname}=useLocation(); const params=useParams();
  const detailId=params.tenantId??params.policyId??params.nodeId??params.deploymentId??params.runId??params.eventId??params.apiKeyId??params.webhookId;
  const base=detailId?pathname.replace(/\/[^/]+$/,""):pathname;
  const config=baseConfigs[base]??baseConfigs[pathname];
  if(detailId && config?.endpoint) return <DetailPage config={config} id={detailId}/>;
  if(config) return <ContextShell config={config}><ResourceSurface eyebrow={config.eyebrow} title={config.title} description={config.description} endpoint={config.endpoint} detailBase={config.detailBase} createHref={config.createHref} createLabel={config.createLabel}/></ContextShell>;
  const doc=developerDocs[pathname];
  const generic:Config={eyebrow:pathname.startsWith("/app/developer")?"DEVELOPER":"SETTINGS",title:doc?.title??"Workspace detail",description:doc?.intro??"Explore the operational detail behind this workspace area.",tabs:pathname.startsWith("/app/developer")?developerTabs:[{label:"Authentication",href:"/app/settings/authentication"},{label:"Enterprise identity",href:"/app/settings/identity"},{label:"Security",href:"/app/settings/security"},{label:"Environments",href:"/app/settings/environments"},{label:"Notifications",href:"/app/settings/notifications"}]};
  if(doc) return <DeveloperDoc config={generic} doc={doc}/>;
  return <ContextShell config={generic}><div className="surface empty-state"><BookOpen size={24}/><strong>This workspace area is ready for its detailed contract.</strong><span>Use the related navigation to move through the product without dead-end screens.</span></div></ContextShell>;
}
