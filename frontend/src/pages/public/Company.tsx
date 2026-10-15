import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

export function Company() {
  return <PublicPage eyebrow="About Agata Proxima" title="Infrastructure for trustworthy multi-tenant software." description="Agata Proxima helps SaaS teams manage tenant boundaries through explicit control-plane resources, runtime enforcement, verification and audit evidence.">
    <section className="public-content"><div className="agata-container">
      <article className="public-prose">
        <h2>The problem</h2>
        <p>Multi-tenant software allows many customer organizations to use one application and shared infrastructure. That model can be efficient, but it creates a serious responsibility: every protected request must stay within the right customer's boundary. A missing filter, confused identity, overly broad database privilege or incorrect tenant context can turn a small defect into a cross-customer data exposure.</p>
        <p>Agata Proxima brings that boundary into the infrastructure model. The control plane manages the resources and operational intent around tenant isolation; the protected request path connects trusted identity and tenant context to enforcement and PostgreSQL controls. Verification and audit information help teams review configuration, tests and operational changes.</p>
        <h2>What teams use Agata Proxima to do</h2>
        <ol>
          <li>Represent organizations and tenants explicitly instead of relying on informal conventions.</li>
          <li>Manage policies, nodes and deployment intent in one operational model.</li>
          <li>Test valid tenant-local operations and deliberately attempt prohibited cross-tenant operations.</li>
          <li>Review verification results and audit events when investigating a change or incident.</li>
          <li>Integrate through documented APIs and event workflows with credentials and permissions handled server-side.</li>
        </ol>
        <h2>Who it is for</h2>
        <p>Agata Proxima serves the needs of small teams launching multi-tenant products, growing SaaS businesses, medium-sized engineering organizations and enterprises operating complex fleets. The shared requirement is the same: tenant isolation must be managed, exercised and reviewed as an infrastructure concern.</p>
        <h2>How the platform fits into your architecture</h2>
        <ul>
          <li>PostgreSQL roles and row-level security remain important data-layer controls.</li>
          <li>Your identity provider continues to authenticate users and services.</li>
          <li>Verification should exercise the actual application-to-database path.</li>
          <li>Formal certifications and contractual service commitments are separate assurance artifacts.</li>
        </ul>
        <h2>How we approach engineering</h2>
        <p>We build around explicit contracts, least-privilege access, repeatable tests and inspectable operational evidence. Engineering changes are evaluated through code review, automated checks and environment-level acceptance.</p>
      </article>
      <div className="public-detail-links" style={{ marginTop: 28 }}>
        <Link to="/product/model" className="agata-button agata-button-primary">Read the architecture</Link>
        <Link to="/docs/verification" className="agata-button agata-button-secondary">See verification steps</Link>
        <Link to="/contact" className="agata-button agata-button-secondary">Contact Agata</Link>
      </div>
    </div></section>
  </PublicPage>;
}
