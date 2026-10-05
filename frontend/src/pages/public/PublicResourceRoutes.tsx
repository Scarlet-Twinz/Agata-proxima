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
    title: "From a new workspace to your first verified tenant boundary.",
    description: "A practical path for engineers who want to understand what Proxima does before putting it in front of production data.",
    sections: [
      { title: "What you are building", body: "The starting point is not a dashboard configuration. It is a request path. An application identifies a caller, establishes the tenant that caller is allowed to operate on, crosses the Proxima enforcement boundary, and only then reaches protected PostgreSQL data. The goal is to make that sequence explicit and testable." },
      { title: "Create the workspace", body: "A workspace is the operating home for an organization. It is where team membership, tenant configuration, policies, environments, infrastructure, verification and audit evidence come together. Create the workspace first, then invite the people who need access to operate it." },
      { title: "Model your tenants", body: "Decide what a tenant means in your application before integrating. It may represent a customer organization, account, workspace, project or another isolation domain. The important property is that every protected operation can resolve exactly one intended tenant." },
      { title: "Connect the request path", body: "Your application supplies authenticated identity and trusted tenant context. Proxima evaluates that context before protected data access. PostgreSQL remains the data layer and can continue to use roles and row-level security as complementary controls.", code: "Application\n    ↓\nIdentity + tenant context\n    ↓\nProxima enforcement\n    ↓\nPostgreSQL roles / RLS\n    ↓\nProtected data" },
      { title: "Run an allow case", body: "Start with a legitimate operation. Tenant A acting on Tenant A data should be allowed when identity, context and policy are valid. The purpose of the first test is to establish the normal path before testing failure behavior." },
      { title: "Run a block case", body: "Next, deliberately cross the boundary. Tenant A attempting to operate on Tenant B data should be rejected. Missing, malformed or expired tenant context should also fail closed rather than becoming a broader database identity.", code: "Tenant A → Tenant A = ALLOW\nTenant A → Tenant B = BLOCK\nExpired context → BLOCK\nMissing context → BLOCK" },
      { title: "Keep the result", body: "A verification result is more useful when it can be inspected after the test. Preserve the decision, the relevant tenant context, policy or version information and infrastructure information required to explain what happened." },
      { title: "Before production", body: "Do not move directly from a successful development request to production. Establish environments, team roles, policy ownership, deployment visibility, verification runs and audit review. Production readiness is the point where the security model becomes an operating process." },
    ],
    related: [
      { label: "Core concepts", to: "/docs/core-concepts" },
      { label: "Security model", to: "/docs/security" },
      { label: "Developer quickstart", to: "/developers/quickstart" },
      { label: "Verification", to: "/developers/verification" },
    ],
  },

  "docs/core-concepts": {
    eyebrow: "Documentation / Core concepts",
    title: "The objects behind the Proxima operating model.",
    description: "Understand the vocabulary before you configure a production tenant boundary.",
    sections: [
      { title: "Organization", body: "An organization is the customer-level administrative boundary. Membership, roles, billing and organization-wide controls belong here. A person can be a member of an organization without automatically being authorized to operate on every tenant." },
      { title: "Project", body: "A project groups application and infrastructure concerns inside an organization. Projects give teams a place to separate workloads and environments while keeping ownership and operational context clear." },
      { title: "Tenant", body: "A tenant is the isolation domain whose data must not be confused with another tenant's data. The exact business meaning is application-specific; the security requirement is not. A protected request needs a tenant decision that can be evaluated against the resource it wants to reach." },
      { title: "Policy", body: "A policy expresses rules that determine how protected operations should be evaluated. Policy changes are security-sensitive because they can change what the boundary allows. Versioning and audit history make those changes reviewable." },
      { title: "Node", body: "A node represents enforcement infrastructure. Operators need to know which nodes exist, which environment they belong to, what state they report and which deployment state they are expected to run." },
      { title: "Deployment", body: "A deployment connects desired state with observed infrastructure state. This distinction matters during rollout: a control plane can record what should be running while the operator still needs evidence that the fleet actually applied it." },
      { title: "Verification", body: "Verification is an executable check of an expected security property. It is not simply a status badge. A useful verification run has an expected decision, an observed decision and enough context to explain the difference." },
      { title: "Audit evidence", body: "Audit records preserve operational history. They should answer practical questions such as who changed a policy, when an action occurred, which resource was affected and what security-sensitive result followed." },
    ],
    related: [
      { label: "Security model", to: "/docs/security" },
      { label: "Operations", to: "/docs/operations" },
      { label: "API reference", to: "/docs/api-reference" },
      { label: "FAQ", to: "/faq" },
    ],
  },

  "docs/api-reference": {
    eyebrow: "Documentation / API reference",
    title: "Understand the control-plane contract before integrating.",
    description: "The API is organized around authentication, organization resources, tenant isolation, policy, infrastructure, verification and operational evidence.",
    sections: [
      { title: "Authentication boundary", body: "The control plane provides password-based signup, login, session inspection and logout. Browser authentication is session-based rather than putting a long-lived session secret into frontend storage. The browser carries the server-managed session cookie." },
      { title: "Signup", body: "Workspace creation establishes the initial organization context and owner membership. A successful signup is not merely a frontend state change; it creates the server-side account and organization state required for the console." },
      { title: "Login and session inspection", body: "Login establishes an authenticated session. Session inspection is then used by the frontend to decide whether the protected console may render. If the session is absent or invalid, the console redirects to the login boundary." },
      { title: "Organizations and tenants", body: "Organization-scoped resources must be evaluated against the current authenticated organization. A client should never treat an identifier in a request as proof that the caller is allowed to access that resource." },
      { title: "Policies and protected writes", body: "Policy changes are authenticated and role-sensitive operations. Browser state-changing requests also use the session's CSRF protection. Clients should surface authorization failures rather than retrying the same operation through an unprotected path." },
      { title: "Infrastructure operations", body: "Node, deployment and environment operations represent the management side of enforcement infrastructure. They describe desired and observed state; they do not turn the control plane into the data-plane enforcement authority." },
      { title: "Verification and audit", body: "Verification and audit surfaces provide the evidence layer. Integrations should treat these records as operational data: useful for review, investigation, regression checks and security workflows." },
      { title: "Failure behavior", body: "A 401 generally means authentication is missing or invalid. A 403 indicates authorization or CSRF protection rejected the request. A 404 means the requested resource was not found within the visible scope. A 409 represents a conflict condition such as an existing identity or incompatible state. Clients should not interpret any of these failures as permission to bypass the boundary." },
      { title: "Integration principle", body: "The safest integration is the boring one: authenticate, establish tenant context, call the protected operation through the enforcement path, inspect the result and preserve evidence. Avoid building a second unofficial authorization path beside Proxima." },
    ],
    related: [
      { label: "Developer API reference", to: "/developers/api-reference" },
      { label: "Authentication", to: "/developers/authentication" },
      { label: "Security", to: "/docs/security" },
      { label: "Troubleshooting", to: "/docs/troubleshooting" },
    ],
  },

  "docs/security": {
    eyebrow: "Documentation / Security",
    title: "How Proxima turns tenant isolation into an infrastructure boundary.",
    description: "The security model is based on explicit context, enforcement before protected data, layered database controls and repeatable verification.",
    sections: [
      { title: "The security property", body: "The central property is tenant isolation: a request authorized for tenant A must not gain access to tenant B's protected data. The product is designed around making this property explicit rather than assuming every application path will implement it perfectly." },
      { title: "Identity versus tenant authorization", body: "Authentication answers who is making the request. Tenant authorization answers which isolation domain that identity may operate on for this operation. These are related decisions, but they are not the same decision." },
      { title: "Tenant context", body: "Tenant context must be explicit, trusted and carried through the protected request path. A client-controlled tenant identifier should not be treated as sufficient authorization merely because the identifier has a valid shape." },
      { title: "Enforcement", body: "The Proxima boundary is intended to sit between application identity and protected PostgreSQL access. Invalid, missing, expired or cross-tenant context should be rejected before the operation can become a protected data access." },
      { title: "PostgreSQL controls", body: "Proxima does not replace PostgreSQL security. Roles and row-level security remain useful controls and can provide another enforcement layer at the database boundary. Defense in depth is stronger when each layer has a clear responsibility." },
      { title: "Fail closed", body: "A missing security input should not produce a permissive fallback. If tenant context cannot be established or validated, the expected behavior is denial. This is particularly important for expired context and cross-tenant requests." },
      { title: "Verification", body: "The security model becomes stronger when the expected behavior is repeatedly tested. A meaningful verification suite includes legitimate allow cases and deliberately invalid block cases." },
      { title: "Evidence", body: "A security decision that cannot be inspected later is difficult to operate. Verification and audit records should provide enough context to understand the policy, tenant, infrastructure and decision involved." },
      { title: "Control plane versus enforcement", body: "The control plane manages configuration and operations. The enforcement engine remains the security authority for protected data access. Management-plane failure should not become an excuse for turning a protected path into allow-all behavior." },
    ],
    related: [
      { label: "Verification guide", to: "/developers/verification" },
      { label: "Tenant context", to: "/developers/tenant-context" },
      { label: "Trust", to: "/trust" },
      { label: "Security page", to: "/security" },
    ],
  },

  "docs/operations": {
    eyebrow: "Documentation / Operations",
    title: "Operate the boundary after the architecture diagram is finished.",
    description: "Production security needs deployment state, infrastructure visibility, verification and evidence—not only configuration screens.",
    sections: [
      { title: "Environments", body: "Keep development, staging and production concerns explicit. Environment configuration should identify where enforcement infrastructure runs and which resources belong to each environment." },
      { title: "Nodes", body: "Nodes represent enforcement infrastructure. Operators need lifecycle state, environment association and deployment information so an unhealthy or unexpected node can be investigated without guessing." },
      { title: "Enrollment", body: "Enrollment credentials are sensitive infrastructure credentials. They should be issued deliberately, stored securely and rotated according to the organization's operational process. They should never be exposed through browser UI or committed to source control." },
      { title: "Deployments", body: "A deployment should distinguish desired state from observed state. During rollout, operators need to know whether the requested version has actually reached the relevant enforcement infrastructure." },
      { title: "Verification runs", body: "Run verification after changes that could affect isolation: policy changes, database controls, deployments or integration changes. The verification result should remain inspectable after the test session ends." },
      { title: "Audit review", body: "Audit should make security-sensitive activity reconstructable. Review changes to organization access, policies, infrastructure, deployments and verification outcomes when investigating an incident or preparing a security review." },
      { title: "Operational failure", body: "When something fails, start at the boundary where the failure occurred. Authentication failures belong at the identity layer; tenant-denial failures belong at context or policy evaluation; infrastructure failures belong in node and deployment state." },
      { title: "Production discipline", body: "Do not mark an integration healthy because the dashboard is green. Confirm the actual request path, run allow/block verification and inspect the evidence. The objective is a working control, not a convincing interface." },
    ],
    related: [
      { label: "Troubleshooting", to: "/docs/troubleshooting" },
      { label: "Verification", to: "/developers/verification" },
      { label: "Changelog", to: "/changelog" },
      { label: "Status", to: "/status" },
    ],
  },

  "docs/troubleshooting": {
    eyebrow: "Documentation / Troubleshooting",
    title: "Diagnose the failure path instead of bypassing it.",
    description: "Use the observed behavior to locate the broken boundary and inspect the evidence that explains it.",
    sections: [
      { title: "I cannot sign in", body: "Confirm the control plane is reachable, the account exists and the credentials are correct. A failed login should remain a login problem; do not expect a direct console URL to bypass authentication." },
      { title: "The console redirects to login", body: "The frontend checks the authenticated session before opening the console. If the session cookie is absent, expired or rejected, the expected behavior is a redirect to login." },
      { title: "The browser is authenticated but a write returns 403", body: "Check both authorization and CSRF protection. A valid session does not automatically grant every organization role permission to mutate every resource." },
      { title: "A tenant request is denied", body: "Inspect tenant context first, then policy state, then the verification or audit record. A denial can be the correct security result if the context is invalid or the requested resource belongs to another tenant." },
      { title: "A cross-tenant test unexpectedly succeeds", body: "Treat this as a security incident in the test environment. Preserve the exact request context, policy version, deployment state and observed result before changing anything. Do not weaken the test to make it pass." },
      { title: "A verification run fails", body: "Compare expected and observed decisions. Check tenant identifiers, policy version, node state, deployment state and database controls. A verification failure is evidence about the system; it is not a reason to remove the verification." },
      { title: "The dashboard shows stale infrastructure state", body: "Separate control-plane state from enforcement-plane state. A management record can say what should be deployed while an enforcement node may still be unhealthy or on an older state." },
      { title: "Where should I look next?", body: "For authentication, use the authentication guide. For tenant decisions, use the tenant-context guide. For infrastructure, inspect operations. For a security regression, run verification and preserve the result." },
    ],
    related: [
      { label: "Authentication", to: "/developers/authentication" },
      { label: "Tenant context", to: "/developers/tenant-context" },
      { label: "Operations", to: "/docs/operations" },
      { label: "Support", to: "/support" },
    ],
  },

  "developers/quickstart": {
    eyebrow: "Developer platform / Quickstart",
    title: "Build your first protected Proxima request.",
    description: "The quickstart follows the actual security path instead of hiding integration behind a generic SDK button.",
    sections: [
      { title: "1. Establish application identity", body: "Authenticate the caller using the mechanism appropriate for your application. This gives you identity, but it does not by itself establish which tenant the request is allowed to operate on." },
      { title: "2. Resolve the tenant", body: "Determine the tenant from trusted application state and authorization rules. Avoid accepting a tenant identifier from an untrusted client as the complete authorization decision." },
      { title: "3. Carry tenant context", body: "Carry the tenant decision through the protected request path. The context should remain associated with the operation until the Proxima boundary evaluates it." },
      { title: "4. Cross Proxima", body: "The protected operation crosses the Proxima enforcement boundary. The boundary evaluates the request context and policy before the operation is allowed to reach protected data." },
      { title: "5. Reach PostgreSQL", body: "An allowed operation can proceed to PostgreSQL. Roles and row-level security can provide another layer of protection at the database itself.", code: "Application\n  → Identity + tenant context\n  → Proxima\n  → PostgreSQL\n  → Protected data" },
      { title: "6. Verify the normal path", body: "Run a same-tenant operation and record the expected allow result. This establishes the baseline behavior of the integration." },
      { title: "7. Verify the attack path", body: "Attempt a cross-tenant operation and invalid-context cases. The expected result is denial.", code: "Tenant A → Tenant A data = ALLOW\nTenant A → Tenant B data = BLOCK\nExpired context = BLOCK\nMissing context = BLOCK" },
      { title: "8. Keep the evidence", body: "Store the verification result and relevant context so another engineer can inspect the security property without reproducing the entire original session." },
    ],
    related: [
      { label: "Tenant context", to: "/developers/tenant-context" },
      { label: "Verification", to: "/developers/verification" },
      { label: "API reference", to: "/developers/api-reference" },
      { label: "Authentication", to: "/developers/authentication" },
    ],
  },

  "developers/authentication": {
    eyebrow: "Developer platform / Authentication",
    title: "Authentication establishes identity. Proxima still evaluates tenant context.",
    description: "Understand browser sessions, CSRF protection, machine credentials and enterprise identity without confusing them with tenant authorization.",
    sections: [
      { title: "Browser session", body: "The control plane uses a server-managed session and an HttpOnly cookie. The frontend can ask the server whether the current session is authenticated without holding the session secret itself." },
      { title: "Login lifecycle", body: "Login establishes the session. Session inspection confirms it. Logout invalidates the session. The protected console checks that lifecycle instead of trusting a frontend flag." },
      { title: "CSRF protection", body: "State-changing browser operations use the session's CSRF protection. Authentication and authorization are separate concerns: a valid session can still receive a 403 when a protected write fails the required security checks." },
      { title: "Service identities", body: "Machine-to-machine integrations should use dedicated credentials and keep them server-side. Do not copy a human password into a service or expose a secret through a browser bundle." },
      { title: "Credential lifecycle", body: "Treat credentials as replaceable infrastructure. Rotate them, scope them to the required operation and remove credentials that are no longer needed." },
      { title: "Enterprise identity", body: "Enterprise OIDC belongs in organization identity configuration. It is part of the authentication architecture, not a decorative button placed beside password login." },
      { title: "Authentication is not tenant authorization", body: "Even after authentication succeeds, the request must still carry the tenant context that the operation is allowed to use. This separation is central to the Proxima model." },
    ],
    related: [
      { label: "Tenant context", to: "/developers/tenant-context" },
      { label: "API reference", to: "/developers/api-reference" },
      { label: "Enterprise identity", to: "/app/settings/identity" },
      { label: "Security", to: "/docs/security" },
    ],
  },

  "developers/tenant-context": {
    eyebrow: "Developer platform / Tenant context",
    title: "Make the tenant decision explicit on every protected path.",
    description: "Tenant context connects an authenticated request to the exact isolation domain it is allowed to touch.",
    sections: [
      { title: "Define the tenant boundary", body: "Start by deciding what your application considers a tenant. This definition should be stable enough that engineers, background jobs and data-access code can all refer to the same isolation concept." },
      { title: "Resolve from trusted state", body: "Tenant resolution should come from authorization-aware application state. A raw identifier supplied by a browser should not become the final authorization decision simply because it exists." },
      { title: "Carry the context", body: "Once resolved, tenant context must remain attached to the protected operation. Avoid code paths where context disappears and the database call falls back to a broader identity." },
      { title: "Evaluate the resource", body: "The boundary must compare the request's tenant context with the tenant boundary of the protected resource. The result should be deterministic: allowed context is allowed; mismatched context is denied." },
      { title: "Reject ambiguity", body: "Missing, malformed, expired or mismatched context should fail closed. Ambiguity is a security condition, not a reason to guess." },
      { title: "Background jobs", body: "Jobs and asynchronous workers need the same tenant discipline as interactive requests. If a job acts on tenant data, the job payload or execution context must identify the intended tenant explicitly." },
      { title: "Verification cases", body: "Test the context model with same-tenant, cross-tenant, missing and expired cases. These tests catch regressions that a happy-path integration test cannot." },
    ],
    related: [
      { label: "Security model", to: "/docs/security" },
      { label: "Quickstart", to: "/developers/quickstart" },
      { label: "Verification", to: "/developers/verification" },
      { label: "Troubleshooting", to: "/docs/troubleshooting" },
    ],
  },

  "developers/verification": {
    eyebrow: "Developer platform / Verification",
    title: "Turn tenant isolation into something your team can repeatedly test.",
    description: "Verification is where the expected security property becomes an executable check and an inspectable result.",
    sections: [
      { title: "Define the expected decision", body: "Every verification case should start with a clear expectation. If tenant A is operating on tenant A data, the expected result is allow. If tenant A attempts tenant B data, the expected result is block." },
      { title: "Allow cases", body: "Exercise legitimate operations. Verify that valid identity, tenant context and policy allow the intended operation. Allow tests prove the boundary is usable, not merely restrictive." },
      { title: "Block cases", body: "Exercise cross-tenant operations, expired context, missing context and other invalid states. Block tests prove the boundary does not silently fall through to broader access." },
      { title: "Compare expected and observed", body: "A verification run is useful when it records both the expected decision and the observed decision. The difference is what tells the operator whether the security property holds." },
      { title: "Capture context", body: "Keep the policy or configuration version, tenant information, infrastructure context and relevant timestamps needed to explain the result later." },
      { title: "Regression verification", body: "Run verification after meaningful changes to policies, database controls, deployments and integrations. Security regressions often appear at boundaries between components." },
      { title: "Review failures", body: "A failed verification should remain visible. Investigate the failure, preserve the evidence and fix the underlying path rather than editing the expectation until the test turns green." },
    ],
    related: [
      { label: "Operations", to: "/docs/operations" },
      { label: "Audit", to: "/app/audit" },
      { label: "Security", to: "/docs/security" },
      { label: "Quickstart", to: "/developers/quickstart" },
    ],
  },

  "developers/api-reference": {
    eyebrow: "Developer platform / API reference",
    title: "Explore the operations your integration actually needs.",
    description: "A practical reference organized around the control-plane resource model rather than a list of disconnected endpoint names.",
    sections: [
      { title: "Authentication operations", body: "The authentication surface covers account creation, login, session inspection and logout. The frontend relies on server-side session state to determine whether the protected console can open." },
      { title: "Organization operations", body: "Organization-scoped operations are evaluated against the current authenticated organization and membership role. Resource identifiers do not override that scope." },
      { title: "Tenant operations", body: "Tenant operations manage the isolation domains visible to the organization. Application integration should still enforce tenant context at the protected request boundary." },
      { title: "Policy operations", body: "Policy operations manage the configuration that determines how protected requests should be evaluated. Policy mutation is security-sensitive and should be protected by role and CSRF controls." },
      { title: "Node and deployment operations", body: "Infrastructure operations expose the management state of the enforcement fleet. Desired deployment state and observed state should remain distinguishable." },
      { title: "Verification operations", body: "Verification operations make security expectations executable. Results should remain associated with enough context to explain why an operation was allowed or blocked." },
      { title: "Audit operations", body: "Audit operations expose the operational record around security-sensitive actions. Use them to investigate changes rather than relying on application logs alone." },
      { title: "Error handling", body: "Treat authentication, authorization, conflict and not-found responses as meaningful states. Do not build a client fallback that skips the security boundary when an API call fails." },
    ],
    related: [
      { label: "Docs API reference", to: "/docs/api-reference" },
      { label: "Authentication", to: "/developers/authentication" },
      { label: "Webhooks", to: "/developers/webhooks" },
      { label: "Operations", to: "/docs/operations" },
    ],
  },

  "developers/webhooks": {
    eyebrow: "Developer platform / Webhooks and events",
    title: "Connect Agata events to the systems your team already operates.",
    description: "Security and infrastructure events become useful when they can trigger investigation, automation and response outside the control plane.",
    sections: [
      { title: "Event categories", body: "Useful event families include authentication activity, organization membership changes, policy changes, deployments, verification outcomes, security signals and billing state changes." },
      { title: "Delivery contract", body: "Webhook consumers should be prepared for retries and duplicate delivery. Event handlers should be idempotent so a repeated event does not accidentally perform the same side effect twice." },
      { title: "Authentication", body: "Webhook endpoints must authenticate the sender and validate the event before acting on it. Never treat an incoming event body as trusted merely because it arrived at your public endpoint." },
      { title: "Security events", body: "Security-sensitive events should identify the affected organization and resource and provide the decision context needed for investigation without exposing credentials or unnecessary secrets." },
      { title: "Verification events", body: "Verification outcomes can be forwarded into incident response, observability or deployment workflows so a security regression becomes visible where engineers already work." },
      { title: "Operational events", body: "Deployment and infrastructure events can feed internal release tracking and operations tooling. The control plane remains the source of management state; consumers should not invent a parallel state machine." },
      { title: "Retries and failure", body: "A consumer that cannot process an event should fail explicitly and retry according to its delivery policy. Silent loss is worse than a visible retry because it destroys the operational trail." },
    ],
    related: [
      { label: "API reference", to: "/developers/api-reference" },
      { label: "Audit", to: "/app/audit" },
      { label: "Security", to: "/security" },
      { label: "Operations", to: "/docs/operations" },
    ],
  },

  "solutions/b2b-saas": {
    eyebrow: "Solutions / B2B SaaS",
    title: "Keep customer organizations separated as your SaaS grows.",
    description: "B2B SaaS turns tenant isolation into a repeated architectural concern. Proxima gives the boundary a dedicated place to live.",
    sections: [
      { title: "The problem", body: "A B2B product can start with a single tenant check and gradually accumulate tenant-aware routes, services, jobs, caches and database queries. The more places that know about isolation, the more opportunities exist for an inconsistent decision." },
      { title: "The Proxima approach", body: "Proxima introduces an explicit boundary between application identity and protected data. The application still understands its business authorization, while the infrastructure boundary provides another place to enforce and verify tenant isolation." },
      { title: "Tenant context", body: "Every protected operation should identify the tenant it is allowed to act on. This makes the isolation decision visible instead of relying on an implicit assumption buried inside a database query." },
      { title: "Database defense in depth", body: "PostgreSQL roles and row-level security can remain in place. Proxima is complementary: it adds enforcement and verification around the request path." },
      { title: "Verification for releases", body: "Teams can run same-tenant and cross-tenant verification after changes. This is particularly useful when a release changes authorization middleware, database access or shared service code." },
      { title: "Operational evidence", body: "When a security question appears, operators need more than source code. Verification and audit evidence help reconstruct the state of the boundary at the time of the event." },
      { title: "When it fits", body: "Proxima is most useful when tenant isolation is important enough to deserve an explicit infrastructure boundary and the team wants repeatable evidence rather than another checklist." },
    ],
    related: [
      { label: "Developer quickstart", to: "/developers/quickstart" },
      { label: "Security", to: "/security" },
      { label: "Pricing", to: "/pricing" },
      { label: "Contact", to: "/contact" },
    ],
  },

  "solutions/enterprise-saas": {
    eyebrow: "Solutions / Enterprise SaaS",
    title: "Give security and engineering teams a boundary they can inspect.",
    description: "Enterprise SaaS needs tenant isolation plus operational ownership, team controls and evidence that can survive a security review.",
    sections: [
      { title: "Operational visibility", body: "The control plane provides a place to inspect tenants, policies, infrastructure, deployments, verification and audit state. That keeps security decisions visible to the people operating the platform." },
      { title: "Identity and membership", body: "Enterprise environments need more than one owner account. Organization membership, roles and enterprise identity configuration provide the administrative layer around protected workloads." },
      { title: "Policy ownership", body: "Policies are security-sensitive configuration. Enterprise teams need a clear place to review what is configured, who can change it and what evidence exists after a change." },
      { title: "Verification evidence", body: "Verification can turn an isolation expectation into a repeatable check. Evidence can then support engineering review, incident investigation and operational confidence." },
      { title: "Infrastructure state", body: "Nodes and deployments make the enforcement fleet visible. Operators can distinguish intended configuration from observed infrastructure state instead of relying on assumptions." },
      { title: "Auditability", body: "A useful audit record connects actions to organizations, resources, timestamps and security-sensitive outcomes. This makes investigations faster and reduces dependence on scattered logs." },
      { title: "Enterprise identity", body: "OIDC and related enterprise identity configuration belongs in the organization settings model. Authentication should remain connected to the same organization and role boundaries used elsewhere." },
    ],
    related: [
      { label: "Authentication", to: "/developers/authentication" },
      { label: "Trust", to: "/trust" },
      { label: "Security", to: "/docs/security" },
      { label: "Contact", to: "/contact" },
    ],
  },

  "solutions/developer-platforms": {
    eyebrow: "Solutions / Developer platforms",
    title: "Keep tenant context consistent across the infrastructure layer.",
    description: "Developer platforms become the shared foundation for many applications. A consistent tenant boundary prevents every product team from reinventing the same security control.",
    sections: [
      { title: "Centralize the difficult part", body: "Application teams should not need to rebuild an entire tenant-isolation control plane every time a new service is created. A shared boundary gives platform engineering a place to standardize the security model." },
      { title: "Keep the contract visible", body: "A developer platform needs more than an SDK name. Engineers need a request model, authentication guidance, tenant-context rules, API behavior and verification expectations." },
      { title: "Support multiple services", body: "The same isolation principles can be applied across API services, background workers and other infrastructure components as long as the tenant context remains explicit." },
      { title: "Operate the fleet", body: "Nodes, deployments and environments provide platform teams with an operating model for enforcement infrastructure rather than a collection of unmanaged processes." },
      { title: "Verify centrally", body: "Platform engineering can run repeatable allow/block verification against shared infrastructure and use the results as regression evidence for platform changes." },
      { title: "Give product teams a clear boundary", body: "The purpose is not to hide security from developers. It is to make the boundary understandable and consistent enough that developers know exactly where their application responsibility ends and the infrastructure control begins." },
    ],
    related: [
      { label: "Developer platform", to: "/developers" },
      { label: "Quickstart", to: "/developers/quickstart" },
      { label: "Operations", to: "/docs/operations" },
      { label: "API reference", to: "/developers/api-reference" },
    ],
  },

  "solutions/security-sensitive-systems": {
    eyebrow: "Solutions / Security-sensitive systems",
    title: "Make unauthorized cross-tenant access a deliberate failure.",
    description: "When the cost of a tenant boundary failure is high, security behavior should be explicit, testable and reviewable.",
    sections: [
      { title: "Fail closed", body: "Missing, invalid, expired or mismatched tenant context should not silently turn into broad access. A security-sensitive system should prefer an explicit denial to an ambiguous allow." },
      { title: "Separate identity from data authorization", body: "A correct identity does not automatically mean the request is allowed to touch every tenant. Keeping those decisions separate reduces the chance that authentication becomes an accidental data-access grant." },
      { title: "Layer the controls", body: "Proxima and PostgreSQL controls can reinforce one another. An application request can be evaluated before the database, while database roles and RLS remain a second line of defense." },
      { title: "Verify attack paths", body: "Security tests should include deliberate cross-tenant attempts. The objective is not merely to prove that the normal user journey works; it is to prove that the unwanted journey is blocked." },
      { title: "Preserve evidence", body: "A blocked operation is useful evidence when its context can be inspected later. Preserve enough information to understand which tenant, policy and infrastructure state produced the decision." },
      { title: "Investigate deviations", body: "If a block test unexpectedly succeeds, stop treating the test as a normal application bug. Preserve the result, identify the boundary that failed and investigate before continuing deployment." },
    ],
    related: [
      { label: "Security documentation", to: "/docs/security" },
      { label: "Verification", to: "/developers/verification" },
      { label: "Trust", to: "/trust" },
      { label: "Contact security", to: "/contact" },
    ],
  },

  "solutions/startups": {
    eyebrow: "Solutions / Growing startups",
    title: "Establish the isolation model before it becomes expensive to retrofit.",
    description: "A small team can still create a serious tenant boundary without building an entire internal security platform from scratch.",
    sections: [
      { title: "Start with the boundary", body: "Decide early where identity becomes tenant authorization and where protected data access is allowed. This prevents the boundary from being scattered across unrelated application layers." },
      { title: "Avoid duplicated security logic", body: "When each service implements tenant checks differently, consistency becomes harder to maintain. A common infrastructure model gives the team a shared reference point." },
      { title: "Keep PostgreSQL protections", body: "Starting with Proxima does not require throwing away database security. PostgreSQL roles and row-level security can remain part of the design." },
      { title: "Use verification as a development habit", body: "A small team can run the same allow/block checks after changes that a larger security team would run. The benefit is catching a tenant-isolation regression before customers discover it." },
      { title: "Grow into operations", body: "As infrastructure grows, nodes, deployments, environments and audit records provide a common operating model rather than forcing the team to create ad hoc spreadsheets and scripts." },
      { title: "Keep the product honest", body: "A useful security platform should distinguish connected systems from planned integrations. Teams should be able to tell whether a status represents real telemetry or configuration that still needs to be connected." },
    ],
    related: [
      { label: "Pricing", to: "/pricing" },
      { label: "Getting started", to: "/docs/getting-started" },
      { label: "Developer quickstart", to: "/developers/quickstart" },
      { label: "Contact", to: "/contact" },
    ],
  },

  "solutions/platform-engineering": {
    eyebrow: "Solutions / Platform engineering",
    title: "Give platform teams a repeatable tenant-isolation operating model.",
    description: "Centralize enforcement, fleet operations and verification while leaving product teams focused on their application.",
    sections: [
      { title: "Standardize the boundary", body: "Define a common model for identity, tenant context, policy evaluation and protected database access. This reduces the number of slightly different security implementations a platform team has to maintain." },
      { title: "Manage infrastructure", body: "Nodes and deployments provide an explicit model for the enforcement fleet. Platform engineers can reason about desired state, observed state and rollout rather than treating infrastructure as an invisible dependency." },
      { title: "Separate management from enforcement", body: "The control plane should manage the fleet without becoming the only authority that protects application data. The enforcement engine remains responsible for the protected decision." },
      { title: "Automate verification", body: "Verification can be placed into release workflows so policy or infrastructure changes are tested against expected tenant behavior before they become production surprises." },
      { title: "Centralize evidence", body: "Audit and verification records give platform teams a common evidence layer for incident response, security reviews and change investigation." },
      { title: "Give developers a stable contract", body: "Product teams can integrate against a documented tenant-context and request model while platform engineering owns the underlying enforcement infrastructure." },
    ],
    related: [
      { label: "Operations", to: "/docs/operations" },
      { label: "Developer platform", to: "/developers" },
      { label: "Verification", to: "/developers/verification" },
      { label: "Product", to: "/product" },
    ],
  },

  "changelog/frontend-reconstruction": {
    eyebrow: "Changelog / October 2026",
    title: "Frontend reconstruction",
    description: "The public and authenticated product experience moved to a real React application architecture with explicit destinations instead of dead labels.",
    sections: [
      { title: "What changed", body: "The frontend moved to a React, TypeScript and Vite architecture with React Router and a shared Agata design system. Public pages, authentication and the console now share one application-level routing model." },
      { title: "Why it changed", body: "The previous experience was too static for an infrastructure product. Navigation labels need to lead somewhere meaningful, documentation needs to contain actual technical material and the authenticated console needs a real session boundary." },
      { title: "Public navigation", body: "Product, solutions, developers, documentation, security, trust, company, changelog, support, contact and legal destinations are now represented as real routes rather than visual-only navigation." },
      { title: "Documentation", body: "Guides now have individual destinations and detailed sections covering architecture, request flow, authentication, tenant context, verification, API behavior, operations and troubleshooting." },
      { title: "Authentication", body: "The frontend connects to the existing control-plane authentication lifecycle for signup, login, session inspection and logout. The console checks the server session before rendering protected content." },
      { title: "Homepage", body: "The homepage was rebuilt around the actual Proxima request model: application identity and tenant context, enforcement, PostgreSQL controls, verification and evidence. The page is intentionally tighter than the previous version so it reads as a product landing page rather than a zoomed interface." },
      { title: "What was deliberately not changed", body: "The approved Agata color identity and the working authentication visual language remain intact. The console structure also remains the product's operating surface; this work reduces density without changing its information architecture." },
    ],
    related: [
      { label: "Control plane foundation", to: "/changelog/control-plane-foundation" },
      { label: "Documentation", to: "/docs" },
      { label: "Developer platform", to: "/developers" },
    ],
  },

  "changelog/control-plane-foundation": {
    eyebrow: "Changelog / Earlier",
    title: "Control plane foundation",
    description: "The Rust control plane established the backend security and operational foundation that the React frontend now consumes.",
    sections: [
      { title: "Authentication and sessions", body: "The control plane provides password-based signup and login, server-managed sessions, HttpOnly cookies, CSRF protection and logout. The frontend authentication flow now uses these server-side boundaries rather than pretending a local UI flag is a session." },
      { title: "Organization model", body: "Users belong to organizations through memberships and roles. Signup establishes the initial organization context and owner membership needed to operate the workspace." },
      { title: "Operational resources", body: "The control plane contains resource surfaces for organizations, tenants, policies, nodes, deployments, verification, audit events, team access and support." },
      { title: "Security architecture", body: "The broader system keeps the Proxima enforcement engine as the data-plane authority while the control plane manages configuration, identity and operations. This separation is important because a management interface should not become an accidental data-access bypass." },
      { title: "Billing foundation", body: "The backend contains billing and entitlement foundations, including Stripe-oriented integration surfaces. Production catalog and domain configuration still need to be connected to the final customer-facing setup." },
      { title: "Enterprise identity", body: "Enterprise identity configuration exists as part of the control-plane model so organizations can connect identity management without turning the public login screen into a collection of decorative buttons." },
    ],
    related: [
      { label: "Frontend reconstruction", to: "/changelog/frontend-reconstruction" },
      { label: "Product", to: "/product" },
      { label: "Security", to: "/security" },
    ],
  },

  "changelog/authentication-boundary": {
    eyebrow: "Changelog / Authentication",
    title: "Authentication boundary",
    description: "The browser now treats the Rust control plane as the authority for account sessions instead of treating the dashboard as an open frontend surface.",
    sections: [
      { title: "Session check", body: "The protected console checks the current server-side session before opening. A visitor without an authenticated session is redirected to login." },
      { title: "Signup", body: "Creating a workspace sends the account and organization information to the backend rather than merely changing the browser URL." },
      { title: "Login", body: "Signing in creates the real control-plane session. The frontend then navigates into the requested protected destination." },
      { title: "Logout", body: "Signing out calls the backend logout operation and then returns the browser to the login boundary." },
      { title: "Why this matters", body: "A security product should not claim an authenticated dashboard simply because a React route exists. The route itself must be protected by the same session authority used by the backend." },
    ],
    related: [
      { label: "Developer authentication", to: "/developers/authentication" },
      { label: "Troubleshooting", to: "/docs/troubleshooting" },
      { label: "Security", to: "/docs/security" },
    ],
  },

  "changelog/verification-model": {
    eyebrow: "Changelog / Verification",
    title: "Verification model",
    description: "Verification became a first-class product concept rather than a hidden implementation detail.",
    sections: [
      { title: "Expected behavior", body: "Verification starts with an expected decision. Same-tenant operations should be allowed; cross-tenant and invalid-context operations should be blocked." },
      { title: "Evidence", body: "The result should remain inspectable after the request completes. Evidence makes the security property useful to operators, reviewers and incident responders." },
      { title: "Regression use", body: "Verification can be repeated after changes to policies, database controls, deployments or application integration." },
      { title: "Security principle", body: "The system should not be made to look healthy by editing the expected result. A verification failure is information about the security boundary that needs investigation." },
    ],
    related: [
      { label: "Verification guide", to: "/developers/verification" },
      { label: "Security documentation", to: "/docs/security" },
      { label: "Operations", to: "/docs/operations" },
    ],
  },

  "changelog/api-foundation": {
    eyebrow: "Changelog / API",
    title: "Control-plane API foundation",
    description: "The product's frontend and backend are organized around explicit resource and security boundaries rather than one generic data endpoint.",
    sections: [
      { title: "Resource-oriented operations", body: "The control plane separates authentication, organization, tenants, policies, infrastructure, verification and audit concerns so clients can reason about the security scope of each operation." },
      { title: "Protected writes", body: "Browser state-changing operations are protected by authenticated sessions, role checks and CSRF controls." },
      { title: "Organization scope", body: "Resource access is evaluated against the current organization context. Identifiers in client requests do not override membership or authorization." },
      { title: "Failure semantics", body: "Authentication, authorization, conflict and not-found responses are treated as meaningful states. The frontend surfaces failures instead of falling back to an unofficial path." },
    ],
    related: [
      { label: "API reference", to: "/docs/api-reference" },
      { label: "Developer API", to: "/developers/api-reference" },
      { label: "Authentication", to: "/developers/authentication" },
    ],
  },
};

export function PublicResourceRoute() {
  const { "*": resourcePath } = useParams();
  const resource = resourcePath ? resources[resourcePath] : undefined;
  if (!resource) return <Navigate to="/docs" replace />;
  return <PublicResourcePage {...resource} />;
}
