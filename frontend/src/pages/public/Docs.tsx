import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Code2,
  Database,
  GitBranch,
  LifeBuoy,
  LockKeyhole,
  Network,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const guideGroups = [
  {
    eyebrow: "START HERE",
    title: "Understand the platform",
    description: "Build a correct mental model before creating resources or wiring an application into the protected path.",
    icon: BookOpen,
    links: [
      { title: "Getting started", text: "A staged route from prerequisites to a first verified integration.", to: "/docs/getting-started" },
      { title: "Core concepts", text: "How organizations, tenants, policies, nodes, deployments and evidence relate.", to: "/docs/core-concepts" },
      { title: "Operating model", text: "Understand the difference between control-plane intent and runtime enforcement.", to: "/product/model" },
    ],
  },
  {
    eyebrow: "BUILD",
    title: "Integrate deliberately",
    description: "Keep identity, tenant context, enforcement and protected database access explicit in the request path.",
    icon: Code2,
    links: [
      { title: "Developer quickstart", text: "Follow the integration sequence and verify both allowed and denied behavior.", to: "/developers/quickstart" },
      { title: "Authentication", text: "Distinguish human sessions, machine credentials and enterprise identity.", to: "/developers/authentication" },
      { title: "API reference", text: "Explore the resource groups and authenticated control-plane interface.", to: "/docs/api-reference" },
    ],
  },
  {
    eyebrow: "OPERATE",
    title: "Run and verify the system",
    description: "Move from desired state to observed results, then investigate with verification and audit evidence.",
    icon: Workflow,
    links: [
      { title: "Policies and deployments", text: "Connect versioned policy intent to an explicit deployment target.", to: "/developers/policies" },
      { title: "Secure node enrollment", text: "Register a node, configure its one-time bootstrap variables, and persist its identity.", to: "/docs/node-enrollment" },
      { title: "Verification", text: "Test tenant-local access and negative cross-tenant cases.", to: "/docs/verification" },
      { title: "Operations", text: "Use health, fleet, audit and rollout signals during day-to-day operation.", to: "/docs/operations" },
    ],
  },
  {
    eyebrow: "PROTECT",
    title: "Review the security boundary",
    description: "Apply the security model through explicit identity, tenant context, enforcement and PostgreSQL controls.",
    icon: ShieldCheck,
    links: [
      { title: "Security architecture", text: "Review responsibilities across identity, enforcement and PostgreSQL controls.", to: "/docs/security" },
      { title: "Threat model", text: "Understand assumptions, trust boundaries and failure cases.", to: "/security" },
      { title: "Troubleshooting", text: "Diagnose Docker Desktop, Compose, PostgreSQL, HTTP, authentication and integration failures.", to: "/docs/troubleshooting" },
    ],
  },
];

const firstSteps = [
  ["01", "Understand the boundary", "Write down where the caller is authenticated, where organization membership is checked, how the tenant is selected, where Proxima enforces the context and which PostgreSQL role/RLS policy protects the data."],
  ["02", "Configure a real environment", "Start with the local Compose or documented target environment. Confirm the control-plane database URL, Engine/database path, callback URLs and secret names. Keep development credentials out of production and never paste secrets into documentation or support tickets."],
  ["03", "Create the minimum resources", "Sign in, select the correct organization, create the test tenant, then create only the policy, node and deployment records required by that environment. Check each API response and confirm the resource appears under the same organization."],
  ["04", "Test both sides", "Run a permitted operation for tenant A. Then attempt a read and a write against tenant B, repeat with missing and malformed tenant context, and confirm each prohibited request is rejected. Use non-production fixtures only."],
  ["05", "Inspect the evidence", "Open verification results and audit history. Record the environment, timestamp, build, policy/deployment version, expected result, actual result and any skipped checks. Record the environment and result so the team can repeat the same acceptance check."],
];

export function Docs() {
  return (
    <PublicPage
      eyebrow="ENGINEERING DOCUMENTATION"
      title="Understand it. Integrate it. Verify it."
      description="Step-by-step product, integration, API, webhook, security and operations guides. Follow the recommended path, copy the examples, and use the acceptance checklists to validate each workflow."
    >
      <section className="public-content docs-home">
        <div className="agata-container">
          <div className="docs-start-panel">
            <div className="docs-start-copy">
              <span className="public-eyebrow">RECOMMENDED PATH</span>
              <h2>Start with the boundary, not a code snippet.</h2>
              <p>
                Proxima separates administrative intent from runtime enforcement. An organization scopes
                administrative resources; tenant context identifies the customer boundary; policies describe intended
                behavior; nodes and deployments identify where that intent is applied; verification tests the result.
              </p>
              <div className="docs-start-actions">
                <Link className="agata-button agata-button-primary" to="/docs/getting-started">Follow getting started <ArrowRight size={16} /></Link>
                <Link className="agata-button agata-button-secondary" to="/product/model">Read the operating model</Link>
              </div>
            </div>
            <div className="docs-flow-card" aria-label="Agata Proxima request and evidence flow">
              <div><span>01</span><strong>Application identity</strong><small>Who is making the request?</small></div>
              <div><span>02</span><strong>Organization + tenant</strong><small>Which administrative and customer boundary applies?</small></div>
              <div><span>03</span><strong>Policy + enforcement</strong><small>Is this protected operation permitted?</small></div>
              <div><span>04</span><strong>PostgreSQL controls</strong><small>Keep database protections in the data path.</small></div>
              <div><span>05</span><strong>Verification + audit</strong><small>Test behavior and inspect the resulting evidence.</small></div>
            </div>
          </div>

          <div className="docs-section-heading">
            <div><span className="public-eyebrow">DOCUMENTATION MAP</span><h2>Choose the job you need to do.</h2></div>
            <p>Each guide should answer a concrete question and link to the next step. Use these paths to move between concepts without losing the operating context.</p>
          </div>

          <div className="docs-guide-grid">
            {guideGroups.map((group) => {
              const Icon = group.icon;
              return (
                <section className="docs-guide-group" key={group.title}>
                  <div className="docs-guide-group-heading">
                    <span className="docs-guide-icon"><Icon size={19} /></span>
                    <div><span className="public-eyebrow">{group.eyebrow}</span><h3>{group.title}</h3></div>
                  </div>
                  <p>{group.description}</p>
                  <div className="docs-guide-links">
                    {group.links.map((link) => (
                      <Link to={link.to} key={link.to}>
                        <span><strong>{link.title}</strong><small>{link.text}</small></span>
                        <ArrowRight size={16} />
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          <section className="docs-first-steps">
            <div className="docs-section-heading">
              <div><span className="public-eyebrow">FIRST INTEGRATION</span><h2>A sequence you can verify.</h2></div>
              <p>Follow the sequence rather than treating a successful dashboard response as proof that the protected database path is secure.</p>
            </div>
            <div className="docs-step-list">
              {firstSteps.map(([number, title, text]) => (
                <article className="docs-step" key={number}>
                  <span className="docs-step-number">{number}</span>
                  <div><h3>{title}</h3><p>{text}</p></div>
                </article>
              ))}
            </div>
          </section>

          <section className="docs-integration-examples">
            <div className="docs-section-heading">
              <div><span className="public-eyebrow">INTEGRATION PATTERNS</span><h2>Integrate through explicit contracts.</h2></div>
              <p>Use the API contract and integration recipes for the services in your stack. Keep external-service credentials server-side and preserve organization and tenant authorization at every boundary.</p>
            </div>
            <div className="docs-example-grid">
              <article className="docs-example-card">
                <div className="docs-example-top"><span className="docs-example-mark docs-example-mark--mail"><Database size={19} /></span><div><span className="public-eyebrow">APPLICATION ACCESS</span><h3>Authenticated APIs</h3></div></div>
                <p>Use the documented authentication flow, preserve organization and tenant context, and validate request and response contracts against the running service.</p>
                <ul><li>Keep credentials in server-side secret storage.</li><li>Request only the permissions required.</li><li>Verify authorization at the backend boundary.</li></ul>
                <Link to="/developers/authentication">Review authentication <ArrowRight size={14} /></Link>
              </article>
              <article className="docs-example-card">
                <div className="docs-example-top"><span className="docs-example-mark docs-example-mark--events"><GitBranch size={19} /></span><div><span className="public-eyebrow">EVENT PROCESSING</span><h3>Webhooks and automation</h3></div></div>
                <p>For the Agata webhook delivery feature, create an endpoint you control, select an event, capture the delivery identifier and signature, verify the signature over the exact raw body, and inspect the recorded attempt. Simulate an error response and confirm retry behavior before relying on it.</p>
                <ul><li>Authenticate and validate payloads.</li><li>Deduplicate repeated deliveries.</li><li>Record outcomes and retry safely.</li></ul>
                <Link to="/developers/webhooks">Review webhook guidance <ArrowRight size={14} /></Link>
              </article>
              <article className="docs-example-card">
                <div className="docs-example-top"><span className="docs-example-mark docs-example-mark--events"><ShieldCheck size={19} /></span><div><span className="public-eyebrow">ACCEPTANCE</span><h3>Verify the real workflow</h3></div></div>
                <p>A visible route or successful HTTP response is not sufficient proof that a full integration works. Exercise success, invalid credentials, denied access, retries and recovery in the intended environment.</p>
                <ul><li>Test the real API contract.</li><li>Inspect logs and audit evidence.</li><li>Record environment and unresolved dependencies.</li></ul>
                <Link to="/docs/verification">Open verification checklist <ArrowRight size={14} /></Link>
              </article>
            </div>
            <div className="docs-caution"><LockKeyhole size={18} /><p><strong>Keep the trust boundary explicit.</strong> Use server-side credentials, validate identity before resolving tenant context, and test allowed and denied operations. The integration catalog links to the setup pattern for each supported workflow.</p></div>
          </section>

          <section className="docs-reference-strip">
            <div className="docs-reference-icon"><Workflow size={20} /></div>
            <div><h3>Connect your stack</h3><p>Open the integration catalog for ChatGPT/MCP architecture, Supabase, Firebase, GitHub Actions, Vercel and PostgreSQL RLS setup recipes.</p></div>
            <Link className="agata-button agata-button-secondary" to="/developers/integrations">Integration catalog <ArrowRight size={15} /></Link>
          </section>

          <section className="docs-reference-strip">
            <div className="docs-reference-icon"><Database size={20} /></div>
            <div><h3>Need the exact contract?</h3><p>Use the API reference and OpenAPI schema together. The schema defines endpoint paths, methods, permissions and request/response fields for the documented API version.</p></div>
            <Link className="agata-button agata-button-secondary" to="/docs/api-reference">Open API reference <ArrowRight size={15} /></Link>
          </section>

          <div className="docs-support-links">
            <Link to="/docs/verification"><CheckCircle2 size={17} /> Verification checklist</Link>
            <Link to="/docs/troubleshooting"><LifeBuoy size={17} /> Troubleshooting</Link>
            <Link to="/security"><ShieldCheck size={17} /> Security model</Link>
            <Link to="/docs/operations"><Network size={17} /> Operations guide</Link>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
