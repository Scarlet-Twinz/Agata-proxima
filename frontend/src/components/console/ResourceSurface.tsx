import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, BookOpen } from "lucide-react";

type Props = {
  title: string;
  eyebrow: string;
  description: string;
  docsHref?: string;
  docsLabel?: string;
  links?: { label: string; href: string }[];
};

export function ResourceSurface({ title, eyebrow, description, docsHref, docsLabel = "Read full documentation", links = [] }: Props) {
  const { tenantId, policyId, nodeId, deploymentId, runId, eventId } = useParams();
  const resourceId = tenantId ?? policyId ?? nodeId ?? deploymentId ?? runId ?? eventId;

  return <div className="resource-page">
    <Link className="back-link" to="/app"><ArrowLeft size={16}/> Command Center</Link>
    <div className="page-heading">
      <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
      {docsHref && <Link className="agata-button agata-button-secondary" to={docsHref}><BookOpen size={16}/>{docsLabel}</Link>}
    </div>
    {resourceId && <div className="resource-identity"><span>Resource</span><strong>{resourceId}</strong></div>}
    <div className="resource-layout">
      <section className="surface">
        <span className="eyebrow">CONTROL PLANE</span>
        <h2>Live resource state</h2>
        <div className="empty-state">
          <strong>Waiting for backend resource telemetry.</strong>
          <span>This surface never invents operational state. When the API has no resource data, the UI explicitly says so instead of displaying fake health, counts or security results.</span>
        </div>
        {docsHref && <Link className="public-inline-link" to={docsHref}>Understand this resource <ArrowUpRight size={15}/></Link>}
      </section>
      <aside className="surface resource-links">
        <span className="eyebrow">RELATED</span>
        {links.map(link => <Link key={link.href} to={link.href}>{link.label}<ArrowUpRight size={16}/></Link>)}
      </aside>
    </div>
  </div>;
}
