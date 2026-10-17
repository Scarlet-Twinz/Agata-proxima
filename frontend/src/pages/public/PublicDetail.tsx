import { ExternalLink } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

type Section = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  code?: string;
};

type Detail = {
  eyebrow: string;
  title: string;
  description: string;
  sections: Section[];
  links?: { label: string; to: string; external?: boolean }[];
};

const details: Record<string, Detail> = {
  "/product/model": {
    eyebrow: "Product · Operating model",
    title: "A clear path from identity to evidence.",
    description: "Understand the boundary Proxima establishes between application identity, tenant context and protected PostgreSQL operations.",
    sections: [
      { title: "The boundary", paragraphs: ["Application identity establishes who is acting. Tenant context establishes which customer boundary is in scope. Proxima evaluates that context before protected database work proceeds."] },
      { title: "Why it matters", paragraphs: ["The goal is to make tenant isolation an infrastructure property that can be enforced and tested rather than a convention scattered across application code."] },
    ],
    links: [{label:"Product overview",to:"/product"},{label:"Security model",to:"/security"}],
  },
  "/product/enforcement": {
    eyebrow: "Product · Enforcement",
    title: "Invalid tenant context is a security failure.",
    description: "The Proxima enforcement boundary rejects missing, invalid, expired or cross-tenant context before protected operations continue.",
    sections: [
      { title: "Decision boundary", paragraphs: ["Enforcement happens at a dedicated infrastructure boundary. The application does not get to silently bypass the tenant decision when it reaches the protected data path."] },
      { title: "Layered controls", bullets: ["Identity and tenant context", "Proxima enforcement", "PostgreSQL roles and row-level security", "Verification and audit evidence"] },
    ],
    links: [{label:"Security",to:"/security"},{label:"Verification",to:"/product/verification"}],
  },
  "/product/verification": {
    eyebrow: "Product · Verification",
    title: "Test the boundary instead of trusting it.",
    description: "Verification exercises expected isolation behavior and records evidence that engineering and security teams can inspect.",
    sections: [
      { title: "Expected allows", paragraphs: ["Valid tenant-local operations should be accepted when the configured policy and context permit them."] },
      { title: "Expected blocks", paragraphs: ["Cross-tenant, missing, malformed or otherwise invalid context should fail explicitly."] },
    ],
    links: [{label:"Verification documentation",to:"/docs/verification"},{label:"Trust center",to:"/trust"}],
  },
  "/product/evidence": {
    eyebrow: "Product · Evidence",
    title: "Make security decisions inspectable.",
    description: "Policies, verification outcomes and operational events form an evidence trail around the isolation boundary.",
    sections: [
      { title: "Operational evidence", paragraphs: ["Evidence gives teams a way to investigate what happened rather than relying on a dashboard claim or an application log alone."] },
      { title: "Auditability", paragraphs: ["The control plane exposes audit-oriented surfaces while the enforcement boundary remains independently responsible for isolation."] },
    ],
    links: [{label:"Audit documentation",to:"/docs/operations"},{label:"Changelog",to:"/changelog"}],
  },
  "/solutions/b2b-saas": {
    eyebrow:"Solutions · B2B SaaS", title:"Tenant boundaries for B2B SaaS.", description:"Protect customer organizations and their tenants without making every application path responsible for isolation alone.",
    sections:[{title:"Designed for customer boundaries",paragraphs:["Use a consistent infrastructure model as customer count, services and data access paths grow."]},{title:"What to explore",bullets:["Tenant context enforcement","Policy management","Verification","Audit evidence"]}],
    links:[{label:"Product",to:"/product"},{label:"Pricing",to:"/pricing"}],
  },
  "/solutions/enterprise-saas": {
    eyebrow:"Solutions · Enterprise SaaS", title:"Operational isolation for enterprise SaaS.", description:"Give security and engineering teams an infrastructure boundary they can inspect, operate and verify.",
    sections:[{title:"Enterprise operating model",paragraphs:["Centralize the controls and evidence around tenant isolation so security reviews can reference an explicit architecture."]}],
    links:[{label:"Security",to:"/security"},{label:"Trust",to:"/trust"}],
  },
  "/solutions/developer-platforms": {
    eyebrow:"Solutions · Developer platforms", title:"Keep tenant context attached to the request path.", description:"Build developer platforms where tenant identity remains part of the protected infrastructure flow.",
    sections:[{title:"Developer experience",paragraphs:["Give application teams clear integration points while keeping enforcement and verification outside individual feature paths."]}],
    links:[{label:"Developer platform",to:"/developers"},{label:"Documentation",to:"/docs"}],
  },
  "/solutions/security-sensitive": {
    eyebrow:"Solutions · Security-sensitive systems", title:"Make cross-tenant access an explicit failure condition.", description:"Use infrastructure controls when the cost of a tenant boundary mistake is high.",
    sections:[{title:"Security posture",paragraphs:["Proxima combines runtime enforcement, PostgreSQL controls, verification and audit evidence in one operating model."]}],
    links:[{label:"Security",to:"/security"},{label:"Trust center",to:"/trust"}],
  },
  "/solutions/startups": {
    eyebrow:"Solutions · Growing startups", title:"Establish the isolation model before it becomes sprawling.", description:"Start with an explicit tenant boundary before customer growth turns isolation into a distributed application concern.",
    sections:[{title:"Start with a boundary",paragraphs:["A clear infrastructure contract can reduce the number of application paths that need to understand every tenant-security detail."]}],
    links:[{label:"Pricing",to:"/pricing"},{label:"FAQ",to:"/faq"}],
  },
  "/solutions/platform-engineering": {
    eyebrow:"Solutions · Platform engineering", title:"Centralize tenant-isolation enforcement.", description:"Give platform teams a consistent security boundary instead of rebuilding the same controls across services.",
    sections:[{title:"Platform responsibility",paragraphs:["Make the boundary a reusable infrastructure capability that application teams can integrate and verify."]}],
    links:[{label:"Developer platform",to:"/developers"},{label:"Operations docs",to:"/docs/operations"}],
  },
  "/developers/quickstart": {
    eyebrow: "Developers · Quickstart",
    title: "Your first Proxima integration.",
    description: "A staged integration path from caller identity through tenant context and enforcement to verifiable database behavior.",
    sections: [
      { title: "Before you start", bullets: ["Use a non-production environment and test data that contains no real customer records.", "Know which service handles human login, which database is the control-plane database and which PostgreSQL path is protected by the Engine.", "Have an organization account with the role needed to create the test resources.", "Keep API keys, database credentials, OIDC client secrets and webhook signing secrets in a secret store; do not put them in browser code or Git.", "Read the API contract for the exact endpoints available in the version you are running."] },
      { title: "Step 1 — Establish identity and organization", paragraphs: ["Sign in through the supported application flow. Confirm the selected organization and your role before creating resources. For machine access, create an organization-scoped API key in the developer area, copy the secret once into a secure store and confirm the key is not sent to the browser.", "Expected result: authenticated requests resolve to the intended organization. If you receive 401, investigate authentication; if you receive 403, investigate role or feature entitlement; do not bypass the check."] },
      { title: "Step 2 — Create the minimum resources", paragraphs: ["Use the actual API or dashboard to create a test tenant. Add a policy, node and deployment only if your environment's workflow requires them. After each write, check the HTTP response and confirm the resource appears in the same organization. A dashboard record is control-plane state; it does not prove runtime enforcement is active."] },
      { title: "Step 3 — Connect the protected path", paragraphs: ["Follow the deployment and customer-integration instructions for the version you are running. Configure the application to use the intended Proxima Engine path and ensure the database role has only the required privileges. Keep PostgreSQL row-level security enabled where it is part of your design. Never point production traffic at a local development database or copy development credentials into production."] },
      { title: "Step 4 — Run positive and negative tests", bullets: ["Confirm a valid tenant-A request can perform an allowed operation on tenant-A data.", "Attempt a tenant-A read of tenant-B data and confirm it is rejected.", "Attempt a tenant-A write to tenant-B data and confirm it is rejected.", "Repeat with missing, malformed and expired tenant context as applicable.", "Test database privileges and row-level security separately where applicable."] },
      { title: "Step 5 — Inspect and record evidence", paragraphs: ["Review verification results and audit events. Record the environment, timestamp, build, test identities, tenant IDs, policy/deployment version, expected result, observed result and skipped checks. If any step was not exercised against the real protected database path, mark it unverified rather than passed."] },
      { title: "Common failure interpretation", bullets: ["401 Unauthorized: session or machine credential is missing, expired or invalid.", "403 Forbidden: the caller may be authenticated but lacks permission or the feature is not in the organization's plan.", "402 / plan limit response: inspect the organization's server-side entitlement and usage; do not edit a plan key in the browser.", "Empty resource list: confirm organization selection and whether the resource has actually been created.", "Verification fails: compare the expected tenant context, policy/deployment target, runtime path and database permissions before changing production state."] },
      { title: "Avoid false confidence", paragraphs: ["A successful API call, login, webhook registration or deployment record is not equivalent to successful isolation. Accept the integration only after the actual protected request path behaves as expected in the intended environment and the evidence has been reviewed."] },
    ],
    links: [{ label: "Customer integration", to: "/docs/getting-started" }, { label: "Tenant context", to: "/developers/tenant-context" }, { label: "Verification", to: "/docs/verification" }],
  },
  "/developers/authentication": {
    eyebrow: "Developers · Authentication",
    title: "Authentication and service identity.",
    description: "Separate human identity, organization authorization and machine credentials so each caller uses the appropriate trust boundary.",
    sections: [
      { title: "Human sessions", paragraphs: ["The browser console uses the application's supported session flow. State-changing requests are protected by the configured CSRF contract. Keep session cookies and CSRF tokens private, and allow the application to handle session expiry rather than trying to bypass it.", "Organization membership and role determine what an authenticated human can administer. Authentication alone does not grant access to every organization resource."] },
      { title: "Machine credentials", paragraphs: ["API keys are intended for trusted integrations and are organization-scoped. The full secret is displayed only at creation, so copy it directly into a secure secret store and never commit it to source control or ship it in a browser bundle.", "Use a separate key per integration where practical, limit who can access it, monitor usage and revoke it promptly when it is exposed or no longer needed."] },
      { title: "Enterprise identity", paragraphs: ["Microsoft Entra/OIDC is a separate identity-provider path. Treat it as configured only after the provider registration, issuer/client settings, callback URL, state handling and real sign-in flow have been verified in the target environment."] },
      { title: "Troubleshooting", bullets: ["Confirm the session is still valid.", "Confirm the selected organization and role.", "Check CSRF handling for write requests.", "Check server-side key configuration and revocation state for machine calls.", "Use sanitized errors and audit events; never include credentials in support messages."] },
    ],
    links: [{ label: "Organization model", to: "/developers/organizations" }, { label: "API reference", to: "/developers/api-reference" }, { label: "Security guide", to: "/docs/security" }],
  },
  "/developers/organizations": {
    eyebrow:"Developers · Organizations", title:"Keep administrative identity explicit.", description:"Organizations are the administrative boundary that owns membership, resources, audit evidence and commercial state.",
    sections:[{title:"Organization boundary",paragraphs:["Authenticate the caller, resolve the organization, then operate on resources that belong to that organization."]},{title:"Membership",bullets:["Owner — organization authority","Admin — operational administration","Operator — day-to-day resource operations","Viewer — read-oriented access"]}],
    links:[{label:"Tenant context",to:"/developers/tenant-context"},{label:"API reference",to:"/developers/api-reference"}],
  },
  "/developers/policies": {
    eyebrow:"Developers · Policies", title:"Declare enforcement intent before deployment.", description:"Policies are versioned documents that describe the security behavior the platform should enforce.",
    sections:[{title:"Policy lifecycle",bullets:["Draft the policy","Review the document","Deploy the intended version","Run verification","Retain evidence"]},{title:"Why versioning matters",paragraphs:["A versioned policy gives operators an explicit answer to which security intent was active when a deployment or verification occurred."]}],
    links:[{label:"Deployments",to:"/developers/deployments"},{label:"Verification",to:"/developers/verification"}],
  },
  "/developers/fleet": {
    eyebrow:"Developers · Fleet", title:"Know where enforcement is running.", description:"Nodes connect Proxima enforcement to explicit environments, regions and health state.",
    sections:[{title:"Node lifecycle",bullets:["Register","Enroll","Observe health","Deploy a version","Revoke when trust is lost"]},{title:"Operational state",paragraphs:["Node state belongs in the control plane so deployments and verification can reference an explicit enforcement target."]}],
    links:[{label:"Deployments",to:"/developers/deployments"},{label:"Operations docs",to:"/docs/operations"}],
  },
  "/developers/deployments": {
    eyebrow:"Developers · Deployments", title:"Move desired state through an observable lifecycle.", description:"Deployments connect policy intent, node placement, desired state and observed state.",
    sections:[{title:"Deployment lifecycle",bullets:["Declare desired version","Target a node","Apply desired state","Observe result","Verify behavior","Audit the change"]}],
    links:[{label:"Fleet",to:"/developers/fleet"},{label:"Verification",to:"/developers/verification"}],
  },
  "/developers/verification": {
    eyebrow:"Developers · Verification", title:"Turn isolation assumptions into evidence.", description:"Verification exercises expected behavior and leaves an inspectable result in the control plane.",
    sections:[{title:"What to test",bullets:["Valid tenant-local access","Cross-tenant rejection","Missing context rejection","Malformed context rejection","Evidence persistence"]},{title:"Operational workflow",paragraphs:["Run verification after meaningful policy, node or deployment changes and inspect the resulting audit trail."]}],
    links:[{label:"Verification docs",to:"/docs/verification"},{label:"Audit",to:"/developers/audit"}],
  },
  "/developers/audit": {
    eyebrow:"Developers · Audit", title:"Trace what changed and why.", description:"Audit events provide organization-scoped operational evidence around security and control-plane changes.",
    sections:[{title:"Useful event families",bullets:["Authentication and identity","Tenant and policy changes","Node and deployment changes","Verification outcomes","Credential lifecycle","Support operations"]},{title:"Use audit as evidence",paragraphs:["A dashboard status tells you what the system reports now; an audit trail helps explain how it got there."]}],
    links:[{label:"Security",to:"/security"},{label:"Operations",to:"/docs/operations"}],
  },
  "/developers/tenant-context": {
    eyebrow:"Developers · Tenant context", title:"Carry tenant identity through the protected path.", description:"Treat tenant context as a first-class part of the infrastructure request path.",
    sections:[{title:"Context lifecycle",bullets:["Resolve context from authenticated identity","Validate the tenant boundary","Enforce before protected database access","Verify expected isolation behavior"]}],
    links:[{label:"Product model",to:"/product/model"},{label:"Verification",to:"/product/verification"}],
  },
  "/developers/webhooks": {
    eyebrow: "Developers · Webhooks",
    title: "Configure signed event delivery and inspect every attempt.",
    description: "The control plane provides organization-scoped webhook management. Delivery behavior must still be verified against a controlled receiver in the environment where you plan to use it.",
    sections: [
      { title: "Step 1 — Configure the runtime secret", paragraphs: ["Set `AGATA_WEBHOOK_ENCRYPTION_KEY` to a unique random value of at least 32 characters in the service's secret manager before creating or rotating endpoints. Keep it stable and back it up securely; changing it makes existing encrypted signing secrets unreadable. Do not commit it or print it in logs. `AGATA_WEBHOOK_ALLOW_LOCAL_HTTP` defaults to false and should only be enabled for local loopback testing."] },
      { title: "Step 2 — Create an endpoint", bullets: ["Open the Developer → Webhooks area in the authenticated console.", "Register an HTTPS endpoint you control and choose exact audit action names or `*` where appropriate.", "Copy the generated signing secret at creation time and store it securely; it is not returned by list/detail APIs.", "For endpoints created before encrypted secret storage was introduced, rotate the secret before expecting delivery to work."] },
      { title: "Delivery contract", paragraphs: ["The JSON payload includes an event ID, event type, creation time, organization and actor context, resource information and event data. Headers include `X-Agata-Event`, `X-Agata-Event-Id`, `X-Agata-Delivery-Id` and `X-Agata-Signature`.", "The signature header uses `t=<unix-seconds>,v1=<hex>`. The HMAC-SHA256 input is the UTF-8 bytes of `<timestamp>.<raw request body>`. Verify against the exact raw request body before parsing it, use constant-time comparison, enforce a timestamp tolerance and deduplicate by delivery ID."] },
      { title: "Step 3 — Make the receiver safe", bullets: ["Accept HTTPS in production and validate the signature before business processing.", "Validate the event type and payload schema.", "Persist the delivery ID and processing state before applying non-idempotent side effects.", "Return a 2xx only after the event is durably accepted.", "Handle duplicate delivery without repeating the business action."] },
      { title: "Delivery history and retry", paragraphs: ["Inspect the endpoint's delivery history to distinguish queued, in-progress, delivered, failed and dead-letter outcomes. Non-2xx responses and transport failures are retried with bounded backoff; the current implementation is configured for up to eight attempts and a short request timeout. A successful HTTP response means the receiver accepted the request, not necessarily that its downstream business action completed.", "Use authorized retry or replay controls only after the receiver is idempotent. Replays must be traceable and must not bypass organization authorization."] },
      { title: "Security controls", bullets: ["Production destinations must use HTTPS and resolve to public IP addresses; private/reserved address resolution is rejected.", "Redirects are not followed, reducing the risk of redirect-based access to internal services.", "Signing secrets are encrypted at rest and returned only when first created or rotated.", "Endpoint creation, secret rotation, enable/disable and retry actions must be checked against organization permissions."] },
      { title: "Acceptance checklist", bullets: ["Deliver a real audit event to a controlled HTTPS receiver.", "Verify a valid signature and reject an altered body or invalid signature.", "Test 2xx, 4xx/5xx and timeout responses.", "Confirm retry scheduling and dead-letter behavior.", "Rotate the secret and confirm the new secret works while the old secret does not.", "Disable the endpoint and confirm no further delivery occurs.", "Attempt cross-organization access to endpoint and delivery IDs and confirm rejection.", "Confirm `AGATA_WEBHOOK_ENCRYPTION_KEY` is configured independently in each target environment."] },
    ],
    links: [{ label: "Download receiver examples (.zip)", to: "/downloads/agata-proxima-integration-starter-kit.zip", external: true }, { label: "API reference", to: "/docs/api-reference" }, { label: "Troubleshooting", to: "/docs/troubleshooting" }, { label: "Operations guide", to: "/docs/operations" }],
  },
  "/developers/events": {
    eyebrow: "Developers · Events",
    title: "Treat events as operational evidence.",
    description: "Define what an event means, who can consume it, how duplicates are handled and where processing failures can be investigated.",
    sections: [
      { title: "Event families", bullets: ["Identity and access changes.", "Tenant, policy, node and deployment lifecycle changes.", "Verification outcomes and security-relevant events.", "Credential lifecycle and administrative actions.", "External delivery and support workflow events where the configured contract exposes them."] },
      { title: "Event contract", paragraphs: ["A useful event has a stable identifier, event type, creation time, resource scope and a versioned payload contract. Consumers should not rely on undocumented fields or infer security-critical state from a human-readable message.", "Keep organization and tenant scope explicit where the event requires it, and avoid including credentials or unnecessary customer data in the payload."] },
      { title: "Delivery and retention", paragraphs: ["Use signed webhooks for external delivery where supported, validate each delivery and make processing idempotent. Keep a queryable operational record so failures can be retried and investigated.", "Only promise replay, retention or delivery guarantees that are implemented and configured in the actual provider and service."] },
    ],
    links: [{ label: "Webhook guidance", to: "/developers/webhooks" }, { label: "Audit evidence", to: "/developers/audit" }, { label: "Operations", to: "/docs/operations" }],
  },
  "/developers/integrations": {
    eyebrow: "Developers · Integration catalog",
    title: "Connect Agata Proxima to your engineering stack.",
    description: "Use the control-plane API, signed event delivery and explicit identity boundaries to connect the systems around a multi-tenant application.",
    sections: [
      { title: "Choose an integration path", bullets: ["ChatGPT / MCP — expose explicitly authorized Agata operations through a dedicated MCP server.", "Supabase — keep PostgreSQL RLS enabled and perform privileged Agata calls from trusted server-side code.", "Firebase — verify Firebase ID tokens on the backend before resolving organization and tenant scope.", "GitHub Actions — run API contract, integration and tenant-isolation checks in CI with environment-scoped secrets.", "Vercel — configure the API origin and secrets in server-side environment settings and run post-deployment checks.", "PostgreSQL + RLS — use least-privilege roles and independently test tenant-scoped database behavior."] },
      { title: "Integration contract", paragraphs: ["The common integration surface is the versioned `/api/v1` HTTP API and configured outbound webhook workflow. Each system must preserve authenticated identity, organization authorization and tenant scope."], code: "GET /api/v1/health\nGET /api/v1/billing/plans\nGET /api/v1/tenants  # authenticated request" },
      { title: "Credential and event handling", bullets: ["Keep server credentials in the secret store for the environment that uses them.", "Use the narrowest permissions the workflow requires.", "Verify external identity tokens server-side before trusting their claims.", "Verify webhook signatures against the exact raw request body and deduplicate delivery IDs.", "Record request IDs and outcomes without logging credentials or customer payloads."] },
      { title: "Acceptance checklist", bullets: ["Test successful authentication and an unauthorized caller.", "Test access to a resource in the active organization and denial for a different organization.", "Test valid tenant-local access and cross-tenant read/write denial.", "Exercise expired credentials, retries and duplicate events.", "Inspect verification results and audit history after the integration run."] },
    ],
    links: [{ label: "ChatGPT / MCP guide", to: "/developers/integrations/chatgpt" }, { label: "Supabase guide", to: "/developers/integrations/supabase" }, { label: "Firebase guide", to: "/developers/integrations/firebase" }, { label: "GitHub Actions guide", to: "/developers/integrations/github" }, { label: "Vercel guide", to: "/developers/integrations/vercel" }, { label: "PostgreSQL + RLS guide", to: "/developers/integrations/postgresql" }],
  },
  "/developers/integrations/chatgpt": {
    eyebrow: "Integration · ChatGPT and MCP",
    title: "Design a scoped ChatGPT connector for Agata Proxima.",
    description: "Use the Model Context Protocol (MCP) to expose selected Agata operations to an assistant while keeping authorization in the server-side control plane.",
    sections: [
      { title: "Recommended architecture", paragraphs: ["ChatGPT connects to an MCP server; the MCP server authenticates to Agata Proxima using a dedicated, least-privilege service identity; Agata authorizes every request against the selected organization. Do not connect an assistant directly to PostgreSQL or expose a browser session or administrator credential."] },
      { title: "Tools to expose", bullets: ["Read organization-scoped tenant inventory.", "Read policy, deployment and verification summaries.", "Search audit events within the authorized organization.", "Read webhook endpoint and delivery status where the caller has permission.", "Run verification only when explicitly requested and the server confirms the required permission."] },
      { title: "Authentication and authorization", bullets: ["Use a dedicated credential stored by the MCP host, not a copied browser cookie.", "Bind the connection to one organization or resolve organization membership on every operation.", "Default to read-only tools; require explicit confirmation for mutations.", "Validate tool arguments against schemas and enforce authorization again in the API.", "Redact secrets and customer data from tool results unless necessary and authorized."] },
      { title: "Setup and acceptance", paragraphs: ["The MCP server endpoint and its OAuth/credential flow must be deployed before it can be added as a live ChatGPT connector. Once deployed, configure the connector with that endpoint, authorize the intended organization, run a read-only health and tenant query, then test denied cross-organization access and credential revocation."], bullets: ["Verify the official endpoint URL and TLS certificate.", "Test allowed and denied tool calls.", "Test expired and revoked credentials.", "Inspect server logs and Agata audit events.", "Confirm no tool bypasses the normal Agata authorization boundary."] },
    ],
    links: [{ label: "Integration catalog", to: "/developers/integrations" }, { label: "Authentication guide", to: "/developers/authentication" }, { label: "API reference", to: "/developers/api-reference" }],
  },
  "/developers/integrations/supabase": {
    eyebrow: "Integration · Supabase",
    title: "Use Agata Proxima alongside Supabase and PostgreSQL RLS.",
    description: "Keep database-level tenant controls active and call Agata from trusted server-side functions for organization-scoped control-plane workflows.",
    sections: [
      { title: "Architecture", paragraphs: ["Supabase Auth establishes the caller identity. A trusted backend or Edge Function verifies the session/token, maps the caller to an authorized organization and tenant, and calls the Agata control-plane API. PostgreSQL RLS remains enabled for data access."] },
      { title: "Implementation steps", bullets: ["Create a server-side Supabase Edge Function or backend route for Agata calls.", "Store the Agata API origin and credential in Supabase project secrets, never in a client-side environment variable.", "Verify the Supabase JWT server-side and resolve organization/tenant membership from trusted data.", "Call only the Agata endpoints required for the workflow.", "Keep user-facing database access subject to RLS and least-privilege roles."] },
      { title: "Example server-side request", code: "const response = await fetch(`${process.env.AGATA_API_BASE_URL}/api/v1/tenants`, {\n  headers: {\n    Authorization: `Bearer ${process.env.AGATA_API_KEY}`,\n    Accept: 'application/json'\n  }\n});\nif (!response.ok) throw new Error(`Agata API: ${response.status}`);\nconst tenants = await response.json();" },
      { title: "Acceptance", bullets: ["Test a valid user token and an invalid/expired token.", "Test organization membership and cross-organization denial.", "Test tenant-A reads and writes against tenant-B records through RLS.", "Confirm secrets are absent from browser bundles and logs.", "Inspect Agata verification and audit evidence after the test."] },
    ],
    links: [{ label: "Supabase Edge Functions documentation", to: "https://supabase.com/docs/guides/functions", external: true }, { label: "PostgreSQL + RLS guide", to: "/developers/integrations/postgresql" }, { label: "API reference", to: "/developers/api-reference" }],
  },
  "/developers/integrations/firebase": {
    eyebrow: "Integration · Firebase",
    title: "Use Firebase Authentication with explicit Agata authorization.",
    description: "Verify Firebase identity on the server, resolve the customer tenant from trusted membership data, and apply Agata organization authorization before protected operations.",
    sections: [
      { title: "Request flow", bullets: ["The client signs in with Firebase Authentication.", "The client sends its Firebase ID token to your trusted backend.", "The backend verifies the token using the Firebase Admin SDK.", "The backend resolves organization membership and tenant context from trusted records.", "The backend calls Agata with a server-held credential and checks the result before continuing."] },
      { title: "Server-side example", code: "import { getAuth } from 'firebase-admin/auth';\n\nconst decoded = await getAuth().verifyIdToken(idToken);\n// Resolve organization and tenant membership from trusted server data.\n// Then call Agata from server-side code using a secret-managed credential.\nconsole.log({ uid: decoded.uid });" },
      { title: "Security checklist", bullets: ["Never trust a tenant ID merely because it came beside a valid token.", "Keep the Agata credential out of the Firebase client application.", "Reject revoked, expired or invalid identity tokens.", "Test users with no organization membership and users in a different organization.", "Keep token claims and logs free of unnecessary sensitive data."] },
    ],
    links: [{ label: "Firebase Admin SDK documentation", to: "https://firebase.google.com/docs/auth/admin/verify-id-tokens", external: true }, { label: "Authentication guide", to: "/developers/authentication" }, { label: "Tenant context", to: "/developers/tenant-context" }],
  },
  "/developers/integrations/github": {
    eyebrow: "Integration · GitHub Actions",
    title: "Run Agata integration checks in CI.",
    description: "Use GitHub Actions to validate API contracts, integration behavior and tenant-isolation acceptance with environment-scoped secrets and reproducible test fixtures.",
    sections: [
      { title: "Recommended pipeline", bullets: ["Install pinned dependencies and run formatting, lint and unit tests.", "Start the control plane and a disposable PostgreSQL database for integration tests.", "Apply migrations and wait for readiness before running tests.", "Create synthetic organization and tenant fixtures.", "Run allowed-access and cross-tenant denial tests.", "Publish sanitized test reports and clean up the disposable environment."] },
      { title: "Secret configuration", paragraphs: ["Store credentials in GitHub Actions secrets or environment-scoped deployment environments. Use separate credentials for test and production. Never echo secrets, put them in artifacts or allow untrusted pull-request code to access production secrets."] },
      { title: "Workflow example", code: "name: Agata integration checks\non:\n  pull_request:\n  push:\n    branches: [main]\njobs:\n  verify:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 22\n      - run: npm ci --prefix frontend\n      - run: npm run lint --prefix frontend\n      - run: npm run build --prefix frontend" },
      { title: "Extend the gate", paragraphs: ["The example covers frontend checks. Add the repository Rust checks, migration tests and external SaaS acceptance jobs using the actual commands and services in your CI environment. A green frontend build alone does not replace backend or tenant-isolation tests."] },
    ],
    links: [{ label: "GitHub Actions documentation", to: "https://docs.github.com/actions", external: true }, { label: "Verification guide", to: "/docs/verification" }, { label: "Operations guide", to: "/docs/operations" }],
  },
  "/developers/integrations/vercel": {
    eyebrow: "Integration · Vercel",
    title: "Deploy the frontend with explicit environment configuration.",
    description: "Configure the public frontend, API origin and deployment checks so the browser talks to the intended Agata environment without exposing server credentials.",
    sections: [
      { title: "Environment setup", bullets: ["Set `VITE_API_BASE_URL` to the correct public API origin for the deployment environment.", "Keep server-side API credentials and integration secrets out of `VITE_` variables because frontend-prefixed variables are bundled for the browser.", "Configure the correct custom domain, HTTPS, redirect URLs, CORS and cookie settings for the selected environment.", "Use separate preview and production configuration; never connect a preview deployment to production data by accident."] },
      { title: "Build and release checks", bullets: ["Run frontend lint and production build before promoting a deployment.", "Check that the deployed frontend loads its assets and reaches the intended API origin.", "Test sign-in, session persistence, organization selection and a representative dashboard operation.", "Verify the Entra callback and secure-cookie behavior on the actual custom domain.", "Run post-deployment health and smoke checks, then record the deployment identifier."] },
      { title: "Configuration example", code: "VITE_API_BASE_URL=https://api.example.com\n\n# Do not put AGATA_API_KEY, database passwords, webhook keys,\n# or OAuth client secrets in VITE_* variables." },
    ],
    links: [{ label: "Vercel environment variables documentation", to: "https://vercel.com/docs/projects/environment-variables", external: true }, { label: "Authentication", to: "/developers/authentication" }, { label: "Operations", to: "/docs/operations" }],
  },
  "/developers/integrations/postgresql": {
    eyebrow: "Integration · PostgreSQL and RLS",
    title: "Keep database permissions inside the tenant-isolation design.",
    description: "Use PostgreSQL roles and row-level security as data-layer controls alongside trusted identity, tenant context and the Proxima enforcement path.",
    sections: [
      { title: "Role design", bullets: ["Use separate roles for schema ownership, migrations and application runtime.", "Grant the runtime role only the required tables, operations and functions.", "Do not run ordinary application requests as the database owner or a superuser.", "Enable and force RLS where required by the chosen table and role model.", "Make tenant context transaction-scoped and clear it reliably between pooled connections."] },
      { title: "RLS policy review", bullets: ["Define the trusted source of tenant identity.", "Check SELECT, INSERT, UPDATE and DELETE paths separately.", "Test missing context, malformed context and a tenant identifier from another customer.", "Test background jobs and service-role paths, not only HTTP handlers.", "Confirm prohibited operations leave database state unchanged."] },
      { title: "Acceptance matrix", code: "Case A: tenant A reads tenant A row -> allowed\nCase B: tenant A reads tenant B row -> denied\nCase C: tenant A updates tenant B row -> denied\nCase D: tenant context missing -> denied\nCase E: pooled connection reused -> context does not leak" },
    ],
    links: [{ label: "PostgreSQL row security documentation", to: "https://www.postgresql.org/docs/current/ddl-rowsecurity.html", external: true }, { label: "Security guide", to: "/docs/security" }, { label: "Verification checklist", to: "/docs/verification" }],
  },
  "/developers/downloads": {
    eyebrow: "Developers · Downloads",
    title: "Download the Agata Proxima integration starter kit.",
    description: "Get practical source examples for API access, Node.js, shell automation, webhook delivery and common application integration patterns.",
    sections: [
      { title: "Integration starter kit", paragraphs: ["Download the source bundle for a server-side Node.js client, a working API example, PowerShell and Bash smoke scripts, a webhook receiver example, and Supabase/Firebase integration samples."], code: "AGATA_API_BASE_URL=https://api.example.com\nAGATA_API_KEY=aga_<your-api-key>" },
      { title: "Included files", bullets: ["Node.js fetch client with status-code errors.", "Node.js example for health, plan catalogue and organization-scoped tenants.", "PowerShell and Bash API smoke scripts.", "Webhook receiver example with raw-body HMAC-SHA256 verification and delivery-ID handling notes.", "Supabase Edge Function and Firebase Admin SDK patterns.", "ChatGPT/MCP connector design checklist and Terraform provider acceptance checklist."] },
      { title: "Run the examples", code: "# Node.js 22+\nnode node/example.mjs\n\n# Bash smoke checks\n./cli/agata.sh\n\n# PowerShell smoke checks\n./cli/agata.ps1" },
      { title: "Choose the correct integration artifact", paragraphs: ["Use the starter kit's runnable API client and shell examples for immediate integration work. The SDK, CLI, Terraform and ChatGPT/MCP guides define their respective integration contracts. Install a versioned package or binary only from its verified release source, with matching version information and release checksums where provided."] },
    ],
    links: [{ label: "Download integration starter kit (.zip)", to: "/downloads/agata-proxima-integration-starter-kit.zip", external: true }, { label: "API reference", to: "/developers/api-reference" }, { label: "Integration catalog", to: "/developers/integrations" }, { label: "Docker and local troubleshooting", to: "/docs/troubleshooting" }, { label: "Quickstart", to: "/developers/quickstart" }],
  },
  "/developers/nodejs": {
    eyebrow: "Developers · Node.js",
    title: "Integrate Agata Proxima from a Node.js service.",
    description: "Use Node.js native fetch, an organization-scoped `aga_` API key and the versioned control-plane API from trusted server-side code.",
    sections: [
      { title: "Prerequisites", bullets: ["Node.js 22 or newer.", "The control-plane API origin for your target environment.", "An organization-scoped API key created in the authenticated console.", "A non-production organization with synthetic test data."] },
      { title: "Configure environment variables", code: "# PowerShell\n$env:AGATA_API_BASE_URL = \"https://api.example.com\"\n$env:AGATA_API_KEY = \"<load-from-secret-store>\"\n\n# Bash\nexport AGATA_API_BASE_URL=\"https://api.example.com\"\nexport AGATA_API_KEY=\"<load-from-secret-store>\"" },
      { title: "Create a reusable client", code: "export class AgataClient {\n  constructor(baseUrl = process.env.AGATA_API_BASE_URL, apiKey = process.env.AGATA_API_KEY) {\n    if (!baseUrl || !apiKey?.startsWith('aga_')) throw new Error('Agata API configuration is missing');\n    this.baseUrl = baseUrl.replace(/\\/+$/, '');\n    this.apiKey = apiKey;\n  }\n  async get(path) {\n    const response = await fetch(`${this.baseUrl}${path}`, {\n      headers: { Authorization: `Bearer ${this.apiKey}`, Accept: 'application/json' }\n    });\n    if (!response.ok) throw new Error(`Agata API returned ${response.status}`);\n    return response.json();\n  }\n}" },
      { title: "Run your first requests", code: "const agata = new AgataClient();\nconsole.log(await agata.get('/api/v1/health'));\nconsole.log(await agata.get('/api/v1/billing/plans'));\nconsole.log(await agata.get('/api/v1/tenants'));" },
      { title: "Production implementation checklist", bullets: ["Keep the key in a secret manager and out of browser bundles.", "Validate organization membership before exposing results to an end user.", "Handle 401, 403, 402, 429 and 5xx responses explicitly.", "Set request timeouts and avoid automatic retries of non-idempotent writes.", "Test revoked keys and cross-organization access denial.", "Log request identifiers and outcomes without authorization headers or customer payloads."] },
    ],
    links: [{ label: "Download integration starter kit (.zip)", to: "/downloads/agata-proxima-integration-starter-kit.zip", external: true }, { label: "API reference", to: "/developers/api-reference" }, { label: "Quickstart", to: "/developers/quickstart" }],
  },
  "/developers/sdks": {
    eyebrow: "Developers · SDKs",
    title: "Build a typed client on the Agata Proxima API.",
    description: "Use the `/api/v1` HTTP contract as the integration surface. This guide covers client structure, configuration, error handling and release checks.",
    sections: [
      { title: "Start with the HTTP API", paragraphs: ["The frontend uses the control-plane HTTP API. External applications can use the same documented HTTP contract from their backend. Confirm the deployed API origin and machine-auth mechanism before connecting a client."], code: "const baseUrl = process.env.AGATA_API_BASE_URL;\nconst apiKey = process.env.AGATA_API_KEY;\n\nconst response = await fetch(`${baseUrl}/api/v1/tenants`, {\n  headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }\n});\nif (!response.ok) throw new Error(`Agata API returned ${response.status}`);\nconst tenants = await response.json();" },
      { title: "Client implementation requirements", bullets: ["Accept the API base URL and credential through explicit configuration.", "Use typed request and response models generated or checked against the OpenAPI schema.", "Expose status code and structured API errors without leaking response secrets.", "Set bounded timeouts and retry only operations that are safe to repeat.", "Keep organization scope explicit and do not infer tenant access from a client-supplied identifier.", "Support credential rotation and never log authorization headers."] },
      { title: "Application-owned client layout", paragraphs: ["For a Node.js or TypeScript project, put the wrapper in a shared server-side module. Keep service credentials out of browser bundles. A public npm package should be installed only after its package name, publisher, version, source and release artifact are published and verified."], code: "src/lib/agata-client.ts\nsrc/routes/tenants.ts\ntests/agata-client.test.ts\n\n# Run the application's own checks\nnpm test\nnpm run build" },
      { title: "Test before release", bullets: ["Unit-test URL construction, headers, response parsing and structured errors.", "Mock 401, 403, 404, 409, 429 and 5xx responses.", "Test timeout and retry behavior without duplicating writes.", "Run an integration test against a disposable Agata environment.", "Document supported runtimes, API compatibility, package ownership and security update process."] },
    ],
    links: [{ label: "Download integration starter kit (.zip)", to: "/downloads/agata-proxima-integration-starter-kit.zip", external: true }, { label: "API reference", to: "/developers/api-reference" }, { label: "OpenAPI source", to: "https://github.com/Scarlet-Twinz/Agata-proxima/blob/main/control-plane/openapi.json", external: true }, { label: "Quickstart", to: "/developers/quickstart" }],
  },
  "/developers/cli": {
    eyebrow: "Developers · CLI",
    title: "Automate Agata workflows from a terminal or CI job.",
    description: "Use reproducible HTTP requests for operator automation, with credentials supplied through the environment and every state change checked against the API response.",
    sections: [
      { title: "Prerequisites", bullets: ["A running Agata API origin for the intended environment.", "An organization-scoped credential created by an authorized administrator.", "PowerShell, Bash or another HTTP-capable shell.", "A test organization and synthetic tenant data for write operations."] },
      { title: "Set up PowerShell", code: "$env:AGATA_API_BASE_URL = \"https://api.example.com\"\n$env:AGATA_API_KEY = \"<load-from-secret-store>\"\n\nInvoke-RestMethod \"$env:AGATA_API_BASE_URL/api/v1/health\"\nInvoke-RestMethod \"$env:AGATA_API_BASE_URL/api/v1/billing/plans\"" },
      { title: "Set up Bash", code: "export AGATA_API_BASE_URL=\"https://api.example.com\"\nread -s AGATA_API_KEY\nexport AGATA_API_KEY\n\ncurl --fail --silent --show-error \"$AGATA_API_BASE_URL/api/v1/health\"\ncurl --fail --silent --show-error \"$AGATA_API_BASE_URL/api/v1/billing/plans\"" },
      { title: "Bootstrap a Proxima Engine node", paragraphs: ["Node registration and token rotation use the Control Plane HTTP API. This repository does not ship a separate proxima-node enrollment CLI; the Engine consumes the one-time token at startup and persists the returned identity. Keep the token in the process environment only for bootstrap and use a separate identity path for each node."], code: "$env:PROXIMA_NODE_ID = \"<node-uuid>\"\n$env:PROXIMA_NODE_ENROLLMENT_URL = \"https://<control-plane-host>/api/v1/nodes/enroll\"\n$env:PROXIMA_NODE_ENROLLMENT_TOKEN = \"<one-time-token>\"\ncargo run -p proxima-engine\nRemove-Item Env:PROXIMA_NODE_ENROLLMENT_TOKEN -ErrorAction SilentlyContinue" },
      { title: "Safe automation rules", bullets: ["Do not paste production secrets directly into shell history.", "Use CI secret stores and narrowly scoped credentials.", "Check the exit code and response before proceeding.", "Do not retry non-idempotent writes after a timeout without checking whether the first request committed.", "Log environment and request identifiers, not authorization headers or sensitive payloads."] },
      { title: "First-party CLI release requirements", bullets: ["Versioned source and documented command contract.", "Install instructions and supported operating-system matrix.", "Signed release artifacts and published checksums.", "Automated tests for authentication, errors and destructive-action safeguards.", "A release process that keeps install commands aligned with the exact published version."] },
    ],
    links: [{ label: "Download integration starter kit (.zip)", to: "/downloads/agata-proxima-integration-starter-kit.zip", external: true }, { label: "API reference", to: "/developers/api-reference" }, { label: "GitHub repository", to: "https://github.com/Scarlet-Twinz/Agata-proxima", external: true }, { label: "Getting started", to: "/docs/getting-started" }, { label: "Secure node enrollment", to: "/docs/node-enrollment" }],
  },
  "/developers/terraform": {
    eyebrow: "Developers · Terraform",
    title: "Manage Agata infrastructure changes with reviewed, repeatable plans.",
    description: "Use infrastructure-as-code for reproducible environment setup, with resource schemas and lifecycle behavior aligned to the Agata API.",
    sections: [
      { title: "Before writing Terraform resources", bullets: ["Define which Agata resources should be managed declaratively and which remain operational actions.", "Specify create, read, update, delete, import and drift behavior for each resource.", "Keep API credentials in the CI secret store and protect Terraform state as sensitive data.", "Avoid destructive defaults for tenants, policies, nodes or deployments.", "Run plan and policy review before applying changes to a shared environment."] },
      { title: "Provider installation", paragraphs: ["A Terraform provider must be published under a verified registry namespace with a versioned schema and release artifacts before users can add a `required_providers` block. Until that artifact is published, automate the documented HTTP API from an existing deployment pipeline rather than guessing a provider name."] },
      { title: "Provider acceptance suite", bullets: ["Create and read each resource from a disposable organization.", "Update fields and verify the resulting state.", "Import existing resources and compare the plan.", "Test drift detection and non-destructive reconciliation.", "Test organization isolation, permission denial and API throttling.", "Verify state files and plans do not expose credentials."] },
      { title: "Reference", paragraphs: ["Use the API reference to define resource fields and deployment/verification guides to establish acceptance behavior. Terraform language documentation explains provider configuration and lifecycle; it does not define an Agata-specific provider."] },
    ],
    links: [{ label: "Terraform documentation", to: "https://developer.hashicorp.com/terraform/docs", external: true }, { label: "API reference", to: "/developers/api-reference" }, { label: "Deployment guide", to: "/developers/deployments" }],
  },
  "/developers/api-reference": {
    eyebrow: "Developers · API reference",
    title: "The Agata Proxima control-plane API.",
    description: "Use the versioned `/api/v1` interface to manage organization-scoped resources and inspect platform state.",
    sections: [
      { title: "Base URL and version", paragraphs: ["Set the API base URL to the control-plane origin for your environment. All versioned control-plane routes use `/api/v1`. The running service OpenAPI document defines exact schemas and responses for that deployment."], code: "GET /api/v1/health\nGET /api/v1/billing/plans\nGET /api/v1/tenants" },
      { title: "Machine authentication", paragraphs: ["Create an organization-scoped API key in the authenticated console. The generated secret uses the `aga_` prefix and is shown only at creation time. Send it from trusted server-side code using the Bearer authorization scheme."], code: "Authorization: Bearer ${AGATA_API_KEY}" },
      { title: "Request example", code: "const response = await fetch(`${process.env.AGATA_API_BASE_URL}/api/v1/tenants`, {\n  headers: {\n    Authorization: `Bearer ${process.env.AGATA_API_KEY}`,\n    Accept: 'application/json'\n  }\n});\nif (!response.ok) {\n  throw new Error(`Agata API returned ${response.status}`);\n}\nconst tenants = await response.json();" },
      { title: "Resource groups", bullets: ["Identity, sessions, organizations, memberships and invitations.", "Tenants, policies, nodes and deployments.", "Verification runs and audit events.", "Developer API keys and outbound webhook endpoints/delivery history.", "Plan catalog and authenticated entitlement reads.", "Support requests and operational status routes exposed by the service."] },
      { title: "Response handling", bullets: ["401 — the session or API key is missing, invalid or revoked.", "403 — the caller is authenticated but lacks the required organization role or permission.", "402 — an entitlement or subscription gate rejected the operation.", "429 — the organization has reached a rate limit.", "5xx — investigate service logs and database/provider health before repeating a state-changing request."] },
      { title: "Request discipline", bullets: ["Keep API keys out of browser bundles, source control, shell history and logs.", "Check the actual OpenAPI schema for request fields and error shapes.", "Retry reads safely; check state before retrying a write after a timeout.", "Keep organization scope explicit and test cross-organization denial.", "Read after important writes and inspect audit evidence for security-sensitive changes."] },
    ],
    links: [{ label: "OpenAPI source", to: "https://github.com/Scarlet-Twinz/Agata-proxima/blob/main/control-plane/openapi.json", external: true }, { label: "Quickstart", to: "/developers/quickstart" }, { label: "Authentication", to: "/developers/authentication" }, { label: "Webhook guide", to: "/developers/webhooks" }],
  },
  "/docs/getting-started": {
    eyebrow: "Docs · Getting started",
    title: "Set up a test environment and prove the tenant boundary.",
    description: "Follow the steps in order. This guide is complete only when you have tested the real protected request path, not just created dashboard records.",
    sections: [
      { title: "Before you begin", bullets: ["Use a non-production environment and synthetic data for at least two tenants.", "Know the control-plane URL, the PostgreSQL instance used by the control plane and the application-to-Engine-to-PostgreSQL path being tested.", "Have an account with permission to create the resources needed for the test.", "Keep session cookies, API keys, database passwords, OIDC secrets and webhook secrets out of source control and browser code.", "Open the running service's OpenAPI reference so the request shapes match the version deployed."] },
      { title: "Step 1 — Sign in and confirm organization", paragraphs: ["Sign in through the supported login flow. Confirm the active organization and your role. If you are testing machine access, create an organization-scoped API key in the developer area, copy the secret once to a secure store and use it only from a trusted server-side client.", "Expected result: requests are authenticated and operate only within the intended organization. A 401 points to authentication; a 403 may indicate role authorization or a feature entitlement."] },
      { title: "Step 2 — Create test resources", paragraphs: ["Create a tenant for test customer A and a separate tenant for test customer B. Create or select the policy, node and deployment records required by your runtime setup. After each write, check the API response and read the resource back. Do not invent a resource if the relevant environment does not support that workflow."] },
      { title: "Step 3 — Configure the actual database path", paragraphs: ["Follow the deployment contract for the Proxima Engine version in use. Ensure the application connects through the intended protected path and that the PostgreSQL role has only the privileges required. Configure row-level security where it belongs in the design. A control-plane resource record does not prove that application queries pass through the Engine."] },
      { title: "Step 4 — Run the isolation tests", bullets: ["Perform one allowed operation on tenant A data and confirm success.", "Attempt to read tenant B data while authenticated and scoped to tenant A; confirm denial.", "Attempt to modify tenant B data from tenant A; confirm denial.", "Repeat with missing, malformed and expired tenant context where applicable.", "Check database roles and row-level security independently."] },
      { title: "Step 5 — Inspect evidence", paragraphs: ["Review verification results and audit events. Record the environment, build, timestamp, test identities, tenant identifiers, policy/deployment version, expected outcome, observed outcome and skipped checks. A skipped or untested case is not a pass."] },
      { title: "Completion criteria", bullets: ["The permitted tenant-local operation works.", "Cross-tenant reads and writes are rejected.", "Missing or malformed context is rejected as expected.", "The actual protected application-to-database path was exercised.", "Evidence and remaining gaps are recorded, and no secrets are included in the report."] },
    ],
    links: [{ label: "Customer integration guide", to: "/developers/quickstart" }, { label: "Verification checklist", to: "/docs/verification" }, { label: "Troubleshooting", to: "/docs/troubleshooting" }, { label: "API reference", to: "/docs/api-reference" }],
  },
  "/docs/core-concepts": {
    eyebrow: "Docs · Core concepts",
    title: "The concepts behind Proxima.",
    description: "Use a shared vocabulary for administrative scope, tenant context, enforcement intent, runtime placement and evidence.",
    sections: [
      { title: "Organization and tenant", paragraphs: ["An organization is the administrative boundary for membership and managed resources. A tenant is the customer/data boundary whose access must remain isolated. Do not treat these as interchangeable identifiers.", "The authenticated organization scope controls which administrative records a user can manage. The tenant context must independently represent the customer boundary for protected data operations."] },
      { title: "Policy, node and deployment", bullets: ["Policy: versioned enforcement intent that can be reviewed before rollout.", "Node: a registered enforcement target with environment and health information.", "Deployment: the relationship between desired state, a target and observed results.", "Verification: a controlled test of expected security behavior.", "Audit evidence: an inspectable record that helps explain what changed and what the system observed."] },
      { title: "Control plane versus Engine", paragraphs: ["The control plane is responsible for administration, configuration, orchestration and evidence. The Proxima Engine is the runtime enforcement boundary in the database request path.", "After deploying a policy, run verification against the protected request path to confirm the runtime behavior matches the configured intent."] },
      { title: "How the concepts connect", paragraphs: ["Authenticate the actor, establish organization scope, resolve tenant context, define policy intent, target a node, observe the deployment and test the resulting behavior. The evidence should make the outcome reviewable."] },
    ],
    links: [{ label: "Operating model", to: "/product/model" }, { label: "Policy lifecycle", to: "/developers/policies" }, { label: "API reference", to: "/docs/api-reference" }],
  },
  "/docs/api-reference": {
    eyebrow: "Docs · API reference",
    title: "API contracts and operational interfaces.",
    description: "Use the versioned control-plane API as the machine interface behind the console, while confirming exact schemas against the running service.",
    sections: [
      { title: "API surface", paragraphs: ["The control-plane API is versioned under `/api/v1`. In the current source, the route groups include tenants, policies, nodes, deployments, verifications, audit events, organization team and invitations, billing plan/entitlement reads, developer API keys and developer webhooks. The service's OpenAPI document and backend route handlers are the authoritative source for exact request and response schemas.", "Start with `GET /api/v1/health` to confirm the service responds, then read the OpenAPI document exposed by the deployed version. Use `GET /api/v1/billing/plans` for the public plan catalog and, after authentication, `GET /api/v1/billing/entitlements` for the active organization's actual plan and usage. These reads do not imply that paid checkout is configured."] },
      { title: "Authentication and scope", bullets: ["Use the supported authentication mechanism for the client type: human browser sessions and machine credentials have different lifecycle and handling requirements.", "Keep credentials server-side and out of browser bundles, logs, screenshots and source control.", "Use the active organization scope and the least-privileged role that supports the operation.", "Treat authorization failures as a boundary to investigate, not a reason to bypass access controls."] },
      { title: "Request handling", bullets: ["Validate input before sending it to the API.", "Handle expected 4xx responses as contract or authorization outcomes; do not blindly retry them.", "Use bounded retries for transient network and server failures where the operation is safe to retry.", "After a write, read the resulting resource and inspect verification or audit evidence where appropriate."] },
      { title: "Example — make an authenticated read", paragraphs: ["Create an API key in the authenticated developer area, then store it in your terminal environment or secret manager. The backend expects the key in a Bearer authorization header; do not include it in a browser bundle, source file or shared shell transcript."], code: `if ([string]::IsNullOrWhiteSpace($env:AGATA_BASE_URL)) { throw "AGATA_BASE_URL is not set to your control-plane URL" }
# Set AGATA_API_KEY from your secure local secret store; do not paste it into source code.
if ([string]::IsNullOrWhiteSpace($env:AGATA_API_KEY)) { throw "AGATA_API_KEY is not set" }
$headers = @{ Authorization = "Bearer $env:AGATA_API_KEY"; Accept = "application/json" }
$base = $env:AGATA_BASE_URL.TrimEnd('/')
Invoke-RestMethod -Method Get -Uri "$base/api/v1/tenants" -Headers $headers` },
      { title: "Reference discipline", paragraphs: ["Use the OpenAPI schema as the source for endpoint paths, methods, request fields and response shapes. Keep examples aligned with the API version deployed in your environment."] },
    ],
    links: [{ label: "Developer API reference", to: "/developers/api-reference" }, { label: "Authentication", to: "/developers/authentication" }, { label: "Troubleshooting", to: "/docs/troubleshooting" }],
  },
  "/docs/security": {
    eyebrow: "Docs · Security",
    title: "Security architecture and verification.",
    description: "Understand the threat boundary, layered controls and evidence required to evaluate tenant isolation.",
    sections: [
      { title: "Security objective", paragraphs: ["The central objective is to prevent a request associated with tenant A from reading or modifying tenant B's protected data through the supported deployment model. The application must not be able to bypass tenant enforcement simply by omitting or changing a client-controlled tenant value."] },
      { title: "Layered controls", bullets: ["Authenticate the actor and establish organization scope.", "Resolve tenant context from trusted application state.", "Verify signed tenant context at the Engine boundary.", "Apply database roles and PostgreSQL row-level security as complementary controls.", "Reject malformed, missing, expired or cross-tenant context according to the configured contract.", "Record verification and audit evidence that can be reviewed after a change."] },
      { title: "Failure modes and limits", paragraphs: ["A dashboard status, unit test or policy record alone cannot prove production isolation. The real application-to-Engine-to-PostgreSQL path must be exercised in the intended environment.", "Security depends on correct secret handling, database permissions, network configuration and deployment contracts as well as application code."] },
      { title: "How to review a change", bullets: ["Identify the threat or assumption the change affects.", "Test expected allows and expected blocks.", "Check the database policy independently where applicable.", "Inspect the resulting evidence and audit trail.", "Document remaining environment-specific acceptance work."] },
    ],
    links: [{ label: "Threat model", to: "/security" }, { label: "Verification model", to: "/docs/verification" }, { label: "Trust center", to: "/trust" }],
  },
  "/docs/operations": {
    eyebrow: "Docs · Operations",
    title: "Operate the control plane with evidence.",
    description: "Use explicit operational signals to understand service health, rollout state, verification results and changes over time.",
    sections: [
      { title: "The operational loop", bullets: ["Check health and readiness for the environment being operated.", "Review the active organization, environment and target resource.", "Inspect desired state before initiating a rollout.", "Observe the deployment result instead of assuming the request succeeded.", "Run verification after changes that can affect the isolation boundary.", "Review audit evidence and document any unresolved failure."] },
      { title: "Distinguish health from protection", paragraphs: ["A healthy HTTP endpoint confirms only the checks represented by that endpoint. It does not automatically prove that every provider, node, policy or production database connection is configured correctly.", "Treat readiness, integration configuration, observed runtime state and security verification as separate signals. Explain what each signal measures and what it does not measure."] },
      { title: "Incident investigation", bullets: ["Record the time, environment, affected organization and resource identifiers.", "Capture the error response and correlation identifiers without copying secrets or customer data unnecessarily.", "Compare recent policy, node and deployment changes.", "Inspect verification and audit history.", "Use the rollback or recovery procedure documented for that resource; do not improvise destructive database changes during an incident."] },
      { title: "Operational evidence", paragraphs: ["Keep runbooks, deployment records, verification results and incident notes aligned. A repeatable procedure is more useful than a green indicator whose meaning is unclear."] },
    ],
    links: [{ label: "Service status", to: "/status" }, { label: "Verification", to: "/docs/verification" }, { label: "Troubleshooting", to: "/docs/troubleshooting" }],
  },
  "/docs/troubleshooting": {
    eyebrow: "Docs · Troubleshooting",
    title: "Find the failing boundary before changing configuration.",
    description: "Use the observed status, resource, environment and event history to narrow a problem. Change one variable at a time and preserve sanitized evidence.",
    sections: [
      { title: "1. Sign-in fails or the console returns to login", bullets: ["Confirm the backend base URL and browser origin point to the intended environment.", "Check whether the session cookie exists and has not expired; sign in again rather than editing session storage manually.", "For write requests, inspect the CSRF response and ensure the frontend uses the supported client.", "For Microsoft Entra, confirm the feature is enabled for the organization's plan, the client ID/secret are present server-side, the registered callback exactly matches the deployed callback, and the OIDC state/correlation checks pass.", "Inspect server logs with timestamps and sanitized request IDs. Never log cookies, tokens or the client secret."] },
      { title: "2. API returns 401, 403, 402 or 5xx", bullets: ["401: authenticate again and verify that a machine key is active and not revoked.", "403: check organization membership, role permissions and feature entitlements. A valid identity does not imply authorization.", "402 or plan-limit response: inspect the authenticated entitlement endpoint and current usage; do not infer a plan from a frontend label.", "5xx: correlate the request timestamp with control-plane logs and database connectivity. Avoid repeating a state-changing request until you know whether the first attempt committed.", "Check the OpenAPI contract for the actual request body and response shape rather than guessing field names."] },
      { title: "3. A list or detail page is empty", bullets: ["Confirm the selected organization and route/resource ID.", "Check the network response status and response body in browser DevTools.", "Verify whether the resource exists in the backend; a valid empty array may mean nothing has been created yet.", "If a page shows a generic fallback for a route, record the URL and check whether that resource has a dedicated frontend component and API endpoint.", "Do not fill empty pages with static sample records to make them appear functional."] },
      { title: "4. Tenant, policy, node or deployment behavior is wrong", bullets: ["Confirm the tenant belongs to the expected organization and project.", "Compare the desired policy/deployment state with the observed state and target node.", "Confirm the Engine is in the actual application-to-PostgreSQL path; a control-plane record alone does not enforce database access.", "Run a controlled tenant-A positive test and tenant-B read/write negative tests.", "Check PostgreSQL role grants and RLS policies independently, then inspect verification and audit evidence."] },
      { title: "5. Webhook endpoint exists but receives nothing", bullets: ["Confirm the endpoint is enabled, subscribed to the event type and owned by the expected organization.", "Confirm the relevant event is actually emitted by the backend; creating an endpoint does not create an event.", "Check the delivery-history API for queued, delivering, failed, delivered or dead-letter records.", "Confirm the receiver is publicly reachable over HTTPS and responds within the configured timeout.", "Verify the HMAC signature against the exact raw request body and timestamp header; do not parse and re-serialize the JSON before checking the signature.", "Return a 2xx only after the receiver durably accepts the event. Make processing idempotent because delivery may be retried."] },
      { title: "6. Email verification, reset or support email fails", bullets: ["Confirm the server-side email configuration and sender identity for the target environment.", "Check the API result and backend logs for the specific workflow; successful login or support submission does not prove every email template was delivered.", "Check the recipient's spam/junk folder and provider delivery logs.", "For a support request, distinguish request persistence from requester-email and support-inbox delivery statuses when those are returned.", "Do not publish or paste API keys or provider credentials in support requests."] },
      { title: "7. Billing or plan features do not match", bullets: ["Load the current public plan catalog and the authenticated organization's entitlement response.", "Use the authenticated entitlement response to confirm the organization's active plan, features and usage.", "For a feature such as Entra OIDC, check the server-side entitlement and plan key rather than relying only on whether a button is visible.", "Preserve sanitized request and event identifiers when reporting a plan or access problem; never send secret keys."] },
      { title: "8. Database migration or startup fails", bullets: ["Read the first database error, not only the final startup message.", "Confirm the service is connected to the intended database and that the migration was applied to that database.", "Check whether a prior partial migration created some objects but failed before later statements; do not assume 'already exists' means the schema is complete.", "Take a backup before manual schema repair and use the repository's migration/repair procedure.", "Never test a restore by overwriting the live database."] },
      { title: "9. Docker Desktop and Compose startup failures", bullets: ["Start Docker Desktop and wait until the engine is running. Confirm the CLI can reach it with `docker version` and `docker compose version`.", "Run `docker compose ps -a` to see the actual service and container states. This repository's Compose service names are `postgres`, `proxima`, `control-postgres` and `proxima-control`; use service names rather than guessing container names.", "Inspect the first failing service with `docker compose logs --tail=200 proxima-control control-postgres`. If the output is empty, check `docker compose ps -a` first: a service that never created a container may have no logs.", "Check the required variables in the root `.env` file before starting the full stack. Compose requires the node enrollment and encryption keys and the Control Plane's configured environment values; do not paste real secrets into tickets or commit them.", "The Control Plane database is exposed on host port 55443 by default, while the API is exposed on port 8080. Check for port conflicts and inspect the actual mapping with `docker compose port control-postgres 5432` and `docker compose port proxima-control 8080`.", "Check PostgreSQL readiness with `docker compose exec control-postgres pg_isready -U proxima_control -d proxima_control`. A running container is not proof that PostgreSQL is ready or that migrations completed.", "Once the API starts, check `http://127.0.0.1:8080/api/v1/health` and `http://127.0.0.1:8080/api/v1/production/readiness`. Health confirms basic service/database availability; readiness checks the configured production requirements.", "If a Rust build fails, preserve the first compiler error and run `cargo fmt --all -- --check` followed by the failing crate's tests. Do not repeatedly rebuild without fixing the first reported error."] },
      { title: "10. What to include when escalating", paragraphs: ["Include the environment, timestamp and timezone, route or resource ID, expected behavior, observed behavior, relevant status code, sanitized request/correlation ID and the checks already performed. Redact tokens, cookies, API keys, webhook secrets, private keys and customer data. State clearly whether the issue is reproducible and whether the environment is local, staging or production."] },
    ],
    links: [{ label: "Open support", to: "/support/request" }, { label: "Operations guide", to: "/docs/operations" }, { label: "Verification", to: "/docs/verification" }, { label: "Webhook guide", to: "/developers/webhooks" }],
  },
  "/docs/node-enrollment": {
    eyebrow: "Documentation · Node enrollment",
    title: "Register, bootstrap and operate a Proxima node.",
    description: "Follow the complete one-time enrollment flow from the Command Center to the Engine process, including environment variables, identity persistence, token rotation and failure recovery.",
    sections: [
      { title: "Enrollment lifecycle", bullets: ["Register a node from App → Nodes in the intended organization.", "Copy the node UUID and one-time token when the Control Plane returns them.", "Set PROXIMA_NODE_ID, PROXIMA_NODE_ENROLLMENT_URL and PROXIMA_NODE_ENROLLMENT_TOKEN for the Engine process.", "Start the Engine. It calls POST /api/v1/nodes/enroll, validates the returned identity and writes the identity file.", "Keep the identity file private and reuse it on later Engine starts; the token is not reusable."] },
      { title: "Control Plane prerequisite", paragraphs: ["Set PROXIMA_NODE_ENROLLMENT_ENCRYPTION_KEY on the Control Plane. It must be 32 random bytes encoded as 64 hexadecimal characters. The key encrypts the generated node signing credential at rest and is separate from PROXIMA_TENANT_SIGNING_KEY."], code: "PowerShell: generate a 32-byte key\n$bytes = New-Object byte[] 32\n$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()\n$rng.GetBytes($bytes)\n$env:PROXIMA_NODE_ENROLLMENT_ENCRYPTION_KEY = [BitConverter]::ToString($bytes).Replace(\"-\", \"\").ToLowerInvariant()\n$rng.Dispose()" },
      { title: "PowerShell bootstrap", code: "$env:PROXIMA_NODE_ID = \"<node-uuid>\"\n$env:PROXIMA_NODE_ENROLLMENT_URL = \"https://<control-plane-host>/api/v1/nodes/enroll\"\n$env:PROXIMA_NODE_ENROLLMENT_TOKEN = \"<one-time-token>\"\n\n$env:PROXIMA_LISTEN_ADDR = \"127.0.0.1:6432\"\n$env:PROXIMA_UPSTREAM_ADDR = \"127.0.0.1:5432\"\ncargo run -p proxima-engine\n\nRemove-Item Env:PROXIMA_NODE_ENROLLMENT_TOKEN -ErrorAction SilentlyContinue" },
      { title: "Identity file", paragraphs: ["The default identity path is %LOCALAPPDATA%\\AgataProxima\\node-identity.json on Windows when LOCALAPPDATA exists, otherwise data/node-identity.json. Override it with PROXIMA_NODE_IDENTITY_PATH. The Engine reads an existing identity file before attempting enrollment; use a new path when enrolling another node on the same host."] },
      { title: "API and token rotation", bullets: ["POST /api/v1/nodes creates a pending node and returns its token once.", "POST /api/v1/nodes/{id}/enrollment-token rotates an unused eligible token; the replacement expires in 30 minutes.", "POST /api/v1/nodes/{id}/enrollment marks an organization-owned node as enrolling but does not consume the token.", "POST /api/v1/nodes/enroll is the bootstrap endpoint called by the Engine."] },
      { title: "Troubleshooting", bullets: ["401 from bootstrap: check the node UUID, token, expiry and single-use state.", "Credential encryption error: ensure PROXIMA_NODE_ENROLLMENT_ENCRYPTION_KEY is exactly 64 hex characters and reaches the Control Plane process.", "Missing environment variable: set all three enrollment variables in the Engine process together.", "Old identity loads: set PROXIMA_NODE_IDENTITY_PATH to a new path for the new node; preserve any identity you still need.", "Connection failure: verify the Control Plane URL, TLS certificate, routing and /api/v1/nodes/enroll path."] },
      { title: "CLI entry point", paragraphs: ["This repository does not provide a separate proxima-node enroll CLI. Run cargo run -p proxima-engine or the built Engine executable with the environment variables above. Node registration and token rotation use the authenticated Control Plane HTTP API."] },
    ],
    links: [{ label: "Full node enrollment runbook", to: "https://github.com/Scarlet-Twinz/Agata-proxima/blob/main/docs/node-enrollment.md", external: true }, { label: "API reference", to: "/developers/api-reference" }, { label: "Attestation and signed evidence", to: "https://github.com/Scarlet-Twinz/Agata-proxima/blob/main/docs/production/proxima-four-pillars.md", external: true }, { label: "Verification", to: "/docs/verification" }],
  },
  "/docs/verification": {
    eyebrow: "Docs · Verification",
    title: "Verify tenant isolation as a system property.",
    description: "Exercise both permitted and prohibited operations against the real protected path and retain evidence of what the environment actually did.",
    sections: [
      { title: "Minimum test matrix", bullets: ["A valid request for tenant A can perform an allowed tenant-A operation.", "A request for tenant A cannot read tenant B's protected rows.", "A request for tenant A cannot modify tenant B's protected rows.", "Missing tenant context is rejected.", "Malformed, invalid or expired context is rejected according to the contract.", "Database permissions and row-level security are tested independently where applicable."] },
      { title: "Test the actual path", paragraphs: ["Run tests through the application connection that points to the intended Proxima Engine and PostgreSQL environment. Unit tests and control-plane records are useful layers, but they do not replace end-to-end environment acceptance.", "Use non-production fixtures and deterministic test data. Confirm the test actor, tenant identities, policy version, node and database environment before interpreting the result."] },
      { title: "Evidence to retain", bullets: ["Environment and test timestamp.", "Policy/deployment version and target node.", "Test case, expected outcome and observed outcome.", "Failure response or evidence identifier, with secrets and unnecessary customer data removed.", "Any skipped checks, environment gaps or unresolved failures."] },
      { title: "Interpret results honestly", paragraphs: ["A passing result proves only the scenario and environment exercised. A skipped check is not a pass, and a repository test does not prove a hosted provider or external SaaS integration is configured correctly.", "Repeat the matrix after meaningful changes to tenant context, policy, Engine behavior, database permissions or deployment configuration."] },
    ],
    links: [{ label: "Product verification", to: "/product/verification" }, { label: "Security architecture", to: "/docs/security" }, { label: "Operations guide", to: "/docs/operations" }],
  },
  "/changelog/frontend-reconstruction": {
    eyebrow:"Changelog · October 2026", title:"Frontend reconstruction.", description:"The public experience is being rebuilt around explicit routes, real destinations and a dedicated public-site architecture.",
    sections:[{title:"What changed",bullets:["Public route architecture","Dedicated product and company pages","Developer and documentation surfaces","Support, status and trust surfaces","Navigation and footer destinations"]}],
    links:[{label:"Current changelog",to:"/changelog"},{label:"Developer platform",to:"/developers"}],
  },
  "/changelog/control-plane-foundation": {
    eyebrow:"Changelog · Platform", title:"Control-plane foundation.", description:"The backend foundation provides the authenticated control plane while preserving the Proxima Engine's independent enforcement boundary.",
    sections:[{title:"Foundation",bullets:["Organizations and membership","Tenant inventory","Versioned policies","Node enrollment","Deployment intent","Verification evidence","Append-only audit events","Support requests"]}],
    links:[{label:"Architecture",to:"/product/model"},{label:"Operations docs",to:"/docs/operations"}],
  },
};


const practicalSteps: Record<string, Section[]> = {
  "/product/model": [
    { title: "Trace one request through the model", bullets: ["Identify the authenticated user or service.", "Identify the organization that owns the administrative resource.", "Resolve the customer tenant from trusted application state.", "Trace the request through the intended Proxima Engine path to PostgreSQL.", "Run a positive and a cross-tenant negative test, then inspect evidence."] },
    { title: "What the model cannot prove alone", paragraphs: ["A diagram describes intended responsibilities. It does not prove that a deployment is wired to the Engine or that PostgreSQL privileges are correct. Verify the actual environment and document any untested path."] },
  ],
  "/product/enforcement": [
    { title: "Enforcement acceptance steps", bullets: ["Choose two synthetic tenants and one authenticated test actor for each.", "Confirm the actor's tenant context comes from trusted state rather than an unchecked request field.", "Attempt allowed access within the actor's tenant.", "Attempt read and write access to the other tenant and confirm denial.", "Repeat with missing or malformed context and confirm the failure is explicit."] },
    { title: "Failure behavior", paragraphs: ["Do not interpret a timeout, blank page or unrelated server error as a successful security denial. Record the expected denial response and inspect database state to confirm the prohibited operation had no effect."] },
  ],
  "/product/verification": [
    { title: "Run a useful verification", bullets: ["State the security claim being tested.", "Prepare deterministic data for at least two tenants.", "Run the permitted operation and record its expected success.", "Run the cross-tenant read/write attempts and record the expected denial.", "Save the test timestamp, environment, policy/deployment version and actual outcome."] },
    { title: "Interpretation", paragraphs: ["Verification evidence applies to the test case and environment exercised. It does not automatically cover other database paths, deployment regions or external services that were not tested."] },
  ],
  "/product/evidence": [
    { title: "Build an evidence record", bullets: ["Record which environment and software version were tested.", "Link the relevant organization, tenant, policy and deployment identifiers.", "Record the expected and observed outcomes, including denied cases.", "Include timestamps and sanitized request or event identifiers.", "Mark checks that were skipped or depend on an external environment as unverified."] },
    { title: "Evidence is not certification", paragraphs: ["Audit events and verification results support investigation and review; they do not, by themselves, establish a formal certification, independent audit or compliance status."] },
  ],
  "/solutions/b2b-saas": [
    { title: "Practical adoption sequence", bullets: ["Map customer organizations to application tenants.", "List every database path that reads or writes customer-owned records.", "Choose a representative service and protect its path first in a non-production environment.", "Test cross-tenant reads and writes and inspect evidence.", "Expand only after the first path passes and the deployment procedure is repeatable."] },
  ],
  "/solutions/enterprise-saas": [
    { title: "Questions to answer in an enterprise evaluation", bullets: ["Which identity provider and organization mapping are required?", "Which data stores and services are in the protected path?", "What evidence, retention, deployment and recovery requirements must be met?", "Which environment-specific tests are required before production?", "Which contractual requirements need a separately reviewed agreement?"] },
  ],
  "/solutions/developer-platforms": [
    { title: "Integration checklist", bullets: ["Define the trusted source of tenant context.", "Use the documented control-plane API and least-privileged credentials.", "Test authorization at each service boundary.", "Verify that background jobs and webhooks preserve organization/tenant scope.", "Test denied access and duplicate event handling before automating business actions."] },
  ],
  "/solutions/security-sensitive": [
    { title: "Acceptance before production", bullets: ["Document the threat model and trust boundaries.", "Test both permitted and prohibited database operations.", "Review database roles and RLS independently.", "Exercise secret rotation, credential revocation and recovery paths.", "Record evidence and unresolved limitations; do not replace missing evidence with a status badge."] },
  ],
  "/solutions/startups": [
    { title: "A small-team starting plan", bullets: ["Start with two synthetic tenants and one protected data path.", "Document where tenant identity is resolved and validated.", "Add a negative cross-tenant test to the normal verification workflow.", "Keep database privileges narrow and secrets out of the repository.", "Expand the protected surface gradually and retest after changes."] },
  ],
  "/solutions/platform-engineering": [
    { title: "Platform rollout sequence", bullets: ["Choose one service as a pilot and name the owner of each layer.", "Define the control-plane resources and deployment target.", "Automate repeatable positive and negative tests.", "Make evidence and failure diagnostics available to operators.", "Define rollback and incident procedures before broad rollout."] },
  ],
  "/developers/organizations": [
    { title: "Organization-scoped workflow", bullets: ["Sign in and confirm the active organization.", "Check the caller's role before creating or modifying resources.", "Create resources only in the intended organization.", "Use the organization team/invitation screens to grant least-privileged access.", "Test that a user without membership cannot inspect the organization's resources."] },
    { title: "Organization is not tenant", paragraphs: ["Organization membership controls administrative access. Application tenant context controls which customer's data a request may touch. Do not reuse one identifier as a substitute for the other without an explicit, tested mapping."] },
  ],
  "/developers/tenant-context": [
    { title: "Implement and test tenant context", bullets: ["Authenticate the caller first.", "Resolve tenant membership from trusted server-side state or a verified identity claim.", "Reject unknown or unauthorized tenant identifiers before querying protected data.", "Pass context through every relevant request, background job and database transaction.", "Test a valid request, cross-tenant read, cross-tenant write and missing-context request."] },
    { title: "Common mistakes", bullets: ["Trusting a tenant ID supplied by the browser without checking membership.", "Applying a tenant filter in one query but omitting it in another.", "Losing context in asynchronous jobs or webhook processing.", "Treating an empty result as proof that access was correctly denied without checking the operation and database state."] },
  ],
  "/developers/policies": [
    { title: "Policy workflow", bullets: ["Draft the intended rule and state the threat it addresses.", "Review the policy change before rollout.", "Associate it with the intended environment and deployment target.", "Apply the change using the supported deployment workflow.", "Run positive and negative verification cases.", "Record the policy/deployment version and evidence before declaring acceptance."] },
    { title: "Rollback discipline", paragraphs: ["If verification fails, stop the rollout and use the documented recovery path. Do not edit live database state by hand without a backup, a reviewed plan and a clear understanding of the impact."] },
  ],
  "/developers/fleet": [
    { title: "Node lifecycle checklist", bullets: ["Register the node in the intended organization and environment.", "Protect enrollment tokens and rotate or revoke them when trust is lost.", "Confirm health from the actual node/runtime rather than assuming a registry row means it is online.", "Associate the intended deployment with the correct target.", "Run verification after a rollout and record the observed result."] },
  ],
  "/developers/deployments": [
    { title: "Deployment checklist", bullets: ["Review the desired policy/configuration and target node.", "Confirm the target environment and current observed state.", "Initiate the supported deployment operation.", "Inspect the result and verify the runtime actually received the intended state.", "Run tenant-isolation tests and check audit evidence.", "If the result is wrong, stop further rollout and follow the documented recovery procedure."] },
  ],
  "/developers/verification": [
    { title: "Test-case procedure", bullets: ["Name the claim and expected result before running the test.", "Use deterministic synthetic data and known tenant identities.", "Run the positive case first to prove the test is configured correctly.", "Run cross-tenant and invalid-context cases.", "Inspect the persisted result and underlying data state.", "Record the environment and unresolved gaps."] },
  ],
  "/developers/audit": [
    { title: "Investigate an event", bullets: ["Start with a time window and the affected organization/resource.", "Filter by the event family or resource ID where supported.", "Compare the event with the corresponding change or verification result.", "Correlate with service logs using sanitized request IDs.", "Record what the event proves and what still needs independent verification."] },
  ],
  "/developers/events": [
    { title: "Consume events safely", bullets: ["Subscribe only to the event families the integration needs.", "Verify the signature over the original raw body.", "Validate the event type and payload schema.", "Persist the event/delivery identifier before applying side effects.", "Handle duplicate delivery idempotently and expose failures for investigation."] },
  ],
  "/docs/core-concepts": [
    { title: "Use the concepts in sequence", bullets: ["Organization: decide who may administer resources.", "Tenant: identify whose application data is being accessed.", "Policy: describe the intended enforcement behavior.", "Node and deployment: identify where the intended behavior should run.", "Verification: test whether the behavior matches the expectation.", "Audit: retain context that helps explain what changed and when."] },
  ],
  "/docs/operations": [
    { title: "Daily operator checklist", bullets: ["Check health and readiness for the correct environment.", "Review deployment failures and unhealthy nodes.", "Inspect verification failures and audit events since the previous review.", "Check database backup age and recent restore-test evidence.", "Check email, billing-provider and webhook delivery signals from their actual provider/service logs.", "Escalate repeated failures with timestamps and sanitized identifiers."] },
    { title: "Recovery order", bullets: ["Stabilize the affected service and stop risky rollout activity.", "Preserve logs and relevant evidence.", "Identify the last known good configuration and data backup.", "Use a reviewed rollback/recovery procedure in a safe environment first.", "Verify the service and security boundary after recovery, then document the incident."] },
  ],
};


const publicSidebars = {
  product: [
    ["Overview","/product"],["Operating model","/product/model"],["Enforcement","/product/enforcement"],["Verification","/product/verification"],["Evidence","/product/evidence"],
  ],
  developers: [
    ["Developer home","/developers"],["Quickstart","/developers/quickstart"],["Downloads","/developers/downloads"],["Node.js","/developers/nodejs"],["Authentication","/developers/authentication"],["Organizations","/developers/organizations"],["Tenant context","/developers/tenant-context"],["Policies","/developers/policies"],["Fleet","/developers/fleet"],["Deployments","/developers/deployments"],["Verification","/developers/verification"],["Audit","/developers/audit"],["Webhooks","/developers/webhooks"],["Events","/developers/events"],["SDKs","/developers/sdks"],["CLI","/developers/cli"],["Terraform","/developers/terraform"],["API reference","/developers/api-reference"],["Integration catalog","/developers/integrations"],["ChatGPT / MCP","/developers/integrations/chatgpt"],["Supabase","/developers/integrations/supabase"],["Firebase","/developers/integrations/firebase"],["GitHub Actions","/developers/integrations/github"],["Vercel","/developers/integrations/vercel"],["PostgreSQL + RLS","/developers/integrations/postgresql"],
  ],
  docs: [
    ["Documentation home","/docs"],["Getting started","/docs/getting-started"],["Core concepts","/docs/core-concepts"],["API reference","/docs/api-reference"],["Security","/docs/security"],["Operations","/docs/operations"],["Troubleshooting","/docs/troubleshooting"],["Verification","/docs/verification"],
  ],
  security: [
    ["Security overview","/security"],["Security architecture","/docs/security"],["Verification model","/docs/verification"],["Trust center","/trust"],["Status","/status"],["Contact security","/contact"],
  ],
};

// Every destination in the public navigation resolves to a documented detail surface.
export function PublicDetail() {
  const { pathname } = useLocation();
  const detail = details[pathname] ?? {
    eyebrow:"Agata Proxima",
    title:"Page not found",
    description:"The requested public destination does not exist.",
    sections:[{title:"Continue exploring",paragraphs:["Use the public navigation or return to the homepage."]}],
    links:[{label:"Home",to:"/"},{label:"Support",to:"/support"}],
  };
  const renderedSections = [...detail.sections, ...(practicalSteps[pathname] ?? [])];

  return (
    <PublicPage eyebrow={detail.eyebrow} title={detail.title} description={detail.description}>
      <section className="public-content">
        <div className="agata-container">
          <div className="public-detail-layout">
            <aside className="public-detail-sidebar">
              <div className="public-detail-sidebar-title">Explore this area</div>
              {(pathname.startsWith("/developers") ? publicSidebars.developers :
                pathname.startsWith("/docs") ? publicSidebars.docs :
                pathname.startsWith("/security") ? publicSidebars.security :
                publicSidebars.product).map(([label,to]) => (
                <Link key={to} to={to} className={pathname===to?"is-active":""}>{label}</Link>
              ))}
            </aside>
            <article className="public-prose">
              {renderedSections.map((section) => (
                <section key={section.title} className="public-detail-section">
                  <h2>{section.title}</h2>
                  {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                  {section.bullets && <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}
                  {section.code && <pre className="public-code"><code>{section.code}</code></pre>}
                </section>
              ))}
              {detail.links && (
                <div className="public-detail-links">
                  {detail.links.map((item) =>
                    item.external ? (
                      <a key={item.label} href={item.to} target="_blank" rel="noreferrer" className="agata-button agata-button-secondary">
                        {item.label}<ExternalLink size={15} />
                      </a>
                    ) : (
                      <Link key={item.label} to={item.to} className="agata-button agata-button-secondary">{item.label}</Link>
                    ),
                  )}
                </div>
              )}
            </article>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
