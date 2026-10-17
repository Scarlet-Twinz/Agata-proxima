import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowUpRight, CheckCircle2, ChevronRight, Copy, ExternalLink, KeyRound, RefreshCw, Save, Search, ShieldCheck } from "lucide-react";
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
    intro:"A tenant ID identifies the customer boundary for an operation. Resolve it from trusted application state and keep it bound to authorization and the protected database request.",
    sections:[
      {title:"Request flow",body:"Authenticate the user or service first. Resolve the organization from the authenticated identity, then resolve the tenant from a trusted membership or account mapping. Authorize the operation against that membership and pass the verified tenant context into the configured Proxima request path.",code:"Authenticated identity → organization membership → tenant membership → policy decision → Proxima Engine → PostgreSQL"},
      {title:"Never trust a raw tenant ID",body:"A tenant ID supplied by a browser, URL or request body is a selector, not proof of access. Check that the authenticated principal is permitted to act on that tenant on every request. Do not allow a caller to switch tenants merely by changing an ID."},
      {title:"Test the boundary",body:"Use two synthetic tenants. Confirm tenant A can perform an allowed operation on A, then confirm reads and writes against B are rejected. Repeat with missing and invalid context. Test the real protected data path; a dashboard verification record is evidence storage and does not execute those application requests by itself."},
      {title:"Record evidence",body:"When saving a verification record, select the tenant from the tenant dropdown. The tenant must belong to the active organization. Record the actual checks and observed outcomes in the evidence JSON; do not mark a test passed if it was not executed."}
    ],
  },
  "/app/developer/service-accounts": {
    title:"Service accounts and machine access",
    intro:"Use organization-scoped API keys for server-to-server integrations. The current API exposes API keys as the machine-credential resource; it does not create a separate service-account object.",
    sections:[
      {title:"Create a machine credential",body:"Open Developer → API keys → Create API key. Give the key a purpose-specific name, copy the secret when it is shown, and store it in your deployment secret manager. The full key is only shown at creation time.",code:"AGATA_API_BASE_URL=https://api.agataproxima.com\nAGATA_API_KEY=aga_<your-key>"},
      {title:"Use least privilege",body:"Create a different key for each integration or runtime. Restrict access to the organization that owns the resources, remove keys that are no longer used, and rotate credentials immediately after suspected exposure."},
      {title:"Verify access",body:"Call the health endpoint and then a read endpoint such as the tenant list. A 401 means the credential is missing, invalid or revoked; a 403 means the authenticated identity lacks permission or entitlement. Never paste a key into browser code, issue trackers or logs.",code:"curl --fail-with-body -H \"Authorization: Bearer $AGATA_API_KEY\" \"$AGATA_API_BASE_URL/api/v1/tenants\""},
      {title:"Credential lifecycle",body:"Use Developer → API keys to inspect and revoke credentials. Use this page as the service-account integration guide; it does not imply that a separate service-account database record or role-assignment workflow exists."}
    ],
  },
  "/app/developer/authentication": {
    title:"API authentication",
    intro:"Authenticate human users with dashboard sessions and server-side integrations with organization-scoped API keys.",
    sections:[
      {title:"Server-to-server requests",body:"Create an API key in Developer → API keys and store it in a server-side secret manager. Send it as a Bearer token on API requests. Do not put it in VITE_ variables, browser bundles or source control.",code:"$env:AGATA_API_BASE_URL = \"https://api.agataproxima.com\"\n$env:AGATA_API_KEY = \"aga_LOAD_FROM_YOUR_SECRET_STORE\"\n$headers = @{ Authorization = \"Bearer $env:AGATA_API_KEY\"; Accept = \"application/json\" }\nInvoke-RestMethod \"$($env:AGATA_API_BASE_URL)/api/v1/health\" -Headers $headers"},
      {title:"Browser sessions and CSRF",body:"Dashboard sign-in uses an HTTP-only session cookie. State-changing browser requests must include the CSRF token supplied by the session contract. Do not copy session cookies into scripts or use a human session as a machine credential."},
      {title:"HTTP error handling",body:"Handle 401 as an authentication failure, 403 as a permission or entitlement failure, 404 as a missing or out-of-scope resource, 409 as a conflict, 429 as a quota/rate limit, and 5xx as a service-side failure. Preserve the request ID when present and retry only safe or idempotent operations."},
      {title:"Microsoft Entra ID",body:"Enterprise OIDC is configured separately under Settings → Authentication. Confirm the provider registration, callback URL, organization mapping and deployment secrets before relying on SSO. A saved tenant mapping alone is not an end-to-end sign-in test."}
    ],
  },
  "/app/developer/events": {
    title:"Events and audit delivery",
    intro:"Use the audit log for organization-scoped history and webhooks to deliver selected audit events to systems you operate.",
    sections:[
      {title:"Audit history",body:"The authenticated audit endpoint returns recent organization-scoped records. Use it to investigate resource changes and security-relevant actions; do not treat the audit log as a substitute for application-level business events.",code:"curl --fail-with-body -H \"Authorization: Bearer $AGATA_API_KEY\" \"$AGATA_API_BASE_URL/api/v1/audit\""},
      {title:"Webhook subscriptions",body:"Open Developer → Webhooks, add an HTTPS endpoint and select * for all supported audit actions or enter exact action names separated by commas. Keep the signing secret in the receiver's secret store and verify the HMAC-SHA256 signature over the exact raw request body before parsing JSON."},
      {title:"Receiver requirements",body:"Return a successful 2xx response only after the event has been durably accepted. Deduplicate repeated deliveries by event or delivery identifier, make processing idempotent, and log sanitized error details. Expect retries and handle duplicate delivery safely."},
      {title:"Investigate delivery failures",body:"Open a webhook's Delivery history to inspect status, attempt count, HTTP response and last error. Retry only after correcting the receiver or transient failure. Rotate the signing secret if it may have been exposed, and update the receiver immediately."}
    ],
  },
  "/app/developer/environments": {
    title:"Environment configuration",
    intro:"Create and manage named development, staging and production environments inside the active organization. The backend stores environment records and uses the registry when registering nodes.",
    sections:[
      {title:"Set the API origin per environment",body:"Use the environment registry to name the stage and configure each runtime to the correct Control Plane origin in its deployment settings. Creating a dashboard environment does not itself create a separate API deployment.",code:"$env:AGATA_API_BASE_URL = \"https://api.agataproxima.com\"\n# Set this to the actual local or staging API origin when testing those environments."},
      {title:"Separate credentials and data",body:"API keys and webhook subscriptions are currently organization-scoped rather than environment-scoped. Use purpose-specific keys and receiver destinations per stage, keep each secret in that stage’s server-side secret store, and never place secrets in browser code."},
      {title:"Node and deployment metadata",body:"Node registration resolves the selected environment slug against this organization’s environment registry. Disabled environments cannot receive new node registrations. The registry does not by itself isolate networks, databases or secrets."},
      {title:"Before release",body:"Check the target API origin, key ownership, tenant membership, policy version, node state and deployment result. Run positive and negative tenant-isolation tests against the intended environment before routing customer traffic."}
    ],
  },
  "/app/developer/sdks": {
    title:"JavaScript SDK",
    intro:"Use the separately packaged server-side JavaScript SDK in packages/javascript-sdk. It has contract tests and a tag-gated npm release workflow, but the public package has not yet been published.",
    sections:[
      {title:"Requirements and installation",body:"Use Node.js 22 or newer. Test and package the SDK from its own directory. Until an authorized npm release is published, install the generated tarball or use the repository source.",code:"cd packages/javascript-sdk\nnpm test\nnpm pack"},
      {title:"Configure credentials",body:"Create an API key in Developer → API keys. Store it in a secret manager or local environment variable for development. Never include the key in frontend code or commit it to Git.",code:"$env:AGATA_API_BASE_URL = \"https://api.agataproxima.com\"\n$env:AGATA_API_KEY = \"aga_LOAD_FROM_A_SECRET_STORE\""},
      {title:"Make your first request",body:"The package exposes health, plans, tenant, policy, node, deployment, verification and audit methods, plus environment and webhook lifecycle methods. Server-side API authorization remains authoritative. Creating a verification record stores evidence; it does not run a runtime isolation test.",code:"import { AgataClient } from \"@agata-proxima/sdk\";\n\nconst agata = new AgataClient();\nconsole.log(await agata.health());\nconsole.log(await agata.listEnvironments());"},
      {title:"Handle API errors",body:"Catch AgataApiError to inspect status, error code and request ID. Refresh credentials for 401, review roles and entitlements for 403, check the resource ID and organization for 404, and respect quota or rate-limit responses. Avoid blind retries for writes.",code:"import { AgataClient, AgataApiError } from \"./node/agata-client.mjs\";\n\ntry {\n  console.log(await new AgataClient().listTenants());\n} catch (error) {\n  if (error instanceof AgataApiError) {\n    console.error(error.status, error.code, error.requestId, error.message);\n  } else { throw error; }\n}"},
      {title:"Client source and contract",body:"Review packages/javascript-sdk/src/index.mjs for the packaged SDK and download-kit/node/agata-client.mjs for the integration-kit client. The npm release workflow runs only on an sdk-v* tag and requires an authorized NPM_TOKEN secret."}
    ],
  },
  "/app/developer/cli": {
    title:"Agata command-line interface",
    intro:"The integration starter kit includes a Node.js CLI for API checks, resource listings, environment CRUD and webhook lifecycle operations. It is source-distributed, not a precompiled standalone binary.",
    sections:[
      {title:"Install and configure",body:"Use Node.js 22 or newer. Extract the starter kit, install dependencies and set the API origin and organization-scoped API key in your terminal.",code:"cd download-kit\nnpm install\n$env:AGATA_API_BASE_URL = \"https://api.agataproxima.com\"\n$env:AGATA_API_KEY = \"aga_LOAD_FROM_A_SECRET_STORE\""},
      {title:"Run the CLI",body:"Run the CLI through the npm script. These commands call the actual versioned API endpoints and print the JSON response. The verification command lists saved verification records; it does not execute a tenant-isolation test.",code:"npm run cli -- --help\nnpm run cli -- whoami\nnpm run cli -- health\nnpm run cli -- tenants list\nnpm run cli -- audit list\nnpm run cli -- environments list\nnpm run cli -- environments create --name Staging --slug staging\nnpm run cli -- environments disable <environment-id>\nnpm run cli -- webhooks list\nnpm run cli -- webhooks deliveries <webhook-id>\nnpm run cli -- webhooks disable <webhook-id>"},
      {title:"Install the agata command (optional)",body:"For a developer workstation where a local executable is useful, install the extracted package globally from its folder. The command uses the same environment variables and read-only command set.",code:"npm link\nagata whoami\nagata health\nagata tenants list\nagata verification list\nagata environments list"},
      {title:"Exit codes and troubleshooting",body:"Exit code 0 means the request completed successfully. Invalid command or missing arguments return exit code 2. API/network/configuration failures return exit code 1 and print the HTTP status when available. A 401 usually means the key is missing, invalid or revoked; a 403 indicates access or entitlement; a 429 indicates a quota or rate limit."},
      {title:"Command implementation",body:"The executable is download-kit/cli/bin/agata.mjs and uses download-kit/node/agata-client.mjs. Writes are limited to explicit environment and webhook commands; service-account and API-key administration stays in the authenticated dashboard. Review destructive commands and confirm the target organization before running them."}
    ],
  },
  "/app/developer/terraform": {
    title:"Terraform and infrastructure as code",
    intro:"A real Terraform provider source now exists in terraform-provider-agata/. It currently manages the environment resource through the Control Plane API. The provider is not yet published to the Terraform Registry, and it does not provision databases, networks or service accounts.",
    sections:[
      {title:"What is available today",body:"The source provider implements agata_environment CRUD and has Go tests. Build and test it from terraform-provider-agata/. Registry installation must wait for a reviewed release; do not assume unsupported resources exist."},
      {title:"Provider release requirements",body:"Before registry release, validate provider packaging, import and drift behavior, environment quota handling, destructive-delete failures for referenced environments, checksums and release artifacts. The API key remains sensitive and should be supplied from a secret store."},
      {title:"Safe automation boundary",body:"Keep API keys in the CI secret store and never put them in Terraform state, plan output or committed variables. Use a dedicated test organization and synthetic data for acceptance tests. Do not run destructive tests against the production organization."},
      {title:"Acceptance checklist",body:"Before adopting a provider, verify create/read/update/delete behavior for every supported resource, import of existing resources, drift detection, API error mapping, retries, organization isolation and documented upgrade behavior. Until a provider is released, call the documented API from a controlled deployment step rather than declaring unsupported Terraform resources."}
    ],
  },
  "/app/developer/api-reference": {
    title:"Control Plane API reference",
    intro:"The dashboard and server integrations use the versioned /api/v1 HTTP API. Use the running service's OpenAPI document as the exact schema and response contract.",
    sections:[
      {title:"Base URL and authentication",body:"Set the API origin for the environment you intend to use. Send an organization-scoped API key in the Authorization header for server-to-server requests. Keep keys out of browser bundles, source control and logs.",code:"$env:AGATA_API_BASE_URL = \"https://api.agataproxima.com\"\n$env:AGATA_API_KEY = \"aga_LOAD_FROM_A_SECRET_STORE\"\n$headers = @{ Authorization = \"Bearer $env:AGATA_API_KEY\"; Accept = \"application/json\" }"},
      {title:"Inspect the OpenAPI schema",body:"Open the OpenAPI document served by the API environment you are using. It describes the routes and schemas exposed by that running build; do not copy an endpoint from another version without checking it.",code:"Invoke-RestMethod \"$($env:AGATA_API_BASE_URL)/docs/openapi.json\" | ConvertTo-Json -Depth 8"},
      {title:"Common read endpoints",body:"Use these endpoints to check connectivity and inspect organization-scoped resources. The authenticated key and role determine which resources are visible.",code:"Invoke-RestMethod \"$($env:AGATA_API_BASE_URL)/api/v1/health\" -Headers $headers\nInvoke-RestMethod \"$($env:AGATA_API_BASE_URL)/api/v1/tenants\" -Headers $headers\nInvoke-RestMethod \"$($env:AGATA_API_BASE_URL)/api/v1/verifications\" -Headers $headers\nInvoke-RestMethod \"$($env:AGATA_API_BASE_URL)/api/v1/audit\" -Headers $headers"},
      {title:"HTTP response handling",body:"Use HTTP status and response body to distinguish authentication, authorization, missing resources, validation, conflict, quota and server failures. Preserve any request ID for support. Retry safe GETs on transient failures with bounded backoff; do not blindly repeat writes after a timeout."},
      {title:"Tenant isolation",body:"Every tenant-specific request must be authorized against the active organization and the tenant's ownership/membership. A tenant ID in a request is not proof of permission. Use two synthetic tenants to validate both allowed and denied access paths."}
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
  const [copied,setCopied]=useState("");
  const [copyError,setCopyError]=useState("");
  async function copyCode(title:string,code:string){
    setCopyError("");
    try{await navigator.clipboard.writeText(code);setCopied(title);}
    catch{setCopyError("Clipboard access was blocked. Select the code and copy it manually.");}
  }
  return <ContextShell config={config}>
    <div className="page-heading"><div><span className="eyebrow">{config.eyebrow}</span><h1>{doc.title}</h1><p>{doc.intro}</p></div></div>
    {doc.sections.map(section=><section className="surface context-doc-section" key={section.title}>
      <h2>{section.title}</h2><p>{section.body}</p>
      {section.code&&<div className="context-code-panel">
        <div className="context-code-toolbar"><span>Example</span><button type="button" className="console-refresh-button" onClick={()=>void copyCode(section.title,section.code!)}><Copy size={14}/>{copied===section.title?"Copied":"Copy code"}</button></div>
        <pre className="context-code">{section.code}</pre>
      </div>}
    </section>)}
    {copyError&&<p className="settings-banner settings-banner--error" role="status">{copyError}</p>}
    <div className="context-next"><Link to="/app/developer/api-reference">Open API reference <ArrowUpRight size={15}/></Link><Link to="/app/developer/webhooks">Configure webhooks <ArrowUpRight size={15}/></Link><Link to="/docs">Open public documentation <ExternalLink size={15}/></Link></div>
  </ContextShell>;
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
 "/app/developer/service-accounts":{eyebrow:"DEVELOPER",title:"Service accounts",description:"Manage machine identities and linked API-key lifecycle.",tabs:developerTabs,endpoint:"/api/v1/developer/service-accounts"},
 "/app/developer/events":{eyebrow:"DEVELOPER",title:"Event and audit stream",description:"Inspect persisted organization audit events and the event records that feed webhook delivery.",tabs:developerTabs,endpoint:"/api/v1/audit",detailBase:"/app/audit"},
 "/app/developer/webhooks":{eyebrow:"DEVELOPER",title:"Webhooks",description:"Create endpoints, select events and inspect delivery history.",tabs:developerTabs,endpoint:"/api/v1/developer/webhooks",detailBase:"/app/developer/webhooks",createHref:"/app/developer/webhooks/new",createLabel:"Add webhook"},
 "/app/developer/environments":{eyebrow:"DEVELOPER",title:"Environments",description:"Create and manage development, staging and production stages within the active organization.",tabs:developerTabs},
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
  service_account_id?: string | null;
  service_account_name?: string | null;
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
                  {key.service_account_name && <span>Service account: {key.service_account_name}</span>}
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



type OpenApiOperation = {summary?:string;description?:string;responses?:Record<string,{description?:string}>};
type OpenApiDocument = {info?:{title?:string;version?:string;description?:string};paths?:Record<string,Record<string,OpenApiOperation>>};

function ApiReferenceExplorer(){
  const [spec,setSpec]=useState<OpenApiDocument|null>(null);
  const [query,setQuery]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{let active=true;api.get<OpenApiDocument>("/docs/openapi.json").then(value=>{if(active)setSpec(value);}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Unable to load the OpenAPI document.");}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
  const operations=useMemo(()=>Object.entries(spec?.paths??{}).flatMap(([path,methods])=>Object.entries(methods).filter(([method])=>["get","post","put","patch","delete","head","options"].includes(method.toLowerCase())).map(([method,op])=>({path,method:method.toUpperCase(),...op}))).filter(op=>(op.path+" "+op.method+" "+(op.summary??"")+" "+(op.description??"")).toLowerCase().includes(query.trim().toLowerCase())),[spec,query]);
  return <div className="resource-page"><div className="page-heading"><div><span className="eyebrow">DEVELOPER · LIVE SPECIFICATION</span><h1>API reference</h1><p>Endpoint inventory is loaded from the repository's OpenAPI document served by the control plane, not hard-coded into this screen.</p></div><a className="console-refresh-button" href="/docs/openapi.json" target="_blank" rel="noreferrer">Open raw OpenAPI JSON</a></div>
    {loading&&<div className="surface empty-state"><strong>Loading OpenAPI specification…</strong></div>}
    {error&&<div className="settings-banner settings-banner--error" role="alert">{error}</div>}
    {spec&&<><section className="surface environment-boundary-note"><span className="eyebrow">{spec.info?.title??"OpenAPI"}</span><h2>Version {spec.info?.version??"unknown"} · {operations.length} matching operations</h2><p>{spec.info?.description??"API specification loaded from the running control plane."}</p></section>
      <label className="resource-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search method, endpoint or description" aria-label="Search API operations"/></label>
      <div className="environment-record-list">{operations.map((op)=><article className="surface environment-record-card" key={op.method+" "+op.path}><div className="webhook-endpoint-heading"><div><span className="eyebrow">{op.method}</span><h2><code>{op.path}</code></h2></div></div><p><strong>{op.summary??"Endpoint"}</strong></p>{op.description&&<p>{op.description}</p>}<p className="webhook-endpoint-meta">Responses: {Object.entries(op.responses??{}).map(([status,value])=>status+" "+(value.description??"")).join(" · ")||"See API response schema"}</p></article>)}</div>
      {!operations.length&&<div className="surface empty-state"><strong>No matching endpoints.</strong><span>Try another path or method.</span></div>}
    </>}
  </div>;
}

type ServiceAccountRecord = {id:string;name:string;description:string;environment_id:string|null;environment_name:string|null;status:"active"|"disabled";active_key_count:number;created_at:string;updated_at:string};

function ServiceAccountsManager(){
  const [items,setItems]=useState<ServiceAccountRecord[]>([]);
  const [envs,setEnvs]=useState<Array<{id:string;name:string;slug:string;status:string}>>([]);
  const [name,setName]=useState("");const [description,setDescription]=useState("");const [environmentId,setEnvironmentId]=useState("");
  const [loading,setLoading]=useState(true);const [busy,setBusy]=useState("");const [error,setError]=useState("");const [notice,setNotice]=useState("");
  const load=useCallback(async()=>{setLoading(true);setError("");try{const [a,e]=await Promise.all([api.get<ServiceAccountRecord[]>("/api/v1/developer/service-accounts"),api.get<Array<{id:string;name:string;slug:string;status:string}>>("/api/v1/developer/environments")]);setItems(a);setEnvs(e);}catch(x){setError(x instanceof Error?x.message:"Unable to load service accounts.");}finally{setLoading(false);}},[]);
  useEffect(()=>{void load();},[load]);
  async function create(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy("create");setError("");setNotice("");try{const a=await api.post<ServiceAccountRecord>("/api/v1/developer/service-accounts",{name:name.trim(),description:description.trim(),...(environmentId?{environment_id:environmentId}:{})});setNotice("Service account "+a.name+" created. Create an API key linked to it.");setName("");setDescription("");setEnvironmentId("");await load();}catch(x){setError(x instanceof Error?x.message:"Unable to create service account.");}finally{setBusy("");}}
  async function toggle(a:ServiceAccountRecord){const status=a.status==="active"?"disabled":"active";if(status==="disabled"&&!window.confirm("Disable "+a.name+"? Its linked API keys will stop authenticating."))return;setBusy(a.id);setError("");try{await api.patch("/api/v1/developer/service-accounts/"+a.id,{status});setNotice("Service account "+status+".");await load();}catch(x){setError(x instanceof Error?x.message:"Unable to update service account.");}finally{setBusy("");}}
  async function remove(a:ServiceAccountRecord){if(!window.confirm("Delete "+a.name+" and revoke every linked API key?"))return;setBusy(a.id);setError("");try{await api.delete("/api/v1/developer/service-accounts/"+a.id);setNotice("Service account deleted; linked keys revoked.");await load();}catch(x){setError(x instanceof Error?x.message:"Unable to delete service account.");}finally{setBusy("");}}
  return <div className="resource-page">
    <div className="page-heading"><div><span className="eyebrow">DEVELOPER · MACHINE IDENTITIES</span><h1>Service accounts</h1><p>Create named identities for backend integrations and control their linked API keys.</p></div><button type="button" className="console-refresh-button" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> Refresh</button></div>
    <section className="surface environment-boundary-note"><span className="eyebrow">HOW IT WORKS</span><h2>Service account → API key → Agata API</h2><p>A service account is a named identity for a backend integration, not a human login. Link API keys to it. Disabling it blocks linked keys; deleting it revokes them. An optional environment records the deployment stage, but does not create a separate database or network.</p></section>
    {notice&&<div className="settings-banner settings-banner--success" role="status">{notice}</div>}{error&&<div className="settings-banner settings-banner--error" role="alert">{error}</div>}
    <form className="surface webhook-create-form environment-create-form" onSubmit={create}><div><span className="eyebrow">NEW MACHINE IDENTITY</span><h2>Create service account</h2></div>
      <label>Name<input value={name} onChange={e=>setName(e.target.value)} required maxLength={120} placeholder="staging-backend"/></label>
      <label>Environment (optional)<select value={environmentId} onChange={e=>setEnvironmentId(e.target.value)}><option value="">Organization-wide context</option>{envs.filter(x=>x.status==="active").map(x=><option key={x.id} value={x.id}>{x.name} ({x.slug})</option>)}</select><small>Context only; not a security isolation boundary.</small></label>
      <label>Description<textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={500} rows={3} placeholder="What system uses this identity?"/></label>
      <button className="primary-action" type="submit" disabled={busy==="create"||!name.trim()}>{busy==="create"?"Creating…":"Create service account"}</button></form>
    {loading?<div className="surface empty-state"><strong>Loading service accounts…</strong></div>:items.length===0?<div className="surface empty-state"><strong>No service accounts yet.</strong><span>Create one per integration to manage credentials separately.</span></div>:<div className="environment-record-list">{items.map(a=><article className="surface environment-record-card" key={a.id}><div className="webhook-endpoint-heading"><div><span className="eyebrow">SERVICE ACCOUNT</span><h2>{a.name}</h2><code>{a.id}</code></div><span className={a.status==="active"?"console-status console-status--active":"console-status console-status--pending"}>{a.status}</span></div><p>{a.description||"No description added."}</p><p className="webhook-endpoint-meta">Environment: {a.environment_name||"Organization-wide"} · {a.active_key_count} active key(s)</p><div className="webhook-actions"><Link to={"/app/developer/api-keys/new?service_account_id="+encodeURIComponent(a.id)}>Create linked API key</Link><button type="button" disabled={busy===a.id} onClick={()=>void toggle(a)}>{a.status==="active"?"Disable":"Enable"}</button><button type="button" className="webhook-danger-action" disabled={busy===a.id} onClick={()=>void remove(a)}>Delete and revoke keys</button></div></article>)}</div>}
  </div>;
}

function ApiKeyCreatePage(){
  const [params]=useSearchParams();const [name,setName]=useState("");const [serviceAccountId,setServiceAccountId]=useState(params.get("service_account_id")||"");
  const [accounts,setAccounts]=useState<ServiceAccountRecord[]>([]);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [created,setCreated]=useState<{key:string;message:string}|null>(null);
  useEffect(()=>{let active=true;api.get<ServiceAccountRecord[]>("/api/v1/developer/service-accounts").then(rows=>{if(active)setAccounts(rows.filter(a=>a.status==="active"));}).catch(()=>{if(active)setAccounts([]);});return()=>{active=false;};},[]);
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError("");setCreated(null);try{const r=await api.post<{key:string;message:string}>("/api/v1/developer/api-keys",{name:name.trim(),...(serviceAccountId?{service_account_id:serviceAccountId}:{})});setCreated(r);setName("");}catch(x){setError(x instanceof Error?x.message:"Unable to create API key.");}finally{setBusy(false);}}
  return <div className="resource-page"><div className="page-heading"><div><span className="eyebrow">DEVELOPER · CREDENTIALS</span><h1>Create API key</h1><p>The full key is shown once. Store it in a server-side secret manager.</p></div><Link className="console-refresh-button" to="/app/developer/api-keys">Back to API keys</Link></div>
    {error&&<div className="settings-banner settings-banner--error" role="alert">{error}</div>}
    {created&&<section className="surface environment-boundary-note"><span className="eyebrow">COPY NOW · ONE-TIME SECRET</span><h2>API key created</h2><p>{created.message}</p><code style={{display:"block",overflowWrap:"anywhere",padding:"12px"}}>{created.key}</code><button type="button" className="primary-action" onClick={()=>void navigator.clipboard?.writeText(created.key)}>Copy API key</button></section>}
    <form className="surface webhook-create-form environment-create-form" onSubmit={submit}><div><span className="eyebrow">NEW CREDENTIAL</span><h2>Key details</h2></div>
      <label>API key name<input value={name} onChange={e=>setName(e.target.value)} required maxLength={120} placeholder="staging-backend"/></label>
      <label>Service account (optional)<select value={serviceAccountId} onChange={e=>setServiceAccountId(e.target.value)}><option value="">Organization-scoped key</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}{a.environment_name?" · "+a.environment_name:""}</option>)}</select><small>Linked keys are blocked when their service account is disabled and revoked when it is deleted.</small></label>
      <button className="primary-action" type="submit" disabled={busy||!name.trim()}>{busy?"Creating…":"Create API key"}</button></form>
  </div>;
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
    {oneTimeSecret&&<section className="surface webhook-secret-notice"><strong>Signing secret — shown once</strong><p>Copy this into your receiving service's secret store now. It will not be displayed again.</p><code>{oneTimeSecret}</code><button type="button" className="console-refresh-button" onClick={()=>void navigator.clipboard?.writeText(oneTimeSecret)}>Copy secret</button></section>}
    <section className="surface webhook-guide">
      <div className="surface-heading"><div><span className="eyebrow">RECEIVER CONTRACT</span><h2>Verify every delivery before processing it</h2><p>Agata signs the exact JSON request body. Verify the signature on the raw bytes before parsing the payload or triggering any business action.</p></div></div>
      <div className="webhook-guide-grid">
        <article><strong>1. Verify the signature</strong><p>Read X-Agata-Signature in the form t=timestamp,v1=hex. Compute HMAC-SHA256 using the endpoint signing secret over the UTF-8 bytes of timestamp + "." + raw request body. Compare the hex digest in constant time and reject timestamps outside a short tolerance.</p></article>
        <article><strong>2. Deduplicate deliveries</strong><p>Persist X-Agata-Delivery-Id with a unique constraint before running side effects. Successful deliveries may be replayed and failed deliveries may retry, so a receiver must be idempotent across process restarts.</p></article>
        <article><strong>3. Acknowledge reliably</strong><p>Return a 2xx response only after the event is durably accepted. The delivery worker times out after 10 seconds, does not follow redirects and retries failures with bounded backoff. After eight attempts, inspect the dead-letter record and retry after fixing the cause.</p></article>
      </div>
      <div className="webhook-guide-code"><span className="eyebrow">SIGNED HEADERS</span><pre className="context-code">X-Agata-Event: developer.api_key.created
X-Agata-Event-Id: &lt;event-uuid&gt;
X-Agata-Delivery-Id: &lt;delivery-uuid&gt;
X-Agata-Signature: t=&lt;unix-seconds&gt;,v1=&lt;hex-hmac-sha256&gt;</pre></div>
      <p className="webhook-guide-note">The downloadable receiver example validates signatures and request size and demonstrates duplicate handling. Its in-memory deduplication is for local demonstration only; use a durable database-backed unique delivery record before production processing.</p>
      <div className="context-next"><Link to="/developers/webhooks">Open full webhook guide <ArrowUpRight size={15}/></Link><Link to="/app/developer/api-reference">API reference <ArrowUpRight size={15}/></Link></div>
    </section>
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

type EnvironmentRecord = {
  id:string; name:string; slug:string; description:string; status:"active"|"disabled";
  node_count?:number; created_at:string; updated_at:string;
};

function EnvironmentManager(){
  const [items,setItems]=useState<EnvironmentRecord[]>([]);
  const [name,setName]=useState("");
  const [slug,setSlug]=useState("");
  const [description,setDescription]=useState("");
  const [slugTouched,setSlugTouched]=useState(false);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [environmentLimit,setEnvironmentLimit]=useState<number|null>(null);
  const [planName,setPlanName]=useState("");
  const [editing,setEditing]=useState<EnvironmentRecord|null>(null);
  const [editName,setEditName]=useState("");
  const [editDescription,setEditDescription]=useState("");

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const records=await api.get<EnvironmentRecord[]>("/api/v1/developer/environments");
      setItems(records);
      try{
        const entitlement=await api.get<{plan?:string;limits?:{environments?:number}}>("/api/v1/entitlements");
        setPlanName(entitlement.plan??"");
        setEnvironmentLimit(typeof entitlement.limits?.environments==="number"?entitlement.limits.environments:null);
      }catch{
        setPlanName("");
        setEnvironmentLimit(null);
      }
    }catch(e){setError(e instanceof Error?e.message:"Unable to load environments.");}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);
  const activeCount=items.filter(item=>item.status==="active").length;
  const limitReached=environmentLimit!==null&&activeCount>=environmentLimit;

  function changeName(value:string){
    setName(value);
    if(!slugTouched){
      setSlug(value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,""));
    }
  }
  async function createEnvironment(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy("create");setError("");setNotice("");
    try{
      const item=await api.post<EnvironmentRecord>("/api/v1/developer/environments",{name:name.trim(),slug:slug.trim(),description:description.trim()});
      setNotice(`Environment "${item.name}" created. It belongs to the active organization.`);
      setName("");setSlug("");setDescription("");setSlugTouched(false);await load();
    }catch(err){setError(err instanceof Error?err.message:"Unable to create environment.");}
    finally{setBusy("");}
  }
  function startEdit(item:EnvironmentRecord){
    setEditing(item);setEditName(item.name);setEditDescription(item.description);
  }
  async function saveEdit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!editing)return;
    setBusy(editing.id);setError("");setNotice("");
    try{
      const updated=await api.patch<EnvironmentRecord>(`/api/v1/developer/environments/${editing.id}`,{name:editName.trim(),description:editDescription.trim()});
      setNotice(`Environment "${updated.name}" updated.`);setEditing(null);await load();
    }catch(err){setError(err instanceof Error?err.message:"Unable to update environment.");}
    finally{setBusy("");}
  }
  async function toggle(item:EnvironmentRecord){
    setBusy(item.id);setError("");setNotice("");
    try{
      const status=item.status==="active"?"disabled":"active";
      await api.patch(`/api/v1/developer/environments/${item.id}`,{status});
      setNotice(`Environment "${item.name}" ${status==="active"?"enabled":"disabled"}.`);await load();
    }catch(err){setError(err instanceof Error?err.message:"Unable to update environment status.");}
    finally{setBusy("");}
  }
  async function remove(item:EnvironmentRecord){
    if(!window.confirm(`Delete environment "${item.name}"? Environments referenced by registered nodes cannot be deleted; disable those instead.`))return;
    setBusy(item.id);setError("");setNotice("");
    try{await api.delete(`/api/v1/developer/environments/${item.id}`);setNotice(`Environment "${item.name}" deleted.`);await load();}
    catch(err){setError(err instanceof Error?err.message:"Unable to delete environment.");}
    finally{setBusy("");}
  }

  return <div className="environment-manager">
    <div className="page-heading"><div><span className="eyebrow">DEVELOPER · ENVIRONMENTS</span><h1>Environments</h1><p>Create and manage named deployment stages inside the active organization.</p></div><button type="button" className="console-refresh-button" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> Refresh</button></div>
    <section className="surface environment-boundary-note">
      <span className="eyebrow">ORGANIZATION ≠ ENVIRONMENT</span>
      <h2>One organization can contain several environments</h2>
      <p><strong>Organization</strong> is the account, membership and billing boundary. An <strong>environment</strong> is a named stage inside it, such as development, staging or production. Creating an environment does not create another organization, database, network or secret store.</p>
      <p>You do not have to create an environment just to create an API key. Create development, staging and production stages when your deployment actually has separate stages or node groups. You can associate a service account with a stage to track which integration belongs there. API keys and webhook subscriptions remain organization-scoped, and an environment label is not a separate database, network or security boundary.</p>
    </section>
    <section className="surface environment-capacity-summary">
      <div><span className="eyebrow">PLAN CAPACITY</span><h2>{activeCount} / {environmentLimit===null?"—":environmentLimit} active environments</h2><p>{planName ? "Current plan: "+planName+". " : ""}An environment is a named stage within this organization. Node registration may have already created the stage used by your existing node.</p></div>
      <Link className="table-detail-link" to="/app/billing/plans">Review plan limits <ArrowUpRight size={14}/></Link>
    </section>
    {limitReached&&<div className="system-notice system-notice--warning" role="status"><strong>Environment limit reached.</strong><span>This organization has used its active environment allowance. You can edit or disable the existing environment; creating another requires available plan capacity.</span></div>}
    {notice&&<div className="settings-banner settings-banner--success" role="status">{notice}</div>}
    {error&&<div className="settings-banner settings-banner--error" role="alert">{error}</div>}
    <form className="surface webhook-create-form environment-create-form" onSubmit={createEnvironment}>
      <div><span className="eyebrow">NEW ENVIRONMENT</span><h2>Create environment</h2><p>Use a stable slug such as <code>development</code>, <code>staging</code> or <code>production</code>. Slugs are unique within this organization.</p></div>
      <label>Display name<input value={name} onChange={e=>changeName(e.target.value)} required maxLength={100} placeholder="Staging"/></label>
      <label>Environment slug<input value={slug} onChange={e=>{setSlugTouched(true);setSlug(e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,""));}} required maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="staging"/><small>Lowercase letters and numbers, separated by single hyphens.</small></label>
      <label>Description (optional)<textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={500} rows={3} placeholder="Pre-release acceptance testing with synthetic customer data."/></label>
      <button className="primary-action" type="submit" disabled={busy==="create"||!name.trim()||!slug.trim()||limitReached}>{busy==="create"?"Creating…":limitReached?"Environment limit reached":"Create environment"}</button>
    </form>
    <div className="environment-record-list">
      {loading?<div className="surface empty-state"><strong>Loading environments…</strong><span>Reading environment records from the control plane.</span></div>:
       items.length===0?<div className="surface empty-state"><strong>No environments created yet.</strong><span>Create your first environment above. It will be saved to the active organization's database and appear here after refresh.</span></div>:
       items.map(item=><article className="surface environment-record-card" key={item.id}>
         {editing?.id===item.id?
           <form className="environment-edit-form" onSubmit={saveEdit}>
             <label>Display name<input value={editName} onChange={e=>setEditName(e.target.value)} required maxLength={100}/></label>
             <label>Description<textarea value={editDescription} onChange={e=>setEditDescription(e.target.value)} maxLength={500} rows={3}/></label>
             <div className="webhook-actions"><button type="submit" disabled={busy===item.id}>{busy===item.id?"Saving…":"Save changes"}</button><button type="button" onClick={()=>setEditing(null)} disabled={busy===item.id}>Cancel</button></div>
           </form>:
           <>
             <div className="webhook-endpoint-heading"><div><span className="eyebrow">ENVIRONMENT</span><h2>{item.name}</h2><code>{item.slug}</code></div><span className={item.status==="active"?"console-status console-status--active":"console-status console-status--pending"}>{item.status==="active"?"Active":"Disabled"}</span></div>
             <p>{item.description||"No description added."}</p>
             <p className="webhook-endpoint-meta">Created {new Date(item.created_at).toLocaleString()} · {item.node_count??0} matching registered node(s)</p>
             <div className="webhook-actions"><button type="button" onClick={()=>startEdit(item)}>Edit details</button><button type="button" disabled={busy===item.id} onClick={()=>void toggle(item)}>{item.status==="active"?"Disable":"Enable"}</button><button type="button" className="webhook-danger-action" disabled={busy===item.id} onClick={()=>void remove(item)}>Delete</button></div>
           </>
         }
       </article>)}
    </div>
  </div>;
}

export function NestedResource(){
  const {pathname}=useLocation(); const params=useParams();
  const detailId=params.tenantId??params.policyId??params.nodeId??params.deploymentId??params.runId??params.eventId??params.apiKeyId??params.webhookId;
  const base=detailId?pathname.replace(/\/[^/]+$/,""):pathname.endsWith("/new")?pathname.replace(/\/new$/,""):pathname;
  const config=baseConfigs[base]??baseConfigs[pathname];
  if(pathname === "/app/developer/api-keys/new" && config) return <ContextShell config={config}><ApiKeyCreatePage /></ContextShell>;
  if(pathname === "/app/developer/webhooks/new" && config) return <ContextShell config={config}><WebhooksManager /></ContextShell>;
  if(pathname === "/app/developer/service-accounts" && config) return <ContextShell config={config}><ServiceAccountsManager /></ContextShell>;
  if(pathname === "/app/developer/api-keys" && config) return <ContextShell config={config}><ApiKeysManager /></ContextShell>;
  if(pathname === "/app/developer/webhooks" && config) return <ContextShell config={config}><WebhooksManager /></ContextShell>;
  if(pathname === "/app/developer/environments" && config) return <ContextShell config={config}><EnvironmentManager /></ContextShell>;
  if(pathname === "/app/billing/plans" && config) return <ContextShell config={config}><BillingPlans /></ContextShell>;
  if(detailId && config?.endpoint) return <DetailPage config={config} id={detailId}/>;
  if(config) return <ContextShell config={config}><ResourceSurface eyebrow={config.eyebrow} title={config.title} description={config.description} endpoint={config.endpoint} detailBase={config.detailBase} createHref={config.createHref} createLabel={config.createLabel} sections={config.sections}/></ContextShell>;
  if (pathname === "/app/settings/identity") return <EntraIdentitySettings />;
  const doc=developerDocs[pathname];
  const routeLabel = pathname.split("/").filter(Boolean).at(-1)?.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) ?? "Workspace";
  const generic:Config={eyebrow:pathname.startsWith("/app/developer")?"DEVELOPER":"SETTINGS",title:doc?.title??routeLabel,description:doc?.intro??"Reference guidance and next steps for this workspace area.",tabs:pathname.startsWith("/app/developer")?developerTabs:[{label:"Authentication",href:"/app/settings/authentication"},{label:"Enterprise identity",href:"/app/settings/identity"},{label:"Security",href:"/app/settings/security"},{label:"API access",href:"/app/settings/api"},{label:"Sensitive actions",href:"/app/settings/danger"},{label:"Notifications",href:"/app/settings/notifications"}]};
  if(pathname === "/app/developer/api-reference") return <ContextShell config={generic}><ApiReferenceExplorer /></ContextShell>;
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