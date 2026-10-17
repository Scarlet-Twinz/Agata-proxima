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
  ["Authentication", "Human sessions, organization roles and machine credentials.", "/developers/authentication"],
  ["Webhooks", "Signed event delivery, attempt history and receiver verification.", "/developers/webhooks"],
  ["API reference", "The control-plane contract and authenticated request examples.", "/developers/api-reference"],
  ["Quickstart", "A step-by-step path to a controlled tenant-isolation test.", "/developers/quickstart"],
  ["Events and audit", "Understand event scope, evidence and operational history.", "/developers/events"],
];

export function Home() {
  return <div>
    <section className="public-hero">
      <div className="agata-container public-hero-grid">
        <div>
          <div className="public-eyebrow">Tenant isolation infrastructure</div>
          <h1>Protect the boundary between one customer and the next.</h1>
          <p className="public-hero-copy">Agata Proxima is tenant-isolation infrastructure for multi-tenant applications. It helps teams connect trusted identity and tenant context to enforcement, PostgreSQL protections and repeatable verification.</p>
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
            <div className="platform-status platform-status--informational"><span className="platform-status-dot"/>Layered tenant-isolation architecture</div>
          </div>
        </div>
      </div>
    </section>

    <section className="public-section">
      <div className="agata-container">
        <div className="public-section-header"><div className="public-eyebrow">How the product works</div><h2>From tenant identity to evidence, with clear steps.</h2><p>Start by identifying the tenant, define the policy, connect the runtime path, then test both allowed and denied access. The documentation walks through each step, with implementation guides and verification checklists.</p></div>
        <div className="home-three-up">{[
          {title:"Enforce",text:"Tenant context is enforced before protected database operations reach the data layer.",icon:Network},
          {title:"Verify",text:"Isolation behavior can be tested instead of being accepted as an assumption.",icon:FileCheck2},
          {title:"Prove",text:"Security events and verification outcomes become operational evidence.",icon:ShieldCheck},
        ].map(item=>{const Icon=item.icon;return <Link to={item.title==="Enforce"?"/product/enforcement":item.title==="Verify"?"/product/verification":"/product/evidence"} className="home-three-up-card" key={item.title}><Icon size={22} color="var(--agata-blue)"/><h3>{item.title}</h3><p>{item.text}</p><span className="home-card-link">Explore <ArrowRight size={14}/></span></Link>})}</div>
      </div>
    </section>

    <section className="public-section public-section-dark">
      <div className="agata-container">
        <div className="public-section-header"><div className="public-eyebrow">Platform map</div><h2>Manage the work in a connected sequence.</h2><p>Create the resources your environment needs, deploy the intended configuration, run verification and inspect audit history. Use verification to confirm the configured runtime behavior and inspect the resulting evidence.</p></div>
        <div className="home-operating-grid">{operatingAreas.map(([title,text,to])=><Link key={title} to={to}><strong>{title}</strong><span>{text}</span><ArrowRight size={16}/></Link>)}</div>
      </div>
    </section>

    <section className="public-section">
      <div className="agata-container">
        <div className="public-section-header"><div className="public-eyebrow">Developer experience</div><h2>Developer guides for APIs, webhooks and integrations.</h2><p>Explore authentication, API requests, webhook delivery, SDK implementation, CLI workflows, Terraform provider requirements and integration recipes for your stack.</p></div>
        <div className="home-developer-grid">{developerAreas.map(([title,text,to])=><Link key={title} to={to}><span className="home-dev-icon">{title==="Webhooks"?<Webhook size={18}/>:title==="API reference"?<Database size={18}/>:title==="Events and audit"?<ShieldCheck size={18}/>:<Terminal size={18}/>}</span><span><strong>{title}</strong><small>{text}</small></span><ArrowRight size={15}/></Link>)}</div>
        <div className="home-doc-strip"><div><strong>Need the complete engineering reference?</strong><span>Open the documentation tree, then drill into a specific concept without losing the navigation context.</span></div><Link to="/docs" className="agata-button agata-button-primary">Open documentation <ArrowRight size={16}/></Link></div>
      </div>
    </section>

    <section className="public-section home-integrations-section">
      <div className="agata-container">
        <div className="public-section-header">
          <div className="public-eyebrow">Integration ecosystem</div>
          <h2>Connect the parts of your application that need a tenant boundary.</h2>
          <p>Connect application services through the control-plane API, signed webhooks and platform-specific integration recipes.</p>
        </div>
        <div className="home-integration-grid">
          <article className="home-integration-card">
            <span className="home-integration-badge"><Database size={19}/></span>
            <div><span className="public-eyebrow">APPLICATION ACCESS</span><h3>Authenticated APIs</h3></div>
            <p>Connect an application through documented API contracts, scoped credentials and explicit organization or tenant context.</p>
            <Link to="/developers/quickstart">Explore the quickstart <ArrowRight size={14}/></Link>
          </article>
          <article className="home-integration-card">
            <span className="home-integration-badge home-integration-badge--events"><Webhook size={19}/></span>
            <div><span className="public-eyebrow">EVENT DELIVERY</span><h3>Webhooks and events</h3></div>
            <p>Configure event endpoints, inspect delivery history and verify receiver behavior before relying on events for critical workflows.</p>
            <Link to="/developers/webhooks">Explore webhook guidance <ArrowRight size={14}/></Link>
          </article>
          <article className="home-integration-card">
            <span className="home-integration-badge"><ShieldCheck size={19}/></span>
            <div><span className="public-eyebrow">VERIFIABLE OPERATIONS</span><h3>Audit and verification</h3></div>
            <p>Inspect verification results and operational evidence so integrations can be tested against the intended security boundary.</p>
            <Link to="/developers/verification">Explore verification <ArrowRight size={14}/></Link>
          </article>
        </div>
      </div>
    </section>

    <section className="public-section">
      <div className="agata-container">
        <div className="public-section-header"><div className="public-eyebrow">Built for serious systems</div><h2>For teams of different sizes sharing infrastructure across customers.</h2><p>Whether you are a small startup, a growing SaaS company, a medium-sized engineering organization or a larger enterprise, the key question is whether you need tenant isolation to be explicit and testable.</p></div>
        <div className="home-audience-grid">{[["B2B SaaS","/solutions/b2b-saas"],["Enterprise applications","/solutions/enterprise-saas"],["Developer platforms","/solutions/developer-platforms"],["Security-sensitive workloads","/solutions/security-sensitive"]].map(([label,to])=><Link className="home-audience-link" to={to} key={label}><Check size={18} color="var(--agata-blue)"/><span>{label}</span><ArrowRight size={16}/></Link>)}</div>
      </div>
    </section>

    <section className="public-section public-section-dark">
      <div className="agata-container home-final-cta"><div><div className="public-eyebrow">Ready to inspect the platform?</div><h2>Understand the model. Configure a test environment. Verify the boundary.</h2><p>Follow the step-by-step guide, use controlled test tenants and retain the evidence from the environment you actually tested.</p></div><div className="public-hero-actions"><Link to="/docs/getting-started" className="agata-button agata-button-secondary">Getting started <ArrowRight size={16}/></Link><Link to="/signup" className="agata-button agata-button-primary">Create workspace <ArrowRight size={16}/></Link></div></div>
    </section>
  </div>;
}
