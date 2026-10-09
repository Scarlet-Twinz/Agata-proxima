import { ArrowRight, BookOpen, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const localCommand = [
  'docker compose up -d control-postgres',
  '$env:PROXIMA_CONTROL_DATABASE_URL = "postgres://proxima_control:proxima-control-dev@127.0.0.1:55443/proxima_control"',
  '$env:PROXIMA_CONTROL_BIND = "127.0.0.1:8080"',
  'cargo run -p proxima-control-plane',
].join("\n");

const sections = [
  { title: "Create a workspace", body: "Create an account at /signup. The first account owns the organization. Signup requires working email verification through Resend; if email delivery fails, workspace creation may be rolled back. Use the organization ID returned by the authenticated API for subsequent resource requests. Keep your session cookie and CSRF token private." },
  { title: "Add tenants, policies and nodes", body: "Create tenant records, versioned policies and nodes in the organization context. Store any one-time node enrollment token in a secret store. Configure PostgreSQL roles and RLS alongside the Engine; dashboard records do not replace database enforcement." },
  { title: "Deploy and verify", body: "Record a desired deployment state, then run tenant-local and cross-tenant negative tests. Inspect verification evidence and audit events. A passing repository test is not a substitute for testing the real external application and its database path." },
  { title: "Invite your team", body: "Invite people by email and assign the least-privileged role that fits. Invitations expire after seven days. Active memberships and unexpired invitations reserve seats; accepting an invitation must not bypass the plan limit." },
  { title: "Connect APIs and webhooks", body: "Create organization-scoped API keys and HTTPS webhook endpoints. Protect credentials, validate incoming signatures, handle retries idempotently, and revoke unused keys. Disabled integrations do not consume active integration slots." },
];

export function UsageGuide() {
  return (
    <PublicPage eyebrow="Documentation · Usage" title="From first workspace to verified production." description="A practical guide to running Agata Proxima, managing resources, enforcing tenant isolation, configuring integrations and preparing for production.">
      <section className="public-content">
        <div className="agata-container">
          <div className="public-detail-layout">
            <aside className="public-detail-sidebar">
              <div className="public-detail-sidebar-title">Usage guide</div>
              <a href="#local">Local setup</a>
              <a href="#resources">Resources</a>
              <a href="#billing">Billing and limits</a>
              <a href="#sso">Microsoft Entra SSO</a>
              <a href="#operations">Operations</a>
            </aside>
            <div>
              <div className="public-callout">
                <strong>Repository implementation versus production acceptance</strong>
                <p>Phase 3.22-A–H has passed its repository acceptance gates. Paystack activation, real SSO, production email and operational recovery still require tests against the actual hosted environment.</p>
              </div>
              <div className="public-prose">
                <h2 id="local">Start with the correct environment.</h2>
                <p>The local Compose setup has separate Engine and Control Plane PostgreSQL services. The Control Plane database is exposed on host port 55443 by default. A database running in Docker on your laptop is local development data, not the production database.</p>
                <pre className="public-code">{localCommand}</pre>
                <p>Local service URLs: <code>http://127.0.0.1:8080</code>, health <code>/api/v1/health</code>, readiness <code>/api/v1/production/readiness</code>, and OpenAPI <code>/docs/openapi.json</code>.</p>
                <h2 id="resources">The operating workflow</h2>
                {sections.map((section) => (
                  <section className="public-detail-section" key={section.title}>
                    <h3>{section.title}</h3>
                    <p>{section.body}</p>
                  </section>
                ))}
                <h2 id="billing">Plans, quotas and billing</h2>
                <p>The canonical monthly prices are Starter $149, Growth $499 and Scale $1,199, with Free at $0 and Enterprise custom. Paid checkout uses Paystack USD plans. The backend checks each configured plan code, amount and monthly interval before checkout, then validates the transaction and signed webhook. Confirm USD settlement and the real payment round trip before enabling live billing.</p>
                <ul>
                  <li>Free: 1 node, 3 tenants, 1 environment, 1 active integration, 100 verifications per month and 1 team seat.</li>
                  <li>Starter: 2 nodes, 25 tenants, 2 environments, 5 integrations, 1,000 verifications per month and 5 seats.</li>
                  <li>Growth: 5 nodes, 100 tenants, 5 environments, 20 integrations, 10,000 verifications per month and 15 seats.</li>
                  <li>Scale: 15 nodes, 500 tenants, 50 environments, 100 integrations, 100,000 verifications per month and 50 seats.</li>
                </ul>
                <p>Use <code>GET /api/v1/billing/entitlements</code> to inspect the organization's current limits and usage. Do not trust a client-supplied plan key as proof of payment.</p>
                <h2 id="sso">Microsoft Entra SSO</h2>
                <p>SSO uses Microsoft Entra ID over OIDC, not Paystack. Create a multitenant Web app registration, register the exact public callback, store the client secret in the deployment secret store, and test tenant-to-organization mapping. The login button stays disabled until end-to-end acceptance succeeds.</p>
                <pre className="public-code">{"https://<your-control-plane-host>/api/v1/auth/oidc/callback"}</pre>
                <p>Read the <Link to="/docs/usage">usage guide</Link> and the <a href="https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app?tabs=client-secret" target="_blank" rel="noreferrer">official Microsoft app-registration guide</a> before creating the registration.</p>
                <h2 id="operations">Production operations</h2>
                <p>Use health for liveness and the production readiness endpoint as a launch gate. Production requires a managed database, encrypted backups, a restore drill, alerts, tested rollback, verified email delivery, and a runtime external SaaS isolation test.</p>
                <ul>
                  <li>Health and readiness probes must be configured in the hosting environment.</li>
                  <li>Database backups must be encrypted and a restore must be tested against an isolated database.</li>
                  <li>Alerts must cover database health, API failures, Paystack webhook reconciliation, Resend delivery and backup age.</li>
                  <li>Never restore over the live database as a test.</li>
                </ul>
                <div className="public-detail-links">
                  <Link className="agata-button agata-button-primary" to="/docs">Documentation home <ArrowRight size={15}/></Link>
                  <Link className="agata-button agata-button-secondary" to="/security"><ShieldCheck size={15}/> Security model</Link>
                  <Link className="agata-button agata-button-secondary" to="/developers"><BookOpen size={15}/> Developer portal</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
