import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

export function Company() {
  return (
    <PublicPage
      eyebrow="Company"
      title="Building infrastructure that makes difficult security properties easier to operate."
      description="Agata Proxima is built around one practical idea: tenant isolation should be an infrastructure property that teams can enforce, inspect and independently verify."
    >
      <section className="public-content">
        <div className="agata-container">
          <article className="public-prose">
            <h2>Why Agata exists</h2>
            <p>
              Multi-tenant software creates a security boundary that is easy to describe and surprisingly difficult to keep consistent. Identity arrives at the application, tenant context is resolved, services make decisions, background jobs run later, and protected data eventually reaches a database. Every one of those transitions can become a place where an isolation assumption is lost.
            </p>
            <p>
              Agata Proxima is being built to make that boundary explicit. Instead of asking every application path to carry the whole security model on its own, Proxima gives teams a dedicated place to enforce tenant context, reject unauthorized paths, verify expected behavior and preserve operational evidence.
            </p>

            <h2>What we are building</h2>
            <p>
              The product is a security infrastructure and control plane, not a collection of disconnected security screens. The model connects identity, tenant context, enforcement, PostgreSQL controls, verification and audit evidence into one operating path.
            </p>
            <ul>
              <li>A control plane for organizations, tenants, policies, infrastructure and teams.</li>
              <li>An enforcement boundary designed to keep cross-tenant operations from reaching protected data.</li>
              <li>Verification workflows that turn security expectations into repeatable checks.</li>
              <li>Audit evidence that helps operators understand what happened and why.</li>
              <li>Developer surfaces that explain the integration instead of hiding it behind marketing language.</li>
            </ul>

            <h2>Engineering first</h2>
            <p>
              Agata is designed for the people who have to operate the system after the architecture diagram is finished. That means a useful product needs more than a polished homepage: it needs clear tenant views, policy controls, infrastructure state, deployment visibility, verification results, audit history, team access, billing and developer integration.
            </p>

            <h2>Evidence over claims</h2>
            <p>
              A security product should not ask customers to trust a paragraph on a marketing page when the underlying property can be tested. Agata therefore treats verification and operational evidence as first-class concepts. The goal is straightforward: make it possible to inspect the tenant context, the policy decision, the protected operation and the resulting evidence.
            </p>

            <h2>What we will not pretend</h2>
            <p>
              We do not want the product to manufacture telemetry, imply that a connection exists when it does not, or call an integration complete because a button happens to be present. A control should either work against a real system or clearly say what is not connected yet. That principle applies to security, billing, email, infrastructure and the public product experience.
            </p>

            <h2>How the platform fits together</h2>
            <pre className="public-code">{`Customer application
        ↓
Identity + tenant context
        ↓
Agata Proxima enforcement boundary
        ↓
PostgreSQL roles / RLS
        ↓
Verification
        ↓
Audit evidence`}</pre>

            <div className="public-callout">
              <strong>Build with the platform.</strong>
              <p>
                Explore the developer model, read the architecture documentation and create a workspace when you are ready to integrate.
              </p>
              <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:20}}>
                <Link to="/developers" className="agata-button agata-button-secondary">Developer platform</Link>
                <Link to="/docs" className="agata-button agata-button-secondary">Read documentation</Link>
                <Link to="/signup" className="agata-button agata-button-primary">Start building</Link>
              </div>
            </div>
          </article>
        </div>
      </section>
    </PublicPage>
  );
}
