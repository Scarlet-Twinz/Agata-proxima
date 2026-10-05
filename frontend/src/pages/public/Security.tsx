import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const controls = [
  ["Identity", "Establish who is making the request before protected tenant context is accepted.", "/developers/authentication"],
  ["Tenant context", "Carry tenant identity through the protected request path instead of treating it as an untrusted parameter.", "/developers/tenant-context"],
  ["Enforcement", "Reject invalid, missing, expired or cross-tenant context before protected operations proceed.", "/docs/security"],
  ["Database controls", "Work with PostgreSQL roles and row-level security as part of a layered isolation model.", "/product"],
  ["Verification", "Exercise the boundary and verify both expected allows and expected blocks.", "/developers/verification"],
  ["Audit evidence", "Preserve operational evidence around security decisions and verification activity.", "/docs/operations"],
];

export function Security() {
  return (
    <PublicPage
      eyebrow="Security"
      title="A security boundary designed to be enforced and tested."
      description="Agata Proxima treats tenant isolation as an infrastructure concern instead of relying solely on application discipline."
    >
      <section className="public-content">
        <div className="agata-container">
          <div className="public-feature-grid">
            {controls.map(([title, text, to]) => (
              <Link key={to} to={to} className="public-feature public-feature-link">
                <span className="public-feature-kicker">Security control</span>
                <h3>{title}</h3>
                <p>{text}</p>
                <strong>Inspect control →</strong>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
