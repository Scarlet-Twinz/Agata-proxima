import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight } from "lucide-react";

type Section = { title: string; paragraphs?: string[]; bullets?: string[]; example?: string };

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
    sections:[{title:"Core resources",bullets:["Organizations and memberships.","Projects and environments.","Integrations.","Tenants and policies.","Nodes and deployments.","Verification and audit evidence.","Billing and support."]},{title:"Contract rules",bullets:["Use documented /api/v1 paths.","Send the session CSRF token on state-changing requests.","Treat non-2xx responses as authoritative failures.","Keep organization and resource identifiers explicit."]}],links:[{label:"OpenAPI contract",href:"/docs/api-reference"},{label:"Developer guide",href:"/docs/developer-guide"}]
  },
  "settings-authentication": {
    eyebrow:"SETTINGS",title:"Authentication documentation",summary:"Authentication establishes the user session; authorization remains organization-scoped and role-aware.",
    sections:[{title:"Session lifecycle",paragraphs:["Login creates a session and CSRF token. The browser uses the CSRF token for state-changing API calls. Logout invalidates the active session."]},{title:"Password recovery",paragraphs:["Password reset tokens are time-limited and stored as hashes. The recovery flow should never reveal whether an arbitrary address belongs to an account."]}],links:[{label:"Developer authentication",href:"/developers/authentication"},{label:"Settings",href:"/app/settings"}]
  },
  "settings-identity": {
    eyebrow:"SETTINGS",title:"Enterprise identity documentation",summary:"Microsoft Entra OIDC provides enterprise identity integration while the application retains organization membership and authorization semantics.",
    sections:[{title:"OIDC boundary",paragraphs:["The repository validates OIDC state, nonce, issuer, audience, tenant identity, signature and expiry before session creation."]},{title:"Production requirement",paragraphs:["Runtime SSO is not claimed until the real public callback, application registration, credentials and tenant acceptance are completed."]}],links:[{label:"Identity guide",href:"/docs/identity/microsoft-entra-oidc"},{label:"Settings",href:"/app/settings"}]
  },
  "settings-security": {
    eyebrow:"SETTINGS",title:"Security settings documentation",summary:"Security settings should expose actual controls and their current state without implying certifications or guarantees.",
    sections:[{title:"Controls",bullets:["Session and authentication controls.","Organization access roles.","Integration credentials.","Tenant isolation verification.","Audit evidence."]},{title:"Trust language",paragraphs:["Claims must be classified as implemented, tested, externally verified, planned or informational. No certification, compliance status or customer deployment should be implied without evidence."]}],links:[{label:"Trust center",href:"/trust"},{label:"Security",href:"/app/security"}]
  }
};

const guideSections = (topic: string): Section[] => {
  const common: Record<string, Section[]> = {
    overview: [
      { title:"How to use the Command Center", paragraphs:["Start at the workspace level, then move downward: organization → project → environment → integration → tenant → verification. Each level answers a different operational question. Do not skip directly from a marketing claim to a production assumption."] },
      { title:"What a new customer should do", bullets:["Create or join the organization.","Create the project that represents the customer application.","Confirm Production was created automatically.","Create Development and Staging if required.","Register the integration.","Configure and verify tenant context.","Run the external SaaS acceptance procedure before production promotion."] },
      { title:"Example", example:"Organization: Acme Ltd.\nProject: Acme SaaS\nEnvironment: Staging\nIntegration: Engine / pending\nTenant: acme-customer-001\nVerification: not_run → running → pass\nPromotion: staging → canary → production" }
    ],
    security: [
      { title:"How to read the security pages", paragraphs:["Security is not one feature. It is a chain of controls. When reviewing a security claim, ask: who authenticated, which tenant was established, where was it verified, which database control enforced it, and what evidence proves the behavior?"] },
      { title:"Incident-style questions", bullets:["Can Tenant A read Tenant B?","Can a missing token reach PostgreSQL?","Can an expired token be replayed?","Can an administrator in Organization A inspect Organization B?","Does Control Plane downtime disable the Engine?","Can the UI display a success state without backend evidence?"] },
      { title:"Security review example", example:"Claim: 'Tenant isolation is verified.'\nEvidence required: actual positive + negative runtime tests.\nNot sufficient: a tenant record, a green badge, or a saved policy." }
    ],
    "tenant-isolation":[
      { title:"What happens on a request", paragraphs:["The application authenticates the user and resolves the customer's tenant. A signed tenant assertion is then carried into the protected connection. Proxima validates that assertion before the ordinary query stream is allowed to proceed. PostgreSQL controls remain part of the defense-in-depth model."] },
      { title:"Failure cases", bullets:["Missing assertion → reject.","Malformed assertion → reject.","Expired assertion → reject.","Tampered assertion → reject.","Tenant A attempting Tenant B data → reject.","Control Plane unavailable while Engine is running → runtime enforcement continues."] },
      { title:"Minimal acceptance example", example:"A: SELECT own rows       => allowed\nA: SELECT B rows          => denied\nA: UPDATE B rows          => denied\nNo tenant context         => denied\nExpired context           => denied" }
    ],
    tenants:[
      { title:"Why tenant records exist", paragraphs:["The tenant registry is an administrative inventory. It lets operators identify which customer boundaries belong to which project and organization. It does not magically make an application's database queries safe."] },
      { title:"Creating a tenant correctly", bullets:["Select the organization.","Select the project explicitly when multiple projects exist.","Give the tenant a stable business identifier.","Configure the application's authenticated tenant resolution.","Create and verify the signed tenant context.","Exercise the real database path."] },
      { title:"Common mistake", paragraphs:["Do not create a tenant record and immediately treat it as proof of isolation. The record describes intent and inventory; verification describes observed security behavior."] }
    ],
    policies:[
      { title:"Policy lifecycle in practice", paragraphs:["A policy starts as desired state. Operators review it, deploy it through the intended environment, then verify the behavior. The important distinction is between 'saved' and 'enforced'."] },
      { title:"Review checklist", bullets:["Is the policy organization-scoped?","Which project/environment does it affect?","Which version is intended?","What should be allowed?","What should be denied?","Has the deployed runtime been verified?","Is the change auditable?"] },
      { title:"Example", example:"Policy v7\nIntent: Tenant A may access only A rows\nDeployment: staging\nVerification: cross-tenant read denied\nPromotion: approved after evidence review" }
    ],
    nodes:[
      { title:"Node versus environment", paragraphs:["An environment describes lifecycle context. A node describes enforcement infrastructure. A node may belong to an environment, but registering it does not prove that the underlying process is healthy."] },
      { title:"Operational review", bullets:["Confirm node identity.","Confirm environment and region.","Confirm desired version.","Inspect observed runtime state.","Verify after deployment.","Record failure instead of displaying an optimistic success state."] },
      { title:"Example", example:"Environment: Production\nNode: prod-ng-01\nDesired version: 3.x\nObserved state: healthy\nLast verification: pass" }
    ],
    deployments:[
      { title:"Deployment means intent plus observation", paragraphs:["A deployment record answers what version should run and where. Runtime telemetry answers what actually happened. Keeping those concepts separate prevents the dashboard from calling a requested deployment successful before the runtime confirms it."] },
      { title:"Safe promotion", bullets:["Validate in Development.","Verify in Staging.","Run canary checks.","Promote Production.","Run post-deployment verification.","Keep rollback evidence available."] },
      { title:"Example", example:"Requested: v1.8 → staging\nObserved: v1.8 healthy\nVerification: pass\nPromotion: production approved" }
    ],
    verification:[
      { title:"Verification is evidence, not decoration", paragraphs:["A verification result should correspond to an actual test. The result must identify what was tested, which boundary was tested and whether the expected allow/deny behavior occurred."] },
      { title:"Required test matrix", bullets:["Positive tenant-local read.","Positive tenant-local write.","Negative cross-tenant read.","Negative cross-tenant write.","Missing context.","Expired context.","Tampered context.","Prepared statements.","Transactions.","Connection reuse.","Engine restart.","Control Plane outage."] },
      { title:"Example result", example:"Tenant A local read: PASS\nTenant A → Tenant B read: PASS (correctly denied)\nExpired token: PASS (correctly denied)\nControl Plane outage: PASS (Engine remained enforcing)" }
    ],
    audit:[
      { title:"How to use audit history", paragraphs:["Audit is an investigation tool. Start with the time range, identify the organization and actor, then inspect the resource and action. For security incidents, correlate administrative changes with verification evidence rather than treating either feed as complete on its own."] },
      { title:"Events worth investigating", bullets:["Project creation.","Environment creation.","Integration registration.","Policy changes.","Deployment actions.","Verification runs.","Team membership changes.","Security-sensitive configuration changes."] },
      { title:"Example investigation", example:"09:12  admin   integration.created   project=Acme\n09:18  operator verification.started  environment=staging\n09:21  system   verification.pass     tenant-isolation\n09:30  admin   promotion.approved      production" }
    ],
    team:[
      { title:"Organization membership", paragraphs:["An organization is the administrative boundary. Members receive roles within that organization. Switching organizations should change the active authorization context; it must never grant access to resources belonging to another organization."] },
      { title:"When you would create another organization", paragraphs:["Create a second organization only when you are operating a genuinely separate customer or business boundary. Do not create one simply to make another project. Projects belong inside an organization."] },
      { title:"Example", example:"Organization A: Acme Ltd\n  Project: Customer Portal\nOrganization B: Beta Ltd\n  Project: Beta Analytics\n\nA member of A should not automatically see B's projects." }
    ],
    billing:[
      { title:"Billing is a system, not a page", paragraphs:["Billing connects commercial plans, provider transactions, server-side entitlements and resource limits. A serious billing area therefore needs separate views for the current plan, usage, transactions/invoices and provider actions."] },
      { title:"What changes in Phase 3B", bullets:["Paystack customer/payment identity.","Plan and price mapping.","Checkout initialization.","Verified webhook processing.","Transaction persistence.","Entitlement activation/deactivation.","Usage enforcement.","Payment failure handling.","Billing audit events."] },
      { title:"Example", example:"Customer chooses Pro\n→ Paystack checkout\n→ Paystack confirms transaction\n→ webhook verified\n→ transaction persisted\n→ entitlement activated\n→ protected feature becomes available" }
    ],
    developer:[
      { title:"The developer journey", paragraphs:["A developer should not have to guess which page comes next. Start with the quickstart, understand the integration mode, establish tenant context, create the required credentials, connect PostgreSQL through the selected boundary, then run the verification matrix."] },
      { title:"Do not confuse API credentials with tenant identity", paragraphs:["An API credential identifies an integration or machine. Tenant context identifies the customer boundary for a protected operation. One does not replace the other."] },
      { title:"Example", example:"API credential → 'this integration may call Proxima'\nTenant assertion → 'this operation is for tenant acme-001'\nProxima → validates context\nPostgreSQL → enforces protected access" }
    ],
    settings:[
      { title:"Authentication versus identity", paragraphs:["Authentication establishes the session. Enterprise identity such as Microsoft Entra can establish that a user came from an approved identity provider. Authorization still depends on organization membership and role."] },
      { title:"Security settings", bullets:["Review session security.","Review organization roles.","Review integration credentials.","Review tenant-isolation verification.","Review audit evidence.","Never interpret a setting as a certification claim."] },
      { title:"Production identity example", example:"Entra application registration\n→ public callback\n→ OIDC validation\n→ Agata session\n→ organization membership\n→ role authorization" }
    ],
    support:[
      { title:"Support workflow", bullets:["Identify the organization and project.","Identify the environment.","Record the exact failing action.","Check the relevant documentation.","Check verification/audit evidence.","Create a support request with the request ID and safe diagnostic context.","Never paste API keys or passwords into support."] },
      { title:"What a useful support report contains", paragraphs:["A useful report tells the support team what you expected, what happened, where it happened, when it happened, which environment was involved and what evidence you already checked."] },
      { title:"Example", example:"Organization: Acme\nProject: Customer Portal\nEnvironment: staging\nExpected: Tenant A query succeeds\nObserved: 403\nStarted: 2026-10-07 10:20 UTC\nVerification run: #1234" }
    ]
  };
  return common[topic] ?? [];
};

export function ConsoleDocumentation() {
  const { topic = "overview" } = useParams();
  const page = topics[topic] ?? topics.overview;\n  const sections = [...page.sections, ...guideSections(topic)];
  return <section className="resource-page">
    <Link className="back-link" to="/app"><ArrowLeft size={16}/> Command Center</Link>
    <div className="page-heading"><div><span className="eyebrow">{page.eyebrow}</span><h1>{page.title}</h1><p>{page.summary}</p></div></div>
    <div className="resource-layout">
      <article className="surface resource-documentation">
        {sections.map(section => <section key={section.title} className="documentation-section">
          <h2>{section.title}</h2>
          {section.paragraphs?.map(p => <p key={p}>{p}</p>)}
          {section.bullets && <ul>{section.bullets.map(b => <li key={b}>{b}</li>)}</ul>}{section.example && <pre className="documentation-example"><code>{section.example}</code></pre>}
        </section>)}
      </article>
      <aside className="surface resource-links"><span className="eyebrow">RELATED</span>{page.links.map(link=><Link key={link.href} to={link.href}>{link.label}<ArrowUpRight size={16}/></Link>)}</aside>
    </div>
  </section>;
}
