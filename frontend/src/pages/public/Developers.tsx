import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const developerGuides = [
  ["Quickstart", "Go from an application identity to a protected Proxima request and verify the first isolation decision.", "/developers/quickstart"],
  ["Authentication", "Understand API credentials, service identities, sessions and enterprise identity configuration.", "/developers/authentication"],
  ["Tenant context", "Learn how tenant identity is carried through the protected request path and checked at the boundary.", "/developers/tenant-context"],
  ["Verification", "Exercise expected allow/block behavior and turn the result into inspectable evidence.", "/developers/verification"],
  ["API reference", "Explore the public control-plane contract, operation groups, inputs, outputs and errors.", "/developers/api-reference"],
  ["Webhooks and events", "Connect lifecycle, security and verification events to the systems your team already operates.", "/developers/webhooks"],
];

export function Developers() {
  return (
    <PublicPage
      eyebrow="Developer platform"
      title="Integrate tenant isolation into the infrastructure you already have."
      description="The developer platform is a set of actual integration guides and contracts—not a list of labels. Start with the request path, then go as deep as your system requires."
    >
      <section className="public-content">
        <div className="agata-container">
          <div className="public-feature-grid">
            {developerGuides.map(([title, text, to]) => (
              <Link key={to} to={to} className="public-feature public-feature-link">
                <span className="public-feature-kicker">Developer guide</span>
                <h3>{title}</h3>
                <p>{text}</p>
                <strong>Open guide →</strong>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
