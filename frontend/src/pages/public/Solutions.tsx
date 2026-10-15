import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const solutions = [
  ["Small SaaS teams", "Establish a tenant-isolation model early, document the protected data path and test cross-tenant denial before customer growth makes the system harder to reason about.", "/solutions/startups"],
  ["Growing B2B SaaS", "Manage tenant inventory, policies, deployment targets and verification as the application and customer count expand.", "/solutions/b2b-saas"],
  ["Medium-sized engineering teams", "Give application, platform and security teams a shared view of tenant boundaries, policy intent and operational evidence.", "/solutions/platform-engineering"],
  ["Enterprise applications", "Evaluate tenant enforcement alongside existing identity, database, deployment and governance controls; map the product to the organization's actual requirements.", "/solutions/enterprise-saas"],
  ["Developer platforms", "Keep tenant context explicit across APIs and services, and test that one customer cannot reach another customer's protected resources.", "/solutions/developer-platforms"],
  ["Security-sensitive workloads", "Use repeatable negative tests and auditable operational records to investigate whether the expected boundary is being enforced.", "/solutions/security-sensitive"],
];

export function Solutions() {
  return <PublicPage eyebrow="Use cases" title="For teams that share infrastructure across customers." description="Agata Proxima is intended for multi-tenant software teams of different sizes. The common requirement is a tenant boundary that can be operated and tested, not a particular company size.">
    <section className="public-content"><div className="agata-container">
      <article className="public-prose"><h2>Start from the risk, not the company label</h2><p>If your application stores data for multiple customer organizations, ask how identity is mapped to a tenant, where that context is enforced, how PostgreSQL permissions are configured, and how a cross-tenant access attempt is tested. Those questions matter whether the team has two engineers or several platform groups.</p><p>Agata Proxima gives these teams a shared control-plane and enforcement model for tenant boundaries, repeatable verification and operational evidence. The guides show how to apply it to each architecture.</p></article>
      <div className="public-feature-grid" style={{ marginTop: 28 }}>{solutions.map(([title, text, to]) => <article className="public-feature" key={title}><h3>{title}</h3><p>{text}</p><Link to={to} className="public-inline-link">Explore use case <ArrowRight size={15} /></Link></article>)}</div>
      <div className="public-detail-links" style={{ marginTop: 28 }}><Link to="/product" className="agata-button agata-button-primary">Explore the product</Link><Link to="/docs/getting-started" className="agata-button agata-button-secondary">Getting started</Link></div>
    </div></section>
  </PublicPage>;
}
