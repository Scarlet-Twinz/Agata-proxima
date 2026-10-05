import { Link } from "react-router-dom";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";

const operatingModel = [
  { title: "Enforce", text: "Tenant context is enforced before protected database operations reach the data layer.", to: "/docs/security" },
  { title: "Verify", text: "Isolation behavior can be tested instead of being accepted as an assumption.", to: "/developers/verification" },
  { title: "Prove", text: "Security events and verification outcomes become operational evidence.", to: "/docs/api-reference" },
];

const solutionLinks = [
  ["B2B SaaS", "/solutions/b2b-saas"],
  ["Enterprise applications", "/solutions/enterprise-saas"],
  ["Developer platforms", "/solutions/developer-platforms"],
  ["Security-sensitive workloads", "/solutions/security-sensitive-systems"],
];

export function Home() {
  return (
    <>
      <section className="public-hero">
        <div className="agata-container public-hero-grid">
          <div>
            <div className="public-eyebrow">Tenant isolation infrastructure</div>
            <h1>Make tenant isolation an independently verifiable boundary.</h1>
            <p className="public-hero-copy">
              Agata Proxima gives multi-tenant applications a dedicated enforcement boundary between application identity and PostgreSQL—making isolation enforceable, verifiable and auditable.
            </p>
            <div className="public-hero-actions">
              <Link to="/signup" className="agata-button agata-button-primary">Start building <ArrowRight size={17} /></Link>
              <Link to="/product" className="agata-button agata-button-secondary">Explore Proxima</Link>
            </div>
          </div>

          <div className="platform-visual">
            <div className="platform-visual-content">
              <div className="platform-label">Proxima enforcement boundary</div>
              <div className="platform-flow">
                <div className="platform-node"><strong>Application</strong><span>Identity & tenant context</span></div>
                <div className="platform-arrow">→</div>
                <div className="platform-node"><strong>Proxima</strong><span>Enforcement & verification</span></div>
                <div className="platform-arrow">→</div>
                <div className="platform-node"><strong>PostgreSQL</strong><span>Roles & RLS</span></div>
              </div>
              <div className="platform-status"><span className="platform-status-dot" />Isolation boundary active</div>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="agata-container">
          <div className="public-section-header">
            <div className="public-eyebrow">The operating model</div>
            <h2>Security should be something your infrastructure can prove.</h2>
            <p>Proxima connects identity, tenant context, enforcement, database access, verification and audit evidence into one operational boundary.</p>
          </div>

          <div className="public-feature-grid">
            {operatingModel.map((item) => (
              <Link key={item.title} to={item.to} className="public-feature public-feature-link">
                <ShieldCheck size={22} color="var(--agata-blue)" />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <strong>Explore {item.title.toLowerCase()} →</strong>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section public-section-dark">
        <div className="agata-container">
          <div className="public-section-header">
            <div className="public-eyebrow">Built for multi-tenant systems</div>
            <h2>One boundary. Multiple tenants. Verifiable isolation.</h2>
            <p>Designed for teams building serious multi-tenant applications where isolation cannot depend on application discipline alone.</p>
          </div>

          <div className="home-solution-links">
            {solutionLinks.map(([label, to]) => (
              <Link key={to} to={to}>
                <Check size={18} color="var(--agata-blue-light)" />
                <span>{label}</span>
                <ArrowRight size={15} />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="agata-container">
          <div className="home-final-cta">
            <div>
              <div className="public-eyebrow">Explore the platform</div>
              <h2>Build with a security boundary you can inspect.</h2>
            </div>
            <Link to="/developers" className="agata-button agata-button-primary">Explore developers <ArrowRight size={17} /></Link>
          </div>
        </div>
      </section>
    </>
  );
}
