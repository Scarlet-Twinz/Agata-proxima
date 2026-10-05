import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

export function Docs() {
  return (
    <PublicPage
      eyebrow="Documentation"
      title="Everything your engineering team needs to understand Proxima."
      description="Learn the architecture, integration model, API contracts, tenant context, verification workflow and operational model."
    >
      <section className="public-content">
        <div className="agata-container">
          <div className="public-feature-grid">
            <article className="public-feature">
              <h3>Getting started</h3>
              <p>
                Connect a development application and understand the
                Proxima request path.
              </p>
            </article>

            <article className="public-feature">
              <h3>Core concepts</h3>
              <p>
                Organizations, tenants, policies, nodes, verification
                and evidence.
              </p>
            </article>

            <article className="public-feature">
              <h3>API reference</h3>
              <p>
                Understand the control-plane API and its operational
                contracts.
              </p>
            </article>

            <article className="public-feature">
              <h3>Security</h3>
              <p>
                Learn how identity and tenant context interact with
                the enforcement boundary.
              </p>
            </article>

            <article className="public-feature">
              <h3>Operations</h3>
              <p>
                Deployments, fleet operations, verification and
                audit workflows.
              </p>
            </article>

            <article className="public-feature">
              <h3>Troubleshooting</h3>
              <p>
                Diagnose authentication, policy, database and
                verification failures.
              </p>
            </article>
          </div>

          <div style={{ marginTop: 44 }}>
            <Link
              to="/developers"
              className="agata-button agata-button-primary"
            >
              Developer platform
            </Link>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
