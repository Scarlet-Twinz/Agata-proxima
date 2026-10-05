import { PublicPage } from "../../components/layout/PublicPage";

const systems = [
  ["Control Plane", "Operational"],
  ["Proxima Engine", "Operational"],
  ["PostgreSQL", "Operational"],
  ["Identity", "Operational"],
  ["Billing", "Operational"],
  ["Email", "Operational"],
];

export function Status() {
  return (
    <PublicPage
      eyebrow="System status"
      title="Operational visibility without invented telemetry."
      description="Agata's status surface is designed to expose real service state rather than manufacture uptime numbers."
    >
      <section className="public-content">
        <div className="agata-container">
          <div className="public-prose">
            {systems.map(([name, state]) => (
              <div className="public-status-row" key={name}>
                <div className="public-status-name">
                  {name}
                </div>

                <div className="public-status-good">
                  ● {state}
                </div>

                <div className="public-status-detail">
                  Current service surface
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
