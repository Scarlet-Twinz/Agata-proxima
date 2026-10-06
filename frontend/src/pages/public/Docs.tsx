import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const resources = [
  ["Getting started","Connect a development application and understand the Proxima request path.","/docs/getting-started"],
  ["Core concepts","Organizations, tenants, policies, nodes, verification and evidence.","/docs/core-concepts"],
  ["API reference","Understand the control-plane API and its operational contracts.","/docs/api-reference"],
  ["Security","Learn how identity and tenant context interact with the enforcement boundary.","/docs/security"],
  ["Operations","Deployments, fleet operations, verification and audit workflows.","/docs/operations"],
  ["Troubleshooting","Diagnose authentication, policy, database and verification failures.","/docs/troubleshooting"],
  ["Verification","Run explicit tests of tenant isolation behavior.","/docs/verification"],
];

export function Docs() {
  return (
    <PublicPage
      eyebrow="Documentation"
      title="Everything your engineering team needs to understand Proxima."
      description="Learn the architecture, integration model, API contracts, tenant context, verification workflow and operational model."
    >
      <section className="public-content">
        <div className="agata-container">
          <div className="public-feature-grid">
            {resources.map(([title,text,to]) => (
              <article className="public-feature" key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
                <Link to={to} className="public-inline-link">Read guide <ArrowRight size={15} /></Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
