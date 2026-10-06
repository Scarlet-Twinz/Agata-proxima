import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const solutions = [
  ["B2B SaaS","Protect customer organizations and their tenants without making every application path responsible for enforcing isolation alone.","/solutions/b2b-saas"],
  ["Enterprise SaaS","Give security and engineering teams an infrastructure boundary they can inspect, operate and verify.","/solutions/enterprise-saas"],
  ["Developer platforms","Keep tenant context attached to the request path from identity through protected data access.","/solutions/developer-platforms"],
  ["Security-sensitive systems","Make cross-tenant access an explicit failure condition instead of an accidental application behavior.","/solutions/security-sensitive"],
  ["Growing startups","Start with a clear isolation model before customer count turns tenant boundaries into a sprawling application concern.","/solutions/startups"],
  ["Platform engineering","Centralize tenant-isolation enforcement and verification instead of rebuilding the same controls across services.","/solutions/platform-engineering"],
];

export function Solutions() {
  return (
    <PublicPage
      eyebrow="Solutions"
      title="Designed for teams that cannot afford tenant leakage."
      description="Agata Proxima gives engineering teams a consistent infrastructure model for protecting tenants across multi-tenant applications."
    >
      <section className="public-content">
        <div className="agata-container">
          <div className="public-feature-grid">
            {solutions.map(([title,text,to]) => (
              <article className="public-feature" key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
                <Link to={to} className="public-inline-link">Explore solution <ArrowRight size={15} /></Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
