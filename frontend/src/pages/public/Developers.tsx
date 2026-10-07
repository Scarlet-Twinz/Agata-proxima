import { ArrowRight, ShieldCheck, Terminal, Webhook, KeyRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const resources: { title:string; text:string; to:string; Icon:LucideIcon }[] = [
  {title:"Quickstart",text:"Understand the integration path from application identity to Proxima and PostgreSQL.",to:"/developers/quickstart",Icon:ShieldCheck},
  {title:"Authentication",text:"Work with credentials, service identities and organization authentication.",to:"/developers/authentication",Icon:KeyRound},
  {title:"Tenant context",text:"Keep tenant identity attached to the protected request path.",to:"/developers/tenant-context",Icon:ShieldCheck},
  {title:"Webhooks and events",text:"Connect verification, security and operational events to existing systems.",to:"/developers/webhooks",Icon:Webhook},
  {title:"API reference",text:"Explore the authenticated control-plane resource contracts.",to:"/developers/api-reference",Icon:Terminal},
  {title:"CLI and Terraform",text:"Bring Proxima into command-line and infrastructure-as-code workflows.",to:"/developers/cli",Icon:Terminal},
];

export function Developers() {
  return (
    <PublicPage eyebrow="Developer platform" title="Integrate Proxima into the infrastructure you already operate." description="The developer experience is built around explicit contracts: identity, tenant context, policy, deployment, verification and evidence.">
      <section className="public-content">
        <div className="agata-container">
          <div className="public-feature-grid">
            {resources.map(({title,text,to,Icon}) => (
              <article className="public-feature" key={title}>
                <Icon size={22} color="var(--agata-blue)"/><h3>{title}</h3><p>{text}</p>
                <Link to={to} className="public-inline-link">Open resource <ArrowRight size={15}/></Link>
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
