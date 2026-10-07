import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight } from "lucide-react";

type Section = { title: string; paragraphs: string[]; bullets?: string[] };

type Topic = {
  eyebrow: string;
  title: string;
  summary: string;
  sections: Section[];
  links: { label: string; href: string }[];
};

const topics: Record<string, Topic> = {
  overview: {
    eyebrow: "CONTROL PLANE",
    title: "Command Center documentation",
    summary: "The Command Center is the authenticated operating surface for organization-scoped configuration, evidence and customer lifecycle management. It is a client of the API, not the runtime tenant-isolation authority.",
    sections: [
      { title: "Authority model", paragraphs: ["The Control Plane manages desired state, customer resources, verification evidence and administrative history. Proxima remains responsible for the runtime database security boundary.", "A Control Plane outage must not disable an already-running Proxima enforcement boundary."] },
      { title: "Operating flow", paragraphs: ["Start with the workspace, create or select a project, establish environments, register an integration, configure tenant context, verify isolation and then promote through the documented deployment path."] },
      { title: "What the dashboard may claim", paragraphs: ["The UI must distinguish API-returned state from conceptual architecture. It must never manufacture tenant counts, verification percentages, node health or security events when the backend has not returned those values."] }
    ],
    links: [{label:"Projects",href:"/app/projects"},{label:"Integrations",href:"/app/integrations"},{label:"Verification",href:"/app/verification"},{label:"Audit",href:"/app/audit"}]
  },
  security: {
    eyebrow:"SECURITY", title:"Security posture documentation", summary:"Security is layered: authenticated control-plane access, signed tenant context, Proxima enforcement and PostgreSQL controls operate together.",
    sections:[
      {title:"Tenant isolation",paragraphs:["Tenant identity is carried into the protected database boundary. Missing, malformed, expired or tampered context is expected to fail closed.","PostgreSQL roles and row-level security provide the database-side isolation layer; privileged database paths must remain controlled."]},
      {title:"Operational evidence",paragraphs:["Security decisions and verification results are recorded as evidence. A dashboard status is not itself proof of a security property."]},
      {title:"Failure model",bullets:["Reject invalid tenant context.","Do not rely on the Control Plane for per-query authorization.","Keep organization-scoped administrative actions auditable.","Treat production acceptance as an external runtime gate."]}
    ],links:[{label:"Tenant isolation",href:"/app/docs/tenant-isolation"},{label:"Verification",href:"/app/verification"},{label:"Audit",href:"/app/audit"}]
  },
  "tenant-isolation": {
    eyebrow:"SECURITY",title:"Tenant isolation documentation",summary:"This is the core Proxima boundary: application identity and tenant context are converted into a protected database session that PostgreSQL can enforce.",
    sections:[
      {title:"Request path",paragraphs:["Customer application → Proxima integration → Proxima Engine → PostgreSQL. The Engine verifies the signed tenant assertion before normal query relay.","For libpq-compatible clients the tenant token can be carried through the PostgreSQL startup options contract documented by the customer integration guide."]},
      {title:"Database boundary",paragraphs:["Proxima binds one accepted client connection to one PostgreSQL session. It does not retarget physical sessions between tenants. PostgreSQL RLS and tenant-specific roles remain part of the final enforcement layer."]},
      {title:"Verification",bullets:["Tenant-local reads and writes must succeed when authorized.","Cross-tenant reads and writes must fail.","Missing, malformed, expired and tampered context must fail.","Prepared statements, transactions and connection reuse must be tested.","Engine restart and Control Plane outage must not silently remove the boundary."]}
    ],links:[{label:"Customer integration guide",href:"/docs/customer-integration"},{label:"Verification",href:"/app/verification"},{label:"Security events",href:"/app/security/events"}]
  },
  tenants: {
    eyebrow:"TENANTS",title:"Tenant registry documentation",summary:"Tenants are project-scoped customer resources. The Control Plane inventories and manages their administrative state; Proxima enforces the runtime boundary.",
    sections:[
      {title:"Tenant ownership",paragraphs:["Every tenant belongs to a project. Tenant inventory is exposed within the authenticated organization scope rather than as a global registry.","Customer authentication and business authorization remain the customer's responsibility. Proxima protects the database boundary after trusted tenant context is established."]},
      {title:"Lifecycle",bullets:["Create the project boundary.","Create environments as required.","Create tenant records in the intended organization/project.","Configure signed tenant context.","Verify positive and negative isolation behavior.","Retain verification and audit evidence."]},
      {title:"Do not confuse inventory with enforcement",paragraphs:["A tenant appearing in the Control Plane does not by itself prove that a deployed application is isolated. Runtime acceptance must exercise the actual customer application and database path."]}
    ],links:[{label:"Projects",href:"/app/projects"},{label:"Verification",href:"/app/verification"},{label:"Customer integration docs",href:"/docs/customer-integration"}]
  },
  policies: {
    eyebrow:"POLICIES",title:"Policy control documentation",summary:"Policies describe intended enforcement behavior and remain organization-scoped, versioned and auditable.",
    sections:[
      {title:"Policy lifecycle",bullets:["Define a policy document.","Assign an explicit version.","Review the intended tenant behavior.","Deploy through the documented promotion path.","Verify expected allows and blocks.","Keep the resulting evidence attributable."]},
      {title:"Runtime authority",paragraphs:["The Control Plane stores desired policy state. Proxima remains the runtime enforcement boundary. Policy UI must not imply that a saved policy has been deployed or enforced until backend state and verification support that claim."]},
      {title:"Change discipline",paragraphs:["Treat policy changes as security-sensitive configuration. Review the impact before production promotion and preserve the evidence needed to explain what changed."]}
    ],links:[{label:"Deployments",href:"/app/deployments"},{label:"Verification",href:"/app/verification"},{label:"Audit",href:"/app/audit"}]
  },
  nodes: {
    eyebrow:"INFRASTRUCTURE",title:"Node inventory documentation",summary:"Nodes represent Proxima enforcement infrastructure registered to an organization and its operating environment.",
    sections:[
      {title:"What a node means",paragraphs:["A node is an enforcement-capable runtime resource. Registration and desired state belong to the Control Plane; actual runtime health must come from the deployed system."]},
      {title:"Deployment relationship",paragraphs:["Deployments target registered nodes with an explicit version and desired state. Observed state must be reported by the runtime before it can be treated as operational evidence."]},
      {title:"Production discipline",bullets:["Register only intended infrastructure.","Keep environment and region metadata accurate.","Use staged promotion.","Verify after deployment.","Do not treat registration as proof of healthy runtime behavior."]}
    ],links:[{label:"Deployments",href:"/app/deployments"},{label:"Security",href:"/app/security"},{label:"Verification",href:"/app/verification"}]
  },
  deployments: {
    eyebrow:"DEPLOYMENTS",title:"Deployment history documentation",summary:"Deployments express desired Proxima runtime state and preserve an auditable relationship between version, node and observed state.",
    sections:[
      {title:"Desired versus observed",paragraphs:["A deployment request records what should happen. Runtime observation records what actually happened. These are deliberately separate so the UI does not convert intent into a false success signal."]},
      {title:"Promotion path",bullets:["Development validation.","Staging validation.","Canary validation.","Production promotion.","Post-deployment verification.","Audit and evidence review."]},
      {title:"Rollback principle",paragraphs:["A production deployment must have a defined recovery path. Automated rollback is an external production gate, while repository-side desired/observed state remains explicit."]}
    ],links:[{label:"Nodes",href:"/app/nodes"},{label:"Verification",href:"/app/verification"},{label:"Audit",href:"/app/audit"}]
  },
  verification: {
    eyebrow:"VERIFICATION",title:"Verification evidence documentation",summary:"Verification is the evidence layer for tenant isolation. A pass is meaningful only when it represents an actual test against the intended boundary.",
    sections:[
      {title:"Minimum acceptance set",bullets:["Valid tenant-local access succeeds.","Cross-tenant reads are rejected.","Cross-tenant writes are rejected.","Missing or malformed context is rejected.","Transactions behave correctly.","Prepared statements behave correctly.","Connection reuse does not cross tenant boundaries.","Evidence is recorded and attributable."]},
      {title:"Evidence states",paragraphs:["Verification results can be running, pass, fail or review. The UI must preserve that distinction rather than turning review or not-run into a green state."]},
      {title:"External acceptance",paragraphs:["The repository contains the acceptance architecture and harness. Production acceptance additionally requires a real customer-like deployment and comparison of application behavior with the recorded evidence."]}
    ],links:[{label:"Tenant isolation",href:"/app/docs/tenant-isolation"},{label:"Audit",href:"/app/audit"},{label:"External SaaS guide",href:"/docs/external-saas-v2"}]
  },
  audit: {
    eyebrow:"AUDIT",title:"Audit evidence documentation",summary:"Audit history records organization-scoped administrative and verification events so security-sensitive changes remain attributable.",
    sections:[
      {title:"Recorded context",bullets:["Action name.","Resource type.","Resource identifier when applicable.","Structured metadata.","Creation timestamp.","Organization scope."]},
      {title:"Why audit exists",paragraphs:["Audit history is not a decorative activity feed. It provides evidence for who changed administrative state and what resource was affected. Verification evidence provides the complementary record of security behavior."]},
      {title:"Operational use",paragraphs:["Use audit history to investigate configuration changes, integration registration, project/environment lifecycle events and verification records. Do not infer runtime security solely from an administrative event."]}
    ],links:[{label:"Verification",href:"/app/verification"},{label:"Security",href:"/app/security"},{label:"Customer lifecycle docs",href:"/docs/customer-integration"}]
  },
  team: {
    eyebrow:"TEAM",title:"Team and access documentation",summary:"Organization membership and role-based access define who can administer a workspace.",
    sections:[
      {title:"Organization scope",paragraphs:["Membership belongs to an organization. Switching organizations creates a session for the selected membership, and all organization-scoped resources are evaluated against the active organization."]},
      {title:"Roles",bullets:["Owner — organization ownership and highest administrative authority.","Admin — organization administration and operational writes permitted by policy.","Operator — operational management within granted permissions.","Viewer — read-oriented access."]},
      {title:"Invitations",paragraphs:["Invitations are organization-scoped, expire after seven days and are accepted only by the signed-in user whose email matches the invitation. Invitation activity is auditable."]}
    ],links:[{label:"Settings",href:"/app/settings"},{label:"Authentication",href:"/app/settings/authentication"},{label:"Security",href:"/app/settings/security"}]
  },
  billing: {
    eyebrow:"BILLING",title:"Billing documentation",summary:"Billing is a server-authoritative entitlement boundary. Phase 3A preserves the existing billing contract; Paystack replacement is the Phase 3B implementation boundary.",
    sections:[
      {title:"What belongs here",bullets:["Current plan.","Entitlement state.","Usage against plan limits.","Checkout and billing-management actions.","Invoice or transaction history once provider-backed data exists."]},
      {title:"Authority",paragraphs:["The browser must never be the source of truth for plan access. Entitlements are evaluated server-side and enforced before gated operations proceed."]},
      {title:"Provider boundary",paragraphs:["The current repository contains the previous billing provider contract. Phase 3B will replace the provider-specific billing implementation with Paystack rather than treating a visual pricing page as a payment system."]},
      {title:"Production rule",paragraphs:["No checkout, invoice or payment state should be presented as successful without a provider response and persisted server state."]}
    ],links:[{label:"Billing usage",href:"/app/docs/billing-usage"},{label:"Billing plans",href:"/app/docs/billing-plans"},{label:"Pricing",href:"/pricing"}]
  },
  developer: {
    eyebrow:"DEVELOPER",title:"Developer platform documentation",summary:"The developer area explains how an existing SaaS connects to Proxima without replacing its application identity or business authorization model.",
    sections:[
      {title:"Integration contract",paragraphs:["Customer application → Agata integration → Proxima Engine → PostgreSQL. The Control Plane manages desired state and evidence; it is not a per-query dependency."]},
      {title:"Integration modes",bullets:["Engine — Proxima is the database enforcement boundary.","SDK — the application uses the integration library to establish trusted context before protected operations.","Proxy — the application connects through a dedicated Proxima database boundary."]},
      {title:"Production acceptance",paragraphs:["Every mode must be exercised with positive and negative tenant tests, transactions, prepared statements, connection reuse, credential rotation, Engine restart and Control Plane outage before production promotion."]}
    ],links:[{label:"Quickstart",href:"/app/developer/quickstart"},{label:"Tenant context",href:"/app/docs/developer-tenant-context"},{label:"API reference",href:"/app/docs/developer-api-reference"},{label:"Public developer docs",href:"/developers"}]
  },
  settings: {
    eyebrow:"SETTINGS",title:"Workspace settings documentation",summary:"Workspace settings are the administrative layer for organization configuration, identity and security controls.",
    sections:[
      {title:"Authentication",paragraphs:["Password authentication uses the versioned control-plane API with CSRF protection for state-changing requests."]},
      {title:"Enterprise identity",paragraphs:["Microsoft Entra OIDC is implemented in the repository but remains a runtime production gate until a real public callback, application registration and tenant acceptance are completed."]},
      {title:"Security",paragraphs:["Security settings must expose real backend state and controls. They must not claim external certification, SSO activation or production readiness without evidence."]}
    ],links:[{label:"Authentication",href:"/app/docs/settings-authentication"},{label:"Enterprise identity",href:"/app/docs/settings-identity"},{label:"Security settings",href:"/app/docs/settings-security"}]
  },
  support: {
    eyebrow:"SUPPORT",title:"Support operations documentation",summary:"Support connects authenticated organizations to documented troubleshooting and support-request workflows.",
    sections:[
      {title:"Self-service first",paragraphs:["Start with the customer integration, troubleshooting and verification documentation. This creates a repeatable diagnostic path before escalation."]},
      {title:"Support requests",paragraphs:["Authenticated support requests are organization-scoped, persisted and auditable. The platform can send a transactional confirmation through Resend when the production email configuration is available."]},
      {title:"Security reports",paragraphs:["Security-sensitive reports should use the responsible disclosure route and should not include secrets or unnecessary customer data."]}
    ],links:[{label:"Documentation",href:"/docs"},{label:"Troubleshooting",href:"/docs/troubleshooting"},{label:"Contact",href:"/contact"}]
  },
  "billing-usage": {
    eyebrow:"BILLING",title:"Usage documentation",summary:"Usage should explain consumption against the active server-side entitlement rather than displaying invented counters.",
    sections:[{title:"Usage categories",bullets:["Tenants.","Nodes.","Environments.","Plan-specific capabilities.","Other metered resources introduced by the billing contract."]},{title:"Truth source",paragraphs:["Usage values must come from organization-scoped backend state. A missing provider or database response is an explicit unavailable/error state, not a fabricated number."]}],links:[{label:"Billing",href:"/app/billing"},{label:"Plans",href:"/app/docs/billing-plans"}]
  },
  "billing-plans": {
    eyebrow:"BILLING",title:"Plan documentation",summary:"Plans define capacity and feature entitlements. Access decisions remain server-authoritative.",
    sections:[{title:"Plan presentation",paragraphs:["The public pricing page explains commercial positioning. The authenticated billing surface explains the active entitlement and what it permits."]},{title:"Entitlement enforcement",bullets:["Capacity limits are enforced before creating gated resources.","Feature flags are evaluated on the server.","Downgrades preserve existing resources while blocking new usage above destination limits."]}],links:[{label:"Billing",href:"/app/billing"},{label:"Public pricing",href:"/pricing"}]
  },
  "billing-invoices": {
    eyebrow:"BILLING",title:"Invoice documentation",summary:"Invoice history must represent provider-backed billing records, not placeholder rows.",
    sections:[{title:"Record integrity",paragraphs:["Each invoice or transaction record should have a provider identifier, amount/currency information, status and timestamps supplied by the billing system."]},{title:"Phase boundary",paragraphs:["Provider-specific invoice delivery is part of the billing provider implementation. Phase 3B will establish the Paystack-backed contract."]}],links:[{label:"Billing",href:"/app/billing"},{label:"Pricing",href:"/pricing"}]
  },
  "developer-api-keys": {
    eyebrow:"DEVELOPER",title:"API key documentation",summary:"Credentials used by integrations must be scoped, protected and never exposed as plaintext after creation.",
    sections:[{title:"Credential rules",bullets:["Generate credentials server-side.","Show secrets only at the intended creation moment.","Store only a secure hash or provider-safe representation.","Support revocation and rotation before production use.","Never put secrets in the frontend bundle."]},{title:"Current phase boundary",paragraphs:["The repository documents the credential model and authentication contract. Production credential lifecycle acceptance remains part of the broader launch gates."]}],links:[{label:"Developer",href:"/app/developer"},{label:"Authentication",href:"/app/docs/settings-authentication"}]
  },
  "developer-tenant-context": {
    eyebrow:"DEVELOPER",title:"Tenant context documentation",summary:"Tenant context is the bridge between customer application identity and the Proxima database boundary.",
    sections:[{title:"Context contract",paragraphs:["The documented signed assertion contains a version, tenant identifier, expiry timestamp and HMAC. For libpq-compatible clients it can be carried through the PostgreSQL startup options parameter."]},{title:"Security requirements",bullets:["Verify the signature before query relay.","Reject missing, duplicate, expired or malformed context.","Do not accept tenant identifiers from an untrusted application field without authenticated binding.","Keep the signing secret outside source control and browser code."]}],links:[{label:"Tenant isolation",href:"/app/docs/tenant-isolation"},{label:"Customer integration guide",href:"/docs/customer-integration"}]
  },
  "developer-webhooks": {
    eyebrow:"DEVELOPER",title:"Webhook documentation",summary:"Webhook endpoints are integration boundaries and must verify authenticity before changing billing or operational state.",
    sections:[{title:"Verification",paragraphs:["A webhook must be authenticated using the provider's signed event mechanism, validated for freshness where applicable and processed idempotently."]},{title:"State changes",paragraphs:["Provider events should update persisted server state and produce an auditable event. The browser must never simulate a successful webhook."]},{title:"Phase boundary",paragraphs:["Paystack webhook implementation belongs to Phase 3B. Until then, this page documents the required contract without claiming live provider delivery."]}],links:[{label:"Developer",href:"/app/developer"},{label:"Billing",href:"/app/billing"}]
  },
  "developer-api-reference": {
    eyebrow:"DEVELOPER",title:"API reference documentation",summary:"Agata exposes a versioned control-plane API under /api/v1 with authentication, CSRF protection and organization-scoped authorization.",
    sections:[{title:"Core resources",bullets:["Organizations and memberships.","Projects and environments.","Integrations.","Tenants and policies.","Nodes and deployments.","Verification and audit evidence.","Billing and support."]},{title:"Contract rules",bullets:["Use documented /api/v1 paths.","Send the session CSRF token on state-changing requests.","Treat non-2xx responses as authoritative failures.","Keep organization and resource identifiers explicit."]}],links:[{label:"OpenAPI contract",href:"/docs/openapi.json"},{label:"Developer guide",href:"/docs/developer-guide"}]
  },
  "settings-authentication": {
    eyebrow:"SETTINGS",title:"Authentication documentation",summary:"Authentication establishes the user session; authorization remains organization-scoped and role-aware.",
    sections:[{title:"Session lifecycle",paragraphs:["Login creates a session and CSRF token. The browser uses the CSRF token for state-changing API calls. Logout invalidates the active session."]},{title:"Password recovery",paragraphs:["Password reset tokens are time-limited and stored as hashes. The recovery flow should never reveal whether an arbitrary address belongs to an account."]}],links:[{label:"Developer authentication",href:"/developers/authentication"},{label:"Settings",href:"/app/settings"}]
  },
  "settings-identity": {
    eyebrow:"SETTINGS",title:"Enterprise identity documentation",summary:"Microsoft Entra OIDC provides enterprise identity integration while the application retains organization membership and authorization semantics.",
    sections:[{title:"OIDC boundary",paragraphs:["The repository validates OIDC state, nonce, issuer, audience, tenant identity, signature and expiry before session creation."]},{title:"Production requirement",paragraphs:["Runtime SSO is not claimed until the real public callback, application registration, credentials and tenant acceptance are completed."]}],links:[{label:"Identity guide",href:"/docs/identity/microsoft-entra-oidc.md"},{label:"Settings",href:"/app/settings"}]
  },
  "settings-security": {
    eyebrow:"SETTINGS",title:"Security settings documentation",summary:"Security settings should expose actual controls and their current state without implying certifications or guarantees.",
    sections:[{title:"Controls",bullets:["Session and authentication controls.","Organization access roles.","Integration credentials.","Tenant isolation verification.","Audit evidence."]},{title:"Trust language",paragraphs:["Claims must be classified as implemented, tested, externally verified, planned or informational. No certification, compliance status or customer deployment should be implied without evidence."]}],links:[{label:"Trust center",href:"/trust"},{label:"Security",href:"/app/security"}]
  }
};

export function ConsoleDocumentation() {
  const { topic = "overview" } = useParams();
  const page = topics[topic] ?? topics.overview;
  return <section className="resource-page">
    <Link className="back-link" to="/app"><ArrowLeft size={16}/> Command Center</Link>
    <div className="page-heading"><div><span className="eyebrow">{page.eyebrow}</span><h1>{page.title}</h1><p>{page.summary}</p></div></div>
    <div className="resource-layout">
      <article className="surface resource-documentation">
        {page.sections.map(section => <section key={section.title} className="documentation-section">
          <h2>{section.title}</h2>
          {section.paragraphs.map(p => <p key={p}>{p}</p>)}
          {section.bullets && <ul>{section.bullets.map(b => <li key={b}>{b}</li>)}</ul>}
        </section>)}
      </article>
      <aside className="surface resource-links"><span className="eyebrow">RELATED</span>{page.links.map(link=><Link key={link.href} to={link.href}>{link.label}<ArrowUpRight size={16}/></Link>)}</aside>
    </div>
  </section>;
}
