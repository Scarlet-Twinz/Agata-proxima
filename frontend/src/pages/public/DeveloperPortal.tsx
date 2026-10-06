import { useMemo } from "react";
import { ExternalLink, Github } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import "./developer-portal.css";

type DeveloperSection = {
  title: string;
  intro: string;
  sections: Array<{ title: string; text: string; code?: string }>;
};

const sections: Record<string, DeveloperSection> = {
  quickstart: {
    title: "Make your first authenticated control-plane request.",
    intro: "Start with the contract that exists today: session-based authentication, tenant-aware operations, verification and audit evidence.",
    sections: [
      { title: "Authenticate", text: "The current control plane establishes a server-managed session. Login returns a CSRF token; state-changing requests send that token in x-csrf-token.", code: "curl http://127.0.0.1:8080/api/v1/auth/login \\\n  -H " + q + "Content-Type: application/json" + q + " \\\n  -d " + q + "{\"email\":\"you@example.com\",\"password\":\"YOUR_PASSWORD\"}" + q },
      { title: "Read the session", text: "Use the authenticated session to discover the current user, organization and CSRF token.", code: "curl http://127.0.0.1:8080/api/v1/session \\\n  -H " + q + "Accept: application/json" + q },
      { title: "Create a tenant", text: "Tenant creation is organization-scoped and requires an authenticated write-capable session.", code: "POST /api/v1/tenants\n\n{\n  " + q + "organization_id" + q + ": " + q + "ORG_UUID" + q + ",\n  " + q + "name" + q + ": " + q + "Acme" + q + ",\n  " + q + "slug" + q + ": " + q + "acme" + q + ",\n  " + q + "isolation_mode" + q + ": " + q + "rls" + q + "\n}" },
      { title: "Record verification", text: "Verification records capture the tenant, scenario, status and evidence that the control plane should retain.", code: "POST /api/v1/verifications\n\n{\n  " + q + "organization_id" + q + ": " + q + "ORG_UUID" + q + ",\n  " + q + "tenant_id" + q + ": " + q + "TENANT_UUID" + q + ",\n  " + q + "kind" + q + ": " + q + "tenant-isolation" + q + ",\n  " + q + "status" + q + ": " + q + "passed" + q + ",\n  " + q + "evidence" + q + ": { " + q + "decision" + q + ": " + q + "ALLOW" + q + " }\n}" },
    ],
  },
  authentication: {
    title: "Identity is separate from tenant scope.",
    intro: "The current public control-plane contract uses server-managed sessions rather than published API keys.",
    sections: [
      { title: "Login", text: "POST /api/v1/auth/login establishes the authenticated session and returns a CSRF token for subsequent state-changing requests." },
      { title: "Session", text: "GET /api/v1/session reports whether the session is authenticated and identifies the current organization context." },
      { title: "CSRF", text: "Send the returned token as x-csrf-token on state-changing operations. Keep the session cookie HttpOnly and never expose credentials in browser bundles." },
      { title: "External API credentials", text: "An API-key/service-account contract is not currently published in this repository. Do not invent a bearer-token integration on top of the session API." },
    ],
  },
  "tenant-context": {
    title: "Carry the tenant decision explicitly.",
    intro: "Tenant context is the security boundary between an authenticated principal and the protected tenant resource.",
    sections: [
      { title: "Define the tenant", text: "Decide which organization or customer identifier represents a tenant in your application before integrating the enforcement boundary." },
      { title: "Do not trust arbitrary scope", text: "A caller must not be able to replace the intended tenant simply by changing a request field. Tenant scope needs an integrity model enforced by the security boundary." },
      { title: "Fail closed", text: "Expired, malformed or otherwise invalid context must produce a block rather than an unscoped fallback." },
    ],
  },
  verification: {
    title: "Test the isolation property, including the dangerous paths.",
    intro: "Verification is where the system demonstrates that same-tenant access is allowed and cross-tenant access is blocked.",
    sections: [
      { title: "Same tenant", text: "The expected positive case is a request whose tenant scope matches the protected resource." },
      { title: "Cross tenant", text: "Deliberately exercise a request where the requested tenant and protected tenant differ. The expected result is BLOCK." },
      { title: "Expired context", text: "An expired or invalid context must not degrade into a successful unscoped request. Treat the failure as part of the security contract." },
      { title: "Evidence", text: "Keep the verification result inspectable so security and operations teams can review what was tested and what happened." },
    ],
  },
  "api-reference": {
    title: "A reference built from the control-plane contract.",
    intro: "These are the currently published control-plane operations. Additional production routes exist but are not yet represented in the OpenAPI contract.",
    sections: [
      { title: "Authentication", text: "POST /api/v1/auth/signup, POST /api/v1/auth/login, POST /api/v1/auth/logout and GET /api/v1/session." },
      { title: "Platform resources", text: "GET/POST /api/v1/organizations, /api/v1/tenants, /api/v1/policies, /api/v1/nodes, /api/v1/deployments and /api/v1/verifications." },
      { title: "Audit and support", text: "GET /api/v1/audit and GET/POST /api/v1/support are organization-scoped control-plane operations." },
      { title: "Billing", text: "GET /api/v1/billing/plans and GET /api/v1/billing/entitlements are published. Checkout, portal and Stripe webhook routes exist but need a stable public contract before being advertised as external API." },
    ],
  },
  webhooks: {
    title: "Document events only when there is a real contract behind them.",
    intro: "The repository contains an internal Stripe webhook endpoint, but it does not yet publish a general customer webhook contract.",
    sections: [
      { title: "Current implementation", text: "The control plane receives POST /api/v1/webhooks/stripe for billing integration. This is an internal platform integration, not yet a general-purpose customer webhook API." },
      { title: "Customer webhook contract", text: "A public event catalog, signing scheme, retry policy and delivery API are not currently published. The developer surface therefore does not pretend they exist." },
      { title: "Required future contract", text: "Event names, payload schemas, signature verification, delivery identifiers, retry semantics, replay behavior and a documented 2xx acknowledgement contract should all be versioned before launch." },
    ],
  },
  sdks: {
    title: "Use the API directly until an official SDK is published.",
    intro: "There is currently no official SDK package in this repository. This page is intentionally explicit rather than presenting fictional package names.",
    sections: [
      { title: "Current status", text: "No Node, Python, Go or Rust SDK package is published by this repository yet." },
      { title: "Recommended integration today", text: "Integrate against the documented control-plane API from a trusted server environment and keep credentials outside browser code.", code: "const response = await fetch(\n  " + q + "https://YOUR-PROXIMA-HOST/api/v1/session" + q + ",\n  { credentials: " + q + "include" + q + " }\n);" },
      { title: "SDK contract", text: "When an official SDK is introduced, it should follow the versioned API contract and ship typed models, retries, pagination and security-safe error handling." },
    ],
  },
  cli: {
    title: "A real CLI needs a real command contract.",
    intro: "The repository does not currently contain or publish an official Proxima CLI binary.",
    sections: [
      { title: "Current status", text: "There is no published CLI package or executable in this repository. The page therefore does not advertise commands that cannot be installed." },
      { title: "Future command model", text: "The eventual CLI should expose inspectable commands for authentication, environments, tenants, policies, verification, evidence and diagnostics, with machine-readable output for CI." },
      { title: "Source of truth", text: "The CLI should consume the same API contract and authentication model as the official SDKs rather than creating a second security model." },
    ],
  },
  terraform: {
    title: "Infrastructure-as-code should be backed by a published provider.",
    intro: "No Terraform provider is currently present in the repository, so this page documents the contract gap instead of inventing a registry package.",
    sections: [
      { title: "Current status", text: "There is no Terraform provider source, registry address or released provider version in this repository." },
      { title: "What the provider should manage", text: "A real provider could eventually manage organizations, tenants, policies, nodes, deployments, environments and verification configuration where the backend exposes stable CRUD semantics." },
      { title: "Safety requirements", text: "The provider should support plan/apply semantics, import, drift detection, secret-safe state handling and explicit destructive-operation behavior before being advertised as production-ready." },
    ],
  },
};

const nav = [
  ["quickstart", "Quickstart"], ["authentication", "Authentication"], ["tenant-context", "Tenant Context"],
  ["verification", "Verification"], ["api-reference", "API Reference"], ["webhooks", "Webhooks"],
  ["sdks", "SDKs"], ["cli", "CLI"], ["terraform", "Terraform"],
] as const;

const repoUrl = "https://github.com/Scarlet-Twinz/Agata-proxima";

export default function DeveloperPortal() {
  const { kind } = useParams();
  const current = sections[kind ?? "quickstart"] ?? sections.quickstart;
  const canonicalKind = sections[kind ?? "quickstart"] ? kind : "quickstart";
  const unavailable = ["sdks", "cli", "terraform"].includes(canonicalKind ?? "");

  return <main className="developer-portal">
    <header className="developer-hero"><div className="developer-hero-inner">
      <span className="public-eyebrow">DEVELOPER PLATFORM</span>
      <h1>{current.title}</h1>
      <p>{current.intro}</p>
      <div className="developer-hero-actions">
        <Link className="button button-primary" to="/developers/quickstart">Start with Quickstart</Link>
        <a className="developer-source-link" href={repoUrl} target="_blank" rel="noreferrer"><Github size={17}/>View source<ExternalLink size={14}/></a>
      </div>
    </div></header>

    <div className="developer-shell public-container">
      <aside className="developer-sidebar" aria-label="Developer documentation">
        <span>BUILD WITH PROXIMA</span>
        {nav.map(([key,label])=><Link className={canonicalKind===key ? "active":""} key={key} to={"/developers/"+key}>{label}</Link>)}
        <div className="developer-sidebar-divider"/>
        <Link to="/docs">Documentation</Link>
        <Link to="/support">Support</Link>
      </aside>

      <article className="developer-content">
        {unavailable && <div className="developer-status"><strong>Implementation status</strong><span>This surface is documented, but the underlying package/provider is not published in the current repository yet.</span></div>}
        {current.sections.map(section=><section className="developer-section" key={section.title}>
          <div className="developer-section-heading"><span>GUIDE</span><h2>{section.title}</h2></div>
          <p>{section.text}</p>
          {section.code && <pre className="developer-code"><code>{section.code}</code></pre>}
        </section>)}

        {canonicalKind==="api-reference" && <section className="developer-section developer-route-table">
          <div className="developer-section-heading"><span>REFERENCE</span><h2>Published routes</h2></div>
          {[
            ["GET","/api/v1/health"],["POST","/api/v1/auth/signup"],["POST","/api/v1/auth/login"],["GET","/api/v1/session"],
            ["GET / POST","/api/v1/organizations"],["GET / POST","/api/v1/tenants"],["GET / POST","/api/v1/policies"],
            ["GET / POST","/api/v1/nodes"],["GET / POST","/api/v1/deployments"],["GET / POST","/api/v1/verifications"],
            ["GET","/api/v1/audit"],["GET / POST","/api/v1/support"],["GET","/api/v1/billing/plans"],["GET","/api/v1/billing/entitlements"],
          ].map(([method,path])=><div className="developer-route" key={method+path}><span>{method}</span><code>{path}</code></div>)}
        </section>}
      </article>
    </div>
  </main>;
}
