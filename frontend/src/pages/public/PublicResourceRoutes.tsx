import { Navigate, useParams } from "react-router-dom";
import { PublicResourcePage, type ResourceSection } from "./PublicResourcePage";

type Resource = {
  eyebrow: string;
  title: string;
  description: string;
  sections: ResourceSection[];
  related?: Array<{ label: string; to: string }>;
};

const resources: Record<string, Resource> = {
  "docs/getting-started": {
    eyebrow: "Documentation / Getting started",
    title: "Connect a development application to Proxima.",
    description: "A practical first path from workspace creation to a verified tenant-isolation decision.",
    sections: [
      { title: "Create the workspace", body: "A workspace is the organizational boundary for Proxima configuration. Create it with an owner identity, then use the control plane to manage tenants, policies, infrastructure and team access." },
      { title: "Understand the request path", body: "The intended request path is application identity plus tenant context, followed by the Proxima enforcement boundary, followed by protected PostgreSQL access. The important property is that the tenant decision is made before the protected operation is allowed." },
      { title: "Define tenant context", body: "Your application must provide an unambiguous tenant identity for every protected operation. The boundary should reject missing, invalid, expired or cross-tenant context rather than guessing which tenant the request belongs to." },
      { title: "Run the first verification", body: "Create an expected allow case for the correct tenant and an expected block case for a cross-tenant attempt. Verification should produce an outcome that can be inspected later as evidence.", code: `Application → tenant A → Proxima → PostgreSQL → ALLOW\nApplication → tenant A → Proxima → tenant B data → BLOCK` },
      { title: "Move toward production", body: "Before production, connect your real environments, establish team roles, configure policies, verify the database boundary, and confirm that the control plane and enforcement engine behave independently when management services are unavailable." },
    ],
    related: [{label:"Core concepts",to:"/docs/core-concepts"},{label:"Developer quickstart",to:"/developers/quickstart"},{label:"API reference",to:"/docs/api-reference"}],
  },
  "docs/core-concepts": {
    eyebrow: "Documentation / Core concepts",
    title: "The objects that make the security model operational.",
    description: "Understand the vocabulary before configuring a production boundary.",
    sections: [
      { title: "Organization", body: "An organization is the primary customer boundary. Membership, roles, billing and workspace-level controls belong to the organization." },
      { title: "Project and tenant", body: "Projects group application environments and configuration. Tenants represent the customer or isolation domains whose data must remain separated." },
      { title: "Policy", body: "A policy describes the rules that determine how protected operations should be evaluated. Policies are versioned so an operational decision can be tied back to a known configuration." },
      { title: "Node and deployment", body: "Nodes represent enforcement infrastructure. Deployments describe desired and observed versions or states so operators can see what is intended and what is actually running." },
      { title: "Verification and evidence", body: "Verification exercises expected behavior. Evidence captures the result so isolation is something a team can inspect rather than a statement it has to trust." },
      { title: "Audit", body: "Audit events provide an operational trail for security-sensitive actions such as organization changes, policy changes, deployment operations and verification records." },
    ],
    related: [{label:"Security model",to:"/docs/security"},{label:"Operations",to:"/docs/operations"},{label:"FAQ",to:"/faq"}],
  },
  "docs/api-reference": {
    eyebrow: "Documentation / API reference",
    title: "The control-plane API, organized around real operations.",
    description: "Use this surface to understand authentication, request contracts, resource groups and failure behavior before integrating.",
    sections: [
      { title: "Authentication", body: "Password authentication creates an HttpOnly session cookie and a CSRF token. Browser requests use credentials so the server can identify the current organization and role." },
      { title: "Organizations and tenants", body: "Authenticated callers can inspect organization context and manage tenant resources within the current organization. Cross-organization identifiers are rejected by the control plane." },
      { title: "Policies", body: "Policy operations create and inspect versioned policy documents. Write operations require an authenticated role with the appropriate permission and a valid CSRF token." },
      { title: "Infrastructure", body: "Node, deployment and enrollment operations expose the lifecycle of enforcement infrastructure. The control plane records desired state while Proxima remains the enforcement authority." },
      { title: "Verification and audit", body: "Verification results and audit events provide the evidence layer used to inspect security behavior and operational changes." },
      { title: "Errors", body: "Clients should treat 401 as an authentication failure, 403 as an authorization or CSRF failure, 404 as a missing resource and 409 as an identity/conflict condition. Do not interpret an API error as permission to fall back to an unprotected path." },
    ],
    related: [{label:"Developer API reference",to:"/developers/api-reference"},{label:"Authentication",to:"/developers/authentication"},{label:"Security",to:"/docs/security"}],
  },
  "docs/security": {
    eyebrow: "Documentation / Security",
    title: "How Proxima treats tenant isolation as an infrastructure boundary.",
    description: "The security model is built around explicit context, enforcement, database controls and independent verification.",
    sections: [
      { title: "Identity is not tenant authorization", body: "Knowing who signed in is not enough. A protected operation also needs an explicit tenant context that can be evaluated against the operation and the data it is trying to reach." },
      { title: "The boundary makes a decision", body: "Proxima sits between application identity and protected database access. The intended result is deterministic: correct tenant context is allowed; cross-tenant or invalid context is blocked." },
      { title: "Database controls remain important", body: "PostgreSQL roles and row-level security are complementary controls. Proxima does not require teams to abandon their database security model." },
      { title: "Verification is part of the security model", body: "Security properties that can be tested should be tested. Verification creates a repeatable way to exercise expected allow/block behavior and preserve the result." },
      { title: "Control plane and enforcement are distinct", body: "The control plane manages configuration and operations. The enforcement engine remains the data-plane authority so management-plane availability does not become an accidental security bypass." },
    ],
    related: [{label:"Verification",to:"/developers/verification"},{label:"Trust",to:"/trust"},{label:"Security page",to:"/security"}],
  },
  "docs/operations": {
    eyebrow: "Documentation / Operations",
    title: "Operate the boundary after the architecture diagram is finished.",
    description: "Production security needs deployment state, verification, audit and environment visibility—not only configuration screens.",
    sections: [
      { title: "Environments", body: "Keep development, staging and production concerns explicit. Environment configuration should describe where enforcement infrastructure runs and which resources belong to it." },
      { title: "Nodes", body: "Nodes represent enforcement infrastructure and expose lifecycle state such as pending, enrolling and healthy. Enrollment credentials should be treated as secrets and stored only where operators can protect them." },
      { title: "Deployments", body: "A deployment has desired state and observed state. Operators need both to distinguish what was requested from what the fleet has actually applied." },
      { title: "Verification runs", body: "Verification should be run after meaningful infrastructure or policy changes. The result becomes part of the operational record instead of disappearing into a manual test session." },
      { title: "Audit evidence", body: "Audit records should make it possible to answer who changed what, when it happened, which resource was affected and what security-sensitive outcome followed." },
    ],
    related: [{label:"Control plane",to:"/product"},{label:"Changelog",to:"/changelog"},{label:"Status",to:"/status"}],
  },
  "docs/troubleshooting": {
    eyebrow: "Documentation / Troubleshooting",
    title: "Diagnose the common failure paths without guessing.",
    description: "Start from the observed behavior, identify the boundary involved and inspect the corresponding evidence.",
    sections: [
      { title: "Cannot sign in", body: "Confirm the control plane is reachable, the email is registered and the password is correct. A 401 means credentials were rejected; do not expect the dashboard to open without a valid session." },
      { title: "Dashboard redirects to login", body: "The console is protected by the authenticated session endpoint. If the session cookie is missing, expired or invalid, the application must return to the login boundary." },
      { title: "Tenant operation is blocked", body: "Inspect tenant context first, then policy state, then the verification/audit record. A cross-tenant or invalid context should remain blocked by design." },
      { title: "Write request returns 403", body: "Check both the authenticated role and CSRF token. Browser writes must send the CSRF token associated with the current session." },
      { title: "Verification fails", body: "Compare the expected decision with the actual tenant context, policy version, node state and database controls. Verification failure is evidence to investigate, not a reason to weaken the boundary." },
    ],
    related: [{label:"FAQ",to:"/faq"},{label:"Support",to:"/support"},{label:"Contact",to:"/contact"}],
  },
  "developers/quickstart": {
    eyebrow: "Developer platform / Quickstart",
    title: "Build your first protected Proxima request.",
    description: "The quickstart explains the integration path rather than hiding it behind a generic SDK button.",
    sections: [
      { title: "1. Establish application identity", body: "Your application authenticates the caller using the mechanism appropriate to your product. That identity is the starting point, not the final tenant authorization decision." },
      { title: "2. Attach tenant context", body: "Resolve the tenant that the request is authorized to operate on and carry that context into the protected request path." },
      { title: "3. Cross the Proxima boundary", body: "Send the protected operation through the Proxima enforcement path. The boundary evaluates identity, tenant context and policy before the database operation is allowed." },
      { title: "4. Reach PostgreSQL", body: "Only an allowed operation should reach the protected data layer. PostgreSQL roles and RLS can provide a second layer of enforcement." },
      { title: "5. Verify", body: "Test a same-tenant allow path and a cross-tenant block path. Keep the verification result as evidence.", code: `Tenant A → Tenant A data = ALLOW\nTenant A → Tenant B data = BLOCK\nExpired context → BLOCK` },
    ],
    related: [{label:"Tenant context",to:"/developers/tenant-context"},{label:"Verification",to:"/developers/verification"},{label:"API reference",to:"/developers/api-reference"}],
  },
  "developers/authentication": {
    eyebrow: "Developer platform / Authentication",
    title: "Authentication establishes identity; Proxima still evaluates tenant context.",
    description: "Understand the session boundary, API credentials and enterprise identity surfaces.",
    sections: [
      { title: "Browser sessions", body: "The control plane creates a server-side session and returns an HttpOnly cookie. The browser does not need access to the session secret." },
      { title: "CSRF protection", body: "State-changing browser requests use the CSRF token associated with the current session. The frontend keeps the token in session storage and sends it on protected writes." },
      { title: "Service identities", body: "Machine-to-machine integrations should use dedicated credentials rather than sharing a human password. Keep secrets on the server side and rotate them as part of normal operations." },
      { title: "Enterprise identity", body: "OIDC-based enterprise identity belongs in the organization's identity configuration surface. It should not be treated as a decorative login button." },
    ],
    related: [{label:"Tenant context",to:"/developers/tenant-context"},{label:"Enterprise identity",to:"/app/settings/identity"},{label:"Security",to:"/docs/security"}],
  },
  "developers/tenant-context": {
    eyebrow: "Developer platform / Tenant context",
    title: "Make the tenant decision explicit on every protected path.",
    description: "Tenant context is the information that connects an authenticated request to the exact isolation domain it is allowed to touch.",
    sections: [
      { title: "Resolve the tenant", body: "Determine the tenant from trusted application state and authorization rules. Do not accept a client-controlled tenant identifier as sufficient authorization on its own." },
      { title: "Carry context through the request", body: "The tenant identity must survive the path from application code into the Proxima enforcement boundary without being silently replaced by a broader identity." },
      { title: "Evaluate the requested resource", body: "The enforcement decision must compare the request's tenant context with the tenant boundary of the protected resource." },
      { title: "Reject ambiguity", body: "Missing, malformed, expired or mismatched context should fail closed. Ambiguity is a security condition, not a convenience case." },
    ],
    related: [{label:"Security model",to:"/docs/security"},{label:"Quickstart",to:"/developers/quickstart"},{label:"Verification",to:"/developers/verification"}],
  },
  "developers/verification": {
    eyebrow: "Developer platform / Verification",
    title: "Turn tenant isolation into something your team can test.",
    description: "Verification is where the expected security property becomes an executable check and an inspectable result.",
    sections: [
      { title: "Allow tests", body: "Exercise legitimate same-tenant operations and verify that the expected path remains available." },
      { title: "Block tests", body: "Exercise cross-tenant operations, invalid contexts and expired contexts. These cases should be denied." },
      { title: "Evidence", body: "Capture the decision, tenant context, policy/version and relevant infrastructure information so a reviewer can understand what happened." },
      { title: "Regression", body: "Run verification after changes to policies, database controls, deployments or application integration. A security boundary should not depend on a one-time manual check." },
    ],
    related: [{label:"Operations",to:"/docs/operations"},{label:"Audit",to:"/app/audit"},{label:"FAQ",to:"/faq"}],
  },
  "developers/api-reference": {
    eyebrow: "Developer platform / API reference",
    title: "Explore the operations your integration actually calls.",
    description: "The API surface is organized around authentication, organizations, tenants, policies, infrastructure, verification and audit.",
    sections: [
      { title: "Authentication endpoints", body: "Sign up, sign in, sign out and session inspection are exposed under the versioned authentication API. Sessions use secure server-side state and HttpOnly cookies." },
      { title: "Resource operations", body: "Organizations, tenants, policies, nodes, deployments and verification results have explicit resource boundaries. Requests are evaluated against the current authenticated organization." },
      { title: "Protected writes", body: "Browser write operations require both a valid authenticated session and the session's CSRF token. Role checks apply before mutation." },
      { title: "Operational reads", body: "Dashboard surfaces consume organization-scoped data for platform status, nodes, deployments, verification and audit evidence." },
    ],
    related: [{label:"Docs API reference",to:"/docs/api-reference"},{label:"Authentication",to:"/developers/authentication"},{label:"Webhooks",to:"/developers/webhooks"}],
  },
  "developers/webhooks": {
    eyebrow: "Developer platform / Webhooks and events",
    title: "Connect Agata events to the rest of your infrastructure.",
    description: "Lifecycle and security events should feed the systems where your team already investigates and responds.",
    sections: [
      { title: "Event categories", body: "Useful event families include authentication, organization changes, policy changes, deployments, verification outcomes, security signals and billing state changes." },
      { title: "Delivery", body: "Webhook delivery should be authenticated, retryable and observable. Consumers should treat events as at-least-once delivery and make handlers idempotent." },
      { title: "Security events", body: "Security-sensitive events should carry enough context to identify the affected organization, resource and decision without exposing secrets." },
      { title: "Operational response", body: "Connect events to incident response, observability, ticketing or internal automation so the audit trail is actionable rather than merely stored." },
    ],
    related: [{label:"API reference",to:"/developers/api-reference"},{label:"Audit",to:"/app/audit"},{label:"Security",to:"/security"}],
  },
  "solutions/b2b-saas": {
    eyebrow: "Solutions / B2B SaaS",
    title: "Keep customer organizations separated as your SaaS grows.",
    description: "B2B SaaS turns tenant isolation into a repeated architectural concern. Proxima makes the boundary explicit.",
    sections: [
      { title: "The problem", body: "As customer count grows, tenant checks appear across routes, services, background jobs and data access paths. A missed check can become a cross-customer data exposure." },
      { title: "Where Proxima fits", body: "Proxima provides a dedicated enforcement boundary between application identity and protected PostgreSQL access, so tenant isolation is not solely dependent on every application developer remembering every check." },
      { title: "What teams gain", body: "A common model for tenant context, verification and audit evidence makes reviews and incident investigation easier." },
    ],
    related: [{label:"Quickstart",to:"/developers/quickstart"},{label:"Security",to:"/security"},{label:"Pricing",to:"/pricing"}],
  },
  "solutions/enterprise-saas": {
    eyebrow: "Solutions / Enterprise SaaS",
    title: "Give security and engineering teams a boundary they can inspect.",
    description: "Enterprise workloads need operational evidence, team controls and a clear relationship between identity and protected data.",
    sections: [
      { title: "Operational visibility", body: "The control plane exposes tenants, policies, nodes, deployments, verification and audit surfaces so security decisions are not buried inside application code." },
      { title: "Identity", body: "Enterprise identity can be configured alongside organization membership and role controls." },
      { title: "Evidence", body: "Verification and audit evidence give security teams a concrete trail for reviewing isolation behavior and changes." },
    ],
    related: [{label:"Enterprise identity",to:"/developers/authentication"},{label:"Trust",to:"/trust"},{label:"Contact",to:"/contact"}],
  },
  "solutions/developer-platforms": {
    eyebrow: "Solutions / Developer platforms",
    title: "Keep tenant context attached to the request path.",
    description: "Developer platforms often become the infrastructure layer for many customer applications, making consistent tenant handling especially important.",
    sections: [
      { title: "Centralize the boundary", body: "A shared enforcement model avoids rebuilding tenant isolation independently inside every service or product surface." },
      { title: "Expose the contract", body: "Developers get a clear integration path, API reference and verification model instead of a security requirement that exists only in architecture documents." },
      { title: "Operate at scale", body: "Nodes, deployments, policies and verification belong in a control plane where platform teams can manage them consistently." },
    ],
    related: [{label:"Developer platform",to:"/developers"},{label:"Operations",to:"/docs/operations"},{label:"API reference",to:"/developers/api-reference"}],
  },
  "solutions/security-sensitive-systems": {
    eyebrow: "Solutions / Security-sensitive systems",
    title: "Make unauthorized cross-tenant access a deliberate failure.",
    description: "When the cost of a tenant boundary failure is high, security behavior should be explicit, testable and reviewable.",
    sections: [
      { title: "Fail closed", body: "Invalid, missing, expired or cross-tenant context should not silently degrade into broad access." },
      { title: "Verify continuously", body: "Use repeatable allow/block verification after security-sensitive changes instead of relying only on code review." },
      { title: "Preserve evidence", body: "Security events and verification outcomes should provide the evidence needed for investigation and operational review." },
    ],
    related: [{label:"Security documentation",to:"/docs/security"},{label:"Verification",to:"/developers/verification"},{label:"Trust",to:"/trust"}],
  },
  "solutions/startups": {
    eyebrow: "Solutions / Growing startups",
    title: "Establish the isolation model before it becomes expensive to retrofit.",
    description: "A smaller team can still build a strong tenant boundary without creating a sprawling internal security platform.",
    sections: [
      { title: "Start with the boundary", body: "Define where identity becomes tenant authorization and where protected data access is allowed." },
      { title: "Avoid duplicated controls", body: "Use a shared model for tenant context, verification and evidence instead of adding one-off checks to every service." },
      { title: "Grow without losing the model", body: "As tenants, services and environments increase, the same control-plane concepts remain visible and operational." },
    ],
    related: [{label:"Pricing",to:"/pricing"},{label:"Getting started",to:"/docs/getting-started"},{label:"Contact",to:"/contact"}],
  },
  "solutions/platform-engineering": {
    eyebrow: "Solutions / Platform engineering",
    title: "Give platform teams a repeatable tenant-isolation operating model.",
    description: "Centralize enforcement, fleet operations and verification while leaving product teams focused on their application.",
    sections: [
      { title: "Standardize", body: "Give teams a consistent boundary for tenant context, policy and protected database access." },
      { title: "Operate", body: "Use nodes, deployments and environments to manage the enforcement fleet rather than tracking state manually." },
      { title: "Prove", body: "Make verification and audit evidence part of the normal platform workflow." },
    ],
    related: [{label:"Operations",to:"/docs/operations"},{label:"Developer platform",to:"/developers"},{label:"Product",to:"/product"}],
  },
  "changelog/frontend-reconstruction": {
    eyebrow: "Changelog / October 2026",
    title: "Frontend reconstruction",
    description: "The public and authenticated product experience moved to a real React application architecture.",
    sections: [
      { title: "What changed", body: "The public experience now uses React Router, dedicated page components and a shared Agata design system. Public product, solution, developer, documentation, company, trust and legal surfaces are routed through the same application." },
      { title: "Why it changed", body: "The previous experience was too static for a product that needs real navigation, documentation and operational surfaces. The reconstruction creates explicit routes instead of presenting labels that do not lead anywhere." },
      { title: "Authentication", body: "The frontend now connects to the existing Rust control-plane authentication endpoints for signup, login, session inspection and logout. The application console is intended to be inaccessible without a valid session." },
      { title: "Documentation", body: "Documentation, developer guides, solution pages and changelog entries now have dedicated destinations with detailed content and related navigation." },
      { title: "Visual correction", body: "The homepage typography and spacing are kept intentionally tighter so the hero reads as a product landing page rather than appearing zoomed into the viewport." },
    ],
    related: [{label:"Previous foundation",to:"/changelog/control-plane-foundation"},{label:"Documentation",to:"/docs"},{label:"Developer platform",to:"/developers"}],
  },
  "changelog/control-plane-foundation": {
    eyebrow: "Changelog / Earlier",
    title: "Control plane foundation",
    description: "The Rust control plane established the backend security and operational foundation used by the new frontend.",
    sections: [
      { title: "Authentication and sessions", body: "The control plane provides password-based signup and login, server-side sessions, HttpOnly cookies, CSRF tokens and logout." },
      { title: "Organization model", body: "Users belong to organizations through memberships with roles. Signup creates an organization, owner membership, a production project and initial entitlement state." },
      { title: "Operational resources", body: "The control plane exposes organizations, tenants, policies, nodes, deployments, verification results, audit events and support requests." },
      { title: "Production foundations", body: "The backend also contains billing, entitlements, Stripe webhook and checkout surfaces, invitation workflows and enterprise identity scaffolding." },
      { title: "Security authority", body: "The architecture keeps the Proxima enforcement engine as the data-plane authority while the control plane manages configuration and operations." },
    ],
    related: [{label:"Current frontend reconstruction",to:"/changelog/frontend-reconstruction"},{label:"Security",to:"/security"},{label:"Product",to:"/product"}],
  },
};

export function PublicResourceRoute() {
  const { "*": resourcePath } = useParams();
  const resource = resourcePath ? resources[resourcePath] : undefined;
  if (!resource) return <Navigate to="/docs" replace />;
  return <PublicResourcePage {...resource} />;
}
