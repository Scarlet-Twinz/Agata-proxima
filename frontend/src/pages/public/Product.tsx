import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { PublicPage } from "../../components/layout/PublicPage";

const areas = [
  ["Operating model", "How organizations, tenants, policy intent, runtime enforcement and evidence work together.", "/product/model"],
  ["Enforcement", "How trusted identity and tenant context are checked before protected data operations.", "/product/enforcement"],
  ["Verification", "How to test permitted access and rejected cross-tenant operations.", "/product/verification"],
  ["Evidence", "How verification results and audit events help operators investigate changes and outcomes.", "/product/evidence"],
];

export function Product() {
  return <PublicPage eyebrow="Product" title="Tenant isolation that is explicit, enforceable and testable." description="Agata Proxima brings tenant inventory, policy management, deployment workflows, verification and audit evidence into one control-plane model around the protected PostgreSQL request path.">
    <section className="public-content"><div className="agata-container">
      <article className="public-prose">
        <h2>The problem</h2>
        <p>When many customers share one application and database, tenant identity defines a security boundary. A mistaken identity mapping, missing tenant filter or over-privileged database role can expose one customer's records to another. Agata Proxima gives engineering teams a consistent infrastructure model for managing and testing that boundary.</p>
        <h2>How the request path works</h2>
        <pre className="public-code">{`1. Authenticate the user or service
2. Resolve organization and tenant context from trusted state
3. Apply authorization and Proxima enforcement
4. Execute against PostgreSQL with least-privilege roles and RLS
5. Test allowed and denied behavior
6. Inspect verification results and audit events`}</pre>
        <p>Each layer has a defined responsibility: identity establishes who is calling, tenant context identifies the customer boundary, Proxima enforces the configured request path, and PostgreSQL roles/RLS protect the data layer. Verification and audit workflows make changes and outcomes inspectable.</p>
        <h2>What teams manage in the control plane</h2>
        <p>Manage tenant inventory, policies, nodes, deployments, verification, audit activity, team access, API keys, environments and webhook delivery. Organization roles and plan entitlements determine which actions are available to each user.</p>
        <h2>Start with a real integration</h2>
        <ol>
          <li>Map the application's identity and tenant-resolution flow.</li>
          <li>Identify the database path that must be protected.</li>
          <li>Configure a test environment with controlled tenants.</li>
          <li>Run a permitted operation and cross-tenant read/write attempts.</li>
          <li>Inspect verification results and audit history before expanding the protected path.</li>
        </ol>
      </article>
      <div className="public-feature-grid public-product-area-grid" style={{ marginTop: 28 }}>
        {areas.map(([title, text, to]) => <article className="public-feature" key={title}><h3>{title}</h3><p>{text}</p><Link to={to} className="public-inline-link">Explore {title} <ArrowRight size={15} /></Link></article>)}
      </div>
      <div className="public-detail-links" style={{ marginTop: 28 }}><Link to="/docs/getting-started" className="agata-button agata-button-primary">Get started</Link><Link to="/docs/verification" className="agata-button agata-button-secondary">Verification checklist</Link><Link to="/developers" className="agata-button agata-button-secondary">Developer platform</Link></div>
    </div></section>
  </PublicPage>;
}
