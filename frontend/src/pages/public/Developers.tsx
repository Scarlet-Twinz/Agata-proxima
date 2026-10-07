import { ArrowRight, ShieldCheck, Terminal, Webhook, KeyRound } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const resources = [
  ["Quickstart","Understand the integration path from application identity to Proxima and PostgreSQL.","/developers/quickstart",ShieldCheck],
  ["Authentication","Work with credentials, service identities and organization authentication.","/developers/authentication",KeyRound],
  ["Tenant context","Keep tenant identity attached to the protected request path.","/developers/tenant-context",ShieldCheck],
  ["Webhooks and events","Connect verification, security and operational events to existing systems.","/developers/webhooks",Webhook],
  ["API reference","Explore the authenticated control-plane resource contracts.","/developers/api-reference",Terminal],
  ["CLI and Terraform","Bring Proxima into command-line and infrastructure-as-code workflows.","/developers/cli",Terminal],
];

export function Developers() {
  return (
    <PublicPage eyebrow="Developer platform" title="Integrate Proxima into the infrastructure you already operate." description="The developer experience is built around explicit contracts: identity, tenant context, policy, deployment, verification and evidence.">
      <section className="public-content">
        <div className="agata-container">
          <div className="public-feature-grid">
            {resources.map(([title,text,to,Icon]) => (
              <article className="public-feature" key={title}>
                <Icon size={22} color="var(--agata-blue)"/><h3>{title}</h3><p>{text}</p>
                <Link to={to as string} className="public-inline-link">Open resource <ArrowRight size={15}/></Link>
              </article>
            ))}
          </div>
          <div className="public-prose" style={{marginTop:"72px"}}>
            <h2>The integration contract</h2>
            <p>Authentication answers who is acting. Tenant context answers which customer boundary is in scope. Proxima evaluates that context before protected database work proceeds, while PostgreSQL roles and RLS provide the database-side enforcement layer.</p>
            <p>The control plane exposes management resources for organizations, tenants, policies, nodes, deployments, verification results, audit events and support. The runtime Engine remains the data-plane authority and must continue enforcing isolation even when management services are unavailable.</p>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
