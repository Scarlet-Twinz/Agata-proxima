import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const supportPaths = [
  ["Documentation", "Start with architecture, integration and operational documentation.", "/docs"],
  ["Troubleshooting", "Diagnose authentication, policy, database and verification issues.", "/docs/troubleshooting"],
  ["Security issues", "Use the security and contact paths for responsible reporting.", "/security"],
  ["Customer support", "Authenticated organizations can manage operational support from the command center.", "/app/support"],
];

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
            {supportPaths.map(([title, text, to]) => (
              <Link key={to} to={to} className="public-feature public-feature-link">
                <span className="public-feature-kicker">Support path</span>
                <h3>{title}</h3>
                <p>{text}</p>
                <strong>Open support path →</strong>
              </Link>
            ))}
          </div>
          <div style={{ marginTop: 44 }}>
            <Link to="/contact" className="agata-button agata-button-primary">Contact Agata</Link>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
