import { Link } from "react-router-dom";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";

const audiences = [
  ["B2B SaaS platforms", "/solutions/b2b-saas"],
  ["Enterprise applications", "/solutions/enterprise-saas"],
  ["Developer platforms", "/solutions/developer-platforms"],
  ["Security-sensitive workloads", "/solutions/security-sensitive"],
];

export function Home() {
  return (
    <>
      <section className="public-hero">
        <div className="agata-container public-hero-grid">
          <div>
            <div className="public-eyebrow">Tenant isolation infrastructure</div>
            <h1>Make tenant isolation an independently verifiable boundary.</h1>
            <p className="public-hero-copy">Agata Proxima gives multi-tenant applications a dedicated enforcement boundary between application identity and PostgreSQL — making isolation enforceable, verifiable and auditable.</p>
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
          <div className="home-three-up">
            {[
              { title: "Enforce", text: "Tenant context is enforced before protected database operations reach the data layer." },
              { title: "Verify", text: "Isolation behavior can be tested instead of being accepted as an assumption." },
              { title: "Prove", text: "Security events and verification outcomes become operational evidence." },
            ].map((item) => (
              <div className="home-three-up-card" key={item.title}>
                <ShieldCheck size={22} color="var(--agata-blue)" />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
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
          <div className="home-audience-grid">
            {audiences.map(([label, to]) => (
              <Link className="home-audience-link" to={to} key={label}>
                <Check size={18} color="var(--agata-blue-light)" />
                <span>{label}</span>
                <ArrowRight size={16} />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="agata-container">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "32px", flexWrap: "wrap" }}>
            <div>
              <div className="public-eyebrow">Explore the platform</div>
              <h2 style={{ margin: 0, fontSize: "clamp(32px, 4vw, 48px)", letterSpacing: "-0.04em" }}>Build with a security boundary you can inspect.</h2>
            </div>
            <Link to="/developers" className="agata-button agata-button-primary">Explore developers <ArrowRight size={17} /></Link>
          </div>
        </div>
      </section>
      <section className="public-section">
        <div className="agata-container">
          <div className="public-section-header">
            <div className="public-eyebrow">Read the operating model</div>
            <h2>Every important product claim has a place where engineers can inspect the model behind it.</h2>
            <p>Use the dedicated product, security, developer, documentation, trust and legal surfaces instead of relying on marketing copy alone.</p>
          </div>
          <div className="home-three-up">
            {[["Architecture","Understand the application → Proxima → PostgreSQL boundary.","/docs/core-concepts"],["Integration","Follow the customer lifecycle from project to verified deployment.","/docs/customer-integration"],["Trust & security","Review the security model, evidence philosophy and current production gates.","/trust"]].map(([title,text,to]) => <Link className="home-three-up-card" to={to} key={title}><ShieldCheck size={22} color="var(--agata-blue)" /><h3>{title}</h3><p>{text}</p><span className="public-inline-link">Read documentation <ArrowRight size={15}/></span></Link>)}
          </div>
        </div>
      </section>

    </>
  );
}
