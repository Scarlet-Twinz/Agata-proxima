import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { PublicPage } from "../../components/layout/PublicPage";

const controls = [
  ["Identity", "Establish who is making the request before protected tenant context is accepted.", "/developers/authentication"],
  ["Tenant context", "Carry tenant identity through the protected request path instead of treating it as an untrusted parameter.", "/developers/tenant-context"],
  ["Enforcement", "Reject invalid, missing, expired or cross-tenant context before protected operations proceed.", "/product/enforcement"],
  ["Database controls", "Work with PostgreSQL roles and row-level security as part of a layered isolation model.", "/docs/security"],
  ["Verification", "Exercise the boundary and verify both expected allows and expected blocks.", "/docs/verification"],
  ["Audit evidence", "Preserve operational evidence around security decisions and verification activity.", "/product/evidence"],
];

export function Security() {
  return (
    <PublicPage eyebrow="Security" title="A security boundary designed to be enforced and tested." description="Agata Proxima treats tenant isolation as an infrastructure concern instead of relying solely on application discipline.">
      <section className="public-content">
        <div className="agata-container">
          <div className="public-feature-grid">
            {controls.map(([title, text, to]) => (
              <article className="public-feature" key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
                <Link to={to} className="public-inline-link">Explore control <ArrowRight size={15} /></Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
