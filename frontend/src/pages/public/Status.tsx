import { PublicPage } from "../../components/layout/PublicPage";

const systems = ["Control Plane", "Proxima Engine", "PostgreSQL", "Identity", "Billing", "Email"];

export function Status() {
  return (
    <PublicPage
      eyebrow="System status"
      title="Operational visibility without invented telemetry."
      description="Agata's status surface distinguishes published service information from live telemetry. Live status will appear when the public status service is connected."
    >
      <section className="public-content">
        <div className="agata-container">
          <div className="public-prose">
            <div className="public-status-intro">
              <strong>Live status service not connected.</strong>
              <p>
                No uptime percentage or operational state is being fabricated.
                When the production status source is connected, each service below
                will display its real state and incident history.
              </p>
            </div>
            {systems.map((name) => (
              <div className="public-status-row" key={name}>
                <div className="public-status-name">{name}</div>
                <div className="public-status-neutral">No live data</div>
                <div className="public-status-detail">Awaiting status telemetry</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
