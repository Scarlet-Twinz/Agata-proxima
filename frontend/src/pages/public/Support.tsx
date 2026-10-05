import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

export function Support() {
  return (
    <PublicPage
      eyebrow="Support"
      title="Get help when infrastructure matters."
      description="Find technical guidance, understand operational issues and connect with the Agata team."
    >
      <section className="public-content">
        <div className="agata-container">
          <div className="public-feature-grid">
            <article className="public-feature">
              <h3>Documentation</h3>
              <p>
                Start with architecture, integration and operational
                documentation.
              </p>
            </article>

            <article className="public-feature">
              <h3>Troubleshooting</h3>
              <p>
                Diagnose authentication, policy, database and
                verification issues.
              </p>
            </article>

            <article className="public-feature">
              <h3>Security issues</h3>
              <p>
                Security concerns should have a clear path for
                responsible reporting.
              </p>
            </article>

            <article className="public-feature">
              <h3>Customer support</h3>
              <p>
                Organizations can manage operational support from
                inside the authenticated command center.
              </p>
            </article>
          </div>

          <div style={{ marginTop: 44 }}>
            <Link
              to="/contact"
              className="agata-button agata-button-primary"
            >
              Contact Agata
            </Link>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
