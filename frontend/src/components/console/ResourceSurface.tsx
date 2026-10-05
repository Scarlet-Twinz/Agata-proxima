import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight } from "lucide-react";

type Props = {
  title: string;
  eyebrow: string;
  description: string;
  links?: { label: string; href: string }[];
};

export function ResourceSurface({
  title,
  eyebrow,
  description,
  links = [],
}: Props) {
  const { tenantId, policyId, nodeId, deploymentId, runId, eventId } =
    useParams();

  const resourceId =
    tenantId ??
    policyId ??
    nodeId ??
    deploymentId ??
    runId ??
    eventId;

  return (
    <div className="resource-page">
      <Link className="back-link" to="/app">
        <ArrowLeft size={16} />
        Command Center
      </Link>

      <div className="page-heading">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>

      {resourceId && (
        <div className="resource-identity">
          <span>Resource</span>
          <strong>{resourceId}</strong>
        </div>
      )}

      <div className="resource-layout">
        <section className="surface">
          <span className="eyebrow">CONTROL PLANE</span>
          <h2>Live resource state</h2>

          <div className="empty-state">
            <strong>No resource telemetry returned yet.</strong>
            <span>
              This surface is wired for backend data and will not manufacture
              state when the control plane has not returned it.
            </span>
          </div>
        </section>

        <aside className="surface resource-links">
          <span className="eyebrow">RELATED</span>

          {links.map((link) => (
            <Link key={link.href} to={link.href}>
              {link.label}
              <ArrowUpRight size={16} />
            </Link>
          ))}
        </aside>
      </div>
    </div>
  );
}
