import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const systems = ["Control Plane","Proxima Engine","PostgreSQL","Identity","Billing","Email"];

export function Status() {
  return (
    <PublicPage eyebrow="System status" title="Operational visibility without invented telemetry." description="The status surface is ready for live service signals, but it does not claim a backend state that is not currently connected to real telemetry.">
      <section className="public-content">
        <div className="agata-container">
          <div className="public-prose">
            <div className="public-callout">
              <strong>Live telemetry is not connected to this public surface yet.</strong>
              <p>The interface is intentionally explicit rather than displaying fabricated uptime or incident data. Once the backend status source is connected, these rows can report real service state.</p>
            </div>

            {systems.map((name) => (
              <div className="public-status-row" key={name}>
                <div className="public-status-name">{name}</div>
                <div className="public-status-pending">Awaiting live signal</div>
                <div className="public-status-detail">No fabricated status</div>
              </div>
            ))}

            <div className="public-detail-links">
              <Link to="/changelog" className="agata-button agata-button-secondary">View changelog</Link>
              <Link to="/support" className="agata-button agata-button-secondary">Get support</Link>
            </div>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
