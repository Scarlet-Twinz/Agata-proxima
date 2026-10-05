import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

export function Developers() {
  return (
    <PublicPage
      eyebrow="Developer platform"
      title="Integrate tenant isolation into the infrastructure you already have."
      description="Agata is designed for engineering teams. Understand the model, connect your application, enforce tenant context and verify the boundary."
    >
      <section className="public-content">
        <div className="agata-container">
          <div className="public-feature-grid">
            <article className="public-feature">
              <h3>Quickstart</h3>
              <p>
                Understand the integration path from application
                identity to Proxima and PostgreSQL.
              </p>
            </article>

            <article className="public-feature">
              <h3>Authentication</h3>
              <p>
                Work with API credentials, service identities and
                enterprise identity configuration.
              </p>
            </article>

            <article className="public-feature">
              <h3>Tenant context</h3>
              <p>
                Learn how tenant identity moves through the protected
                request path.
              </p>
            </article>

            <article className="public-feature">
              <h3>Verification</h3>
              <p>
                Test expected isolation behavior and inspect the
                resulting evidence.
              </p>
            </article>

            <article className="public-feature">
              <h3>API reference</h3>
              <p>
                Explore the control-plane contracts and operational
                interfaces exposed by Agata.
              </p>
            </article>

            <article className="public-feature">
              <h3>Webhooks and events</h3>
              <p>
                Connect Agata events to the systems your engineering
                and security teams already operate.
              </p>
            </article>
          </div>

          <div style={{ marginTop: 44 }}>
            <Link
              to="/docs"
              className="agata-button agata-button-primary"
            >
              Read the documentation
            </Link>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
