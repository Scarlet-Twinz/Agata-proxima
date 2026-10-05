import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

export function Company() {
  return <PublicPage eyebrow="Company" title="Building infrastructure that makes difficult security properties easier to operate." description="Agata Proxima is built around a simple idea: tenant isolation should be an infrastructure property that engineering teams can enforce, inspect and independently verify.">
    <section className="public-content"><div className="agata-container">
      <article className="public-prose">
        <h2>Why Agata exists</h2>
        <p>Multi-tenant software creates a difficult security boundary. Every request carries identity, every protected operation depends on tenant context, and every service can become another place where isolation assumptions can fail. Agata Proxima is being built to make that boundary explicit instead of leaving it scattered across application code.</p>
        <p>The platform sits between customer application identity and protected data access. Its job is not to replace the systems teams already use, but to give those systems a stronger operational boundary: enforce the tenant context, reject unauthorized cross-tenant paths, verify the expected behavior and preserve evidence that security teams can inspect.</p>

        <h2>Engineering first</h2>
        <p>Agata is designed for the people who have to build and operate the system after the architecture diagram is finished. That means the product needs clear control surfaces for tenants, policies, infrastructure, deployments, verification, audit evidence, security, team access and developer integration.</p>

        <h2>Evidence over claims</h2>
        <p>A security product should not ask customers to trust a paragraph on a marketing page when the underlying property can be tested. Agata's model therefore treats verification and operational evidence as first-class concepts. The goal is to make security decisions inspectable: what tenant context arrived, what policy applied, what decision was made and what evidence was produced.</p>

        <h2>A platform for serious multi-tenant systems</h2>
        <p>The intended customers include B2B SaaS teams, enterprise applications, developer platforms and security-sensitive systems that need tenant isolation to remain understandable as the number of customers, services and environments grows.</p>

        <h2>How the product fits together</h2>
        <pre className="public-code">{`Customer application
        ↓
Identity + tenant context
        ↓
Agata Proxima enforcement boundary
        ↓
PostgreSQL roles / RLS
        ↓
Verification
        ↓
Audit evidence`}</pre>

        <div className="public-callout">
          <strong>Build with the platform.</strong>
          <p>Explore the developer model, understand the architecture and create a workspace when you are ready to integrate.</p>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:20}}>
            <Link to="/developers" className="agata-button agata-button-secondary">Developer platform</Link>
            <Link to="/signup" className="agata-button agata-button-primary">Start building</Link>
          </div>
        </div>
      </article>
    </div></section>
  </PublicPage>;
}
