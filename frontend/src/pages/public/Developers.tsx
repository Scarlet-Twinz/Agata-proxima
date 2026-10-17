import { ArrowRight, ChevronRight, Code2, Database, GitBranch, MessageSquare, Server, ShieldCheck, Webhook, Workflow } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const resources = [
  ["Quickstart", "Set up a test workspace, create tenant fixtures and verify the protected request path.", "/developers/quickstart", "core"],
  ["Developer downloads", "Download the integration starter kit, Node.js client example, CLI scripts and webhook receiver sample.", "/developers/downloads", "tooling"],
  ["Node.js integration", "Call the API from a trusted Node.js service using environment-based credentials.", "/developers/nodejs", "core"],
  ["Authentication", "Sessions, CSRF, organization roles, API keys and enterprise identity.", "/developers/authentication", "core"],
  ["Organizations", "Membership, roles, invitations and administrative scope.", "/developers/organizations", "core"],
  ["Tenant context", "Resolve and preserve tenant identity through each protected operation.", "/developers/tenant-context", "core"],
  ["Policies", "Manage enforcement intent and link changes to deployment and verification.", "/developers/policies", "core"],
  ["Fleet and deployments", "Register nodes, configure environments and inspect deployment lifecycle.", "/developers/fleet", "core"],
  ["Secure node enrollment", "Bootstrap a node with a one-time token and persist its identity safely.", "/docs/node-enrollment", "core"],
  ["Verification", "Test allowed access, denied cross-tenant access and missing-context behavior.", "/developers/verification", "core"],
  ["Audit and events", "Review security-relevant changes and integrate event delivery.", "/developers/events", "core"],
  ["Webhooks", "Configure signed events, verify signatures and operate delivery retries.", "/developers/webhooks", "core"],
  ["API reference", "Use the versioned `/api/v1` contract and inspect request/response schemas.", "/developers/api-reference", "core"],
  ["SDK guide", "Use the packaged server-side JavaScript SDK source, tests and controlled release workflow.", "/developers/sdks", "tooling"],
  ["CLI guide", "Run checks and manage environments or webhooks from a terminal or CI.", "/developers/cli", "tooling"],
  ["Terraform provider", "Use the source provider for named environments; registry publication is pending.", "/developers/terraform", "tooling"],
  ["Service accounts", "Manage machine identities and revoke all linked credentials from one place.", "/developers/organizations", "core"],
  ["Environments", "Name development, staging and production stages inside an organization.", "/developers/fleet", "core"],
];
const integrations = [
  ["ChatGPT / MCP", "Connect an assistant through a scoped MCP server and explicit tool permissions.", "/developers/integrations/chatgpt", MessageSquare],
  ["Supabase", "Coordinate tenant identity with PostgreSQL RLS and server-side API calls.", "/developers/integrations/supabase", Database],
  ["Firebase", "Use verified Firebase identity tokens as one input to server-side authorization.", "/developers/integrations/firebase", ShieldCheck],
  ["GitHub Actions", "Run integration and tenant-isolation acceptance checks in CI.", "/developers/integrations/github", GitBranch],
  ["Vercel", "Configure deployment environments, server-side secrets and post-deploy checks.", "/developers/integrations/vercel", Workflow],
  ["PostgreSQL + RLS", "Apply least-privilege database roles and test tenant-scoped queries.", "/developers/integrations/postgresql", Server],
];
const side = [["Developer home", "/developers"], ["Quickstart", "/developers/quickstart"], ["Downloads", "/developers/downloads"], ["Node.js", "/developers/nodejs"], ["Authentication", "/developers/authentication"], ["Organizations", "/developers/organizations"], ["Tenant context", "/developers/tenant-context"], ["Policies", "/developers/policies"], ["Node enrollment", "/docs/node-enrollment"], ["Verification", "/developers/verification"], ["Webhooks", "/developers/webhooks"], ["SDKs", "/developers/sdks"], ["CLI", "/developers/cli"], ["Terraform", "/developers/terraform"], ["API reference", "/developers/api-reference"], ["Integration catalog", "/developers/integrations"]];

export function Developers() {
  return <PublicPage eyebrow="Developer platform" title="Build, connect and verify with Agata Proxima." description="A complete developer path for authentication, tenant context, policy and deployment workflows, verification, audit, signed webhooks and API-based integrations.">
    <section className="public-content"><div className="agata-container"><div className="public-detail-layout">
      <aside className="public-detail-sidebar"><div className="public-detail-sidebar-title">Developer platform</div>{side.map(([label,to])=><Link key={to} to={to}>{label}<ChevronRight size={13}/></Link>)}</aside>
      <div>
        <div className="public-prose"><h2>Start with the working integration path.</h2><p>Authenticate the caller, confirm organization scope, resolve tenant context from trusted state, configure the resources required by the environment, and verify both permitted and prohibited operations. Use the API contract as the source for exact request fields and responses.</p>
          <ol><li>Read the quickstart and authentication guide.</li><li>Configure an organization-scoped credential for server-side use.</li><li>Create the minimum test resources and connect the protected runtime path.</li><li>Run positive and negative tenant-isolation checks.</li><li>Inspect verification and audit evidence.</li></ol>
          <pre className="public-code">{`# Set the API origin for your environment
$env:AGATA_API_BASE_URL = "https://api.example.com"

# Check the service and public plan catalogue
curl "$env:AGATA_API_BASE_URL/api/v1/health"
curl "$env:AGATA_API_BASE_URL/api/v1/billing/plans"`}</pre>
          <p>Use the actual API origin configured for your deployment. Do not put credentials in frontend code, shell transcripts or committed files.</p>
        </div>
        <h2 className="public-section-title" style={{marginTop:32}}>Developer reference</h2>
        <div className="public-feature-grid">{resources.map(([title,text,to,group])=><Link className="public-feature public-feature-action" key={String(title)} to={String(to)}><Code2 size={19} color="var(--agata-blue)"/><h3>{String(title)}</h3><p>{String(text)}</p><span className="public-inline-link">{group === "tooling" ? "Open implementation guide" : "Open guide"} <ArrowRight size={15}/></span></Link>)}</div>
        <h2 className="public-section-title" style={{marginTop:36}}>Integration recipes</h2>
        <p className="public-prose">Choose a recipe for the platform or service in your stack. Each guide covers the trust boundary, credentials, configuration, implementation pattern and acceptance checks.</p>
        <div className="public-feature-grid">{integrations.map(([title,text,to,Icon])=>{const I=Icon as typeof Database;return <Link className="public-feature public-feature-action" key={String(title)} to={String(to)}><I size={20} color="var(--agata-blue)"/><h3>{String(title)}</h3><p>{String(text)}</p><span className="public-inline-link">Read integration guide <ArrowRight size={15}/></span></Link>})}</div>
        <div className="public-detail-links" style={{marginTop:28}}><Link className="agata-button agata-button-primary" to="/developers/integrations">Open integration catalog <ArrowRight size={15}/></Link><Link className="agata-button agata-button-secondary" to="/docs/api-reference">API reference</Link><Link className="agata-button agata-button-secondary" to="/developers/webhooks"><Webhook size={15}/> Webhooks</Link></div>
      </div>
    </div></div></section>
  </PublicPage>;
}
