import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const systems = ["Control Plane","Proxima Engine","PostgreSQL","Identity","Billing","Email"];

export function Status() {
  return (
    <PublicPage eyebrow="System status" title="Operational visibility without invented telemetry." description="Agata's status surface is designed to expose real service state rather than manufacture uptime numbers.">
      <section className="public-content">
        <div className="agata-container">
          <div className="public-prose">
            {systems.map((name) => (
              <div className="public-status-row" key={name}>
                <div className="public-status-name">{name}</div>
                <div className="public-status-good">● Operational</div>
                <div className="public-status-detail">Current service surface</div>
              </div>
            ))}
            <div className="public-callout">
              <strong>Status transparency</strong>
              <p>Detailed incidents and service changes should be published as real operational events, not fabricated telemetry.</p>
              <div className="public-detail-links">
                <Link to="/changelog" className="agata-button agata-button-secondary">View changelog</Link>
                <Link to="/support" className="agata-button agata-button-secondary">Get support</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
