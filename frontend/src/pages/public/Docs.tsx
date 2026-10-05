import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const docs = [
  ["Getting started", "Set up a workspace, connect a development application and follow the first protected request.", "/docs/getting-started"],
  ["Core concepts", "Understand organizations, projects, tenants, policies, nodes, verification and audit evidence.", "/docs/core-concepts"],
  ["API reference", "Read the control-plane operations, request shapes, responses, authentication and failure behavior.", "/docs/api-reference"],
  ["Security", "Understand the enforcement boundary, tenant context, database controls and verification model.", "/docs/security"],
  ["Operations", "Learn how deployments, nodes, environments, verification runs and audit workflows fit together.", "/docs/operations"],
  ["Troubleshooting", "Diagnose authentication, tenant-context, policy, database and verification failures.", "/docs/troubleshooting"],
];

export function Docs() {
  return (
    <PublicPage
      eyebrow="Documentation"
      title="Documentation for engineers building on an enforceable tenant boundary."
      description="Use the documentation to understand the architecture first, then move into integration, API contracts, security behavior and operations."
    >
      <section className="public-content">
        <div className="agata-container">
          <div className="public-feature-grid">
            {docs.map(([title, text, to]) => (
              <Link key={to} to={to} className="public-feature public-feature-link">
                <span className="public-feature-kicker">Guide</span>
                <h3>{title}</h3>
                <p>{text}</p>
                <strong>Read guide →</strong>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
