import { ArrowRight, Check, ChevronRight, Database, FileCheck2, Network, ShieldCheck, Terminal, Webhook } from "lucide-react";
import { Link } from "react-router-dom";



const operatingAreas = [
  ["Tenant registry","Create and inspect protected customer boundaries.","/app/tenants"],
  ["Policy control","Version enforcement intent and connect it to deployments.","/app/policies"],
  ["Fleet","Register nodes, environments and deployment targets.","/app/nodes"],
  ["Deployments","Move desired state through an observable lifecycle.","/app/deployments"],
  ["Verification","Run and inspect security verification evidence.","/app/verification"],
  ["Audit","Trace administrative and security activity.","/app/audit"],
];

const developerAreas = [
  ["API keys","Organization-scoped machine credentials.","/app/developer/api-keys"],
  ["Webhooks","Signed event delivery with delivery history.","/app/developer/webhooks"],
  ["SDKs","Language-level integration guidance.","/app/developer/sdks"],
  ["CLI","Operator workflows from the command line.","/app/developer/cli"],
  ["API reference","The authenticated control-plane contract.","/app/developer/api-reference"],
];

export function Home() {
  return <div>
    <section className="public-hero">
      <div className="agata-container public-hero-grid">
        <div>
          <div className="public-eyebrow">Tenant isolation infrastructure</div>
          <h1>Make tenant isolation an independently verifiable boundary.</h1>
          <p className="public-hero-copy">Agata Proxima gives multi-tenant applications a dedicated enforcement boundary between application identity and PostgreSQL — making isolation enforceable, verifiable and auditable.</p>
          <div className="public-hero-actions">
            <Link to="/signup" className="agata-button agata-button-primary">Start building <ArrowRight size={17}/></Link>
            <Link to="/product" className="agata-button agata-button-secondary">Explore Proxima</Link>
            <Link to="/docs/getting-started" className="agata-button agata-button-secondary">Read the docs</Link>
          </div>
          <div className="home-proof-links"><Link to="/security">Security model <ChevronRight size={14}/></Link><Link to="/trust">Trust center <ChevronRight size={14}/></Link><Link to="/status">Service status <ChevronRight size={14}/></Link></div>
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
            <div className="platform-status"><span className="platform-status-dot"/>Isolation boundary active</div>
          </div>
        </div>
      </div>
    </section>

    <section className="public-section">
      <div className="agata-container">
        <div className="public-section-header"><div className="public-eyebrow">The operating model</div><h2>Every important concept has somewhere to go.</h2><p>The public product is deliberately navigable: each concept opens its own destination, documentation and next action instead of ending at a marketing card.</p></div>
        <div className="home-three-up">{[
          {title:"Enforce",text:"Tenant context is enforced before protected database operations reach the data layer.",icon:Network},
          {title:"Verify",text:"Isolation behavior can be tested instead of being accepted as an assumption.",icon:FileCheck2},
          {title:"Prove",text:"Security events and verification outcomes become operational evidence.",icon:ShieldCheck},
        ].map(item=>{const Icon=item.icon;return <Link to={item.title==="Enforce"?"/product/enforcement":item.title==="Verify"?"/product/verification":"/product/evidence"} className="home-three-up-card" key={item.title}><Icon size={22} color="var(--agata-blue)"/><h3>{item.title}</h3><p>{item.text}</p><span className="home-card-link">Explore <ArrowRight size={14}/></span></Link>})}</div>
      </div>
    </section>

    <section className="public-section public-section-dark">
      <div className="agata-container">
        <div className="public-section-header"><div className="public-eyebrow">Platform map</div><h2>A product surface, not a collection of disconnected screens.</h2><p>From tenant creation to verification evidence, each area is connected to the next operational decision.</p></div>
        <div className="home-operating-grid">{operatingAreas.map(([title,text,to])=><Link key={title} to={to}><strong>{title}</strong><span>{text}</span><ArrowRight size={16}/></Link>)}</div>
      </div>
    </section>

    <section className="public-section">
      <div className="agata-container">
        <div className="public-section-header"><div className="public-eyebrow">Developer experience</div><h2>Go from documentation to an actual integration workflow.</h2><p>Developer resources have their own navigation, detail pages and operational destinations.</p></div>
        <div className="home-developer-grid">{developerAreas.map(([title,text,to])=><Link key={title} to={to}><span className="home-dev-icon">{title==="Webhooks"?<Webhook size={18}/>:title==="API reference"?<Database size={18}/>:<Terminal size={18}/>}</span><span><strong>{title}</strong><small>{text}</small></span><ArrowRight size={15}/></Link>)}</div>
        <div className="home-doc-strip"><div><strong>Need the complete engineering reference?</strong><span>Open the documentation tree, then drill into a specific concept without losing the navigation context.</span></div><Link to="/docs" className="agata-button agata-button-primary">Open documentation <ArrowRight size={16}/></Link></div>
      </div>
    </section>

    <section className="public-section">
      <div className="agata-container">
        <div className="public-section-header"><div className="public-eyebrow">Built for serious systems</div><h2>Security-sensitive workloads deserve inspectable infrastructure.</h2><p>Proxima is designed for teams that need a boundary they can operate, test, audit and explain to customers and security reviewers.</p></div>
        <div className="home-audience-grid">{[["B2B SaaS","/solutions/b2b-saas"],["Enterprise applications","/solutions/enterprise-saas"],["Developer platforms","/solutions/developer-platforms"],["Security-sensitive workloads","/solutions/security-sensitive"]].map(([label,to])=><Link className="home-audience-link" to={to} key={label}><Check size={18} color="var(--agata-blue)"/><span>{label}</span><ArrowRight size={16}/></Link>)}</div>
      </div>
    </section>

    <section className="public-section public-section-dark">
      <div className="agata-container home-final-cta"><div><div className="public-eyebrow">Ready to inspect the platform?</div><h2>Start with the docs. Then open the control plane.</h2><p>Move from architecture to an authenticated workspace and test the real operational flow.</p></div><div className="public-hero-actions"><Link to="/docs/getting-started" className="agata-button agata-button-secondary">Getting started <ArrowRight size={16}/></Link><Link to="/signup" className="agata-button agata-button-primary">Create workspace <ArrowRight size={16}/></Link></div></div>
    </section>
  </div>;
}
