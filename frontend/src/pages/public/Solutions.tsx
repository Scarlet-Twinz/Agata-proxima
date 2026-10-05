import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const solutions = [
  ["B2B SaaS", "Protect customer organizations and their tenants without making every application path responsible for isolation alone.", "/solutions/b2b-saas"],
  ["Enterprise SaaS", "Give security and engineering teams an infrastructure boundary they can inspect, operate and verify.", "/solutions/enterprise-saas"],
  ["Developer platforms", "Keep tenant context attached to the request path from identity through protected data access.", "/solutions/developer-platforms"],
  ["Security-sensitive systems", "Make cross-tenant access an explicit failure condition instead of an accidental application behavior.", "/solutions/security-sensitive-systems"],
  ["Growing startups", "Establish a clear isolation model before tenant boundaries become scattered across services and application code.", "/solutions/startups"],
  ["Platform engineering", "Centralize tenant-isolation enforcement and verification instead of rebuilding the same controls across services.", "/solutions/platform-engineering"],
];

export function Solutions() {
  return (
    <PublicPage
      eyebrow="Solutions"
      title="Designed for teams that cannot afford tenant leakage."
      description="Choose the environment closest to your architecture. Each solution explains where Proxima fits, what it protects and how teams can operate it."
    >
      <section className="public-content">
        <div className="agata-container">
          <div className="public-feature-grid">
            {solutions.map(([title, text, to]) => (
              <Link key={to} to={to} className="public-feature public-feature-link">
                <span className="public-feature-kicker">Solution</span>
                <h3>{title}</h3>
                <p>{text}</p>
                <strong>Explore solution →</strong>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
