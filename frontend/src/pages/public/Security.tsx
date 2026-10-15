import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { PublicPage } from "../../components/layout/PublicPage";

const controls = [
  ["Identity and authorization", "Authenticate the caller, resolve the active organization and enforce role permissions. A valid session alone must not grant access to every resource.", "/developers/authentication"],
  ["Tenant context", "Resolve tenant identity from trusted application state and carry it through the protected request path. Do not trust a client-supplied tenant ID without authorization.", "/developers/tenant-context"],
  ["Runtime enforcement", "Reject missing, malformed or unauthorized tenant context before protected operations proceed. Verify this behavior through the actual runtime path.", "/product/enforcement"],
  ["PostgreSQL controls", "Use least-privilege roles and row-level security as complementary database protections. Proxima does not replace database controls.", "/docs/security"],
  ["Verification", "Test tenant-local success, cross-tenant read/write rejection, missing context and malformed context in a controlled environment.", "/docs/verification"],
  ["Audit and operations", "Use audit records, verification outcomes, deployment observations and runbooks to investigate changes. Do not interpret a single health signal as proof of isolation.", "/product/evidence"],
];

export function Security() {
  return <PublicPage eyebrow="Security model" title="Layered tenant isolation with explicit enforcement and verification." description="Agata Proxima's security model depends on explicit identity, tenant context, runtime enforcement, PostgreSQL controls and environment-level verification.">
    <section className="public-content"><div className="agata-container">
      <article className="public-prose">
        <h2>Security responsibilities</h2>
        <p>Agata Proxima is one part of a layered security design. Customers remain responsible for application authentication, database configuration, network controls, secret management, backups and the correctness of their own deployment. The security workflow combines control-plane configuration with tests of the protected data path.</p>
        <h2>Minimum acceptance matrix</h2>
        <ol>
          <li>Tenant A performs an allowed operation on tenant A data.</li>
          <li>Tenant A attempts to read tenant B data; the operation is denied.</li>
          <li>Tenant A attempts to modify tenant B data; the operation is denied.</li>
          <li>Requests with missing, malformed or expired context are rejected according to the contract.</li>
          <li>Database roles and row-level security are tested independently where applicable.</li>
          <li>The tester records environment, timestamp, policy/deployment version and observed evidence.</li>
        </ol>
        <h2>Claims and assurances</h2>
        <p>Agata Proxima provides the architecture and verification workflows described here. Certifications, independent assessment reports and contractual assurances are published only when the corresponding current evidence is available.</p>
      </article>
      <div className="public-feature-grid" style={{ marginTop: 28 }}>{controls.map(([title, text, to]) => <article className="public-feature" key={title}><h3>{title}</h3><p>{text}</p><Link to={to} className="public-inline-link">Read the procedure <ArrowRight size={15} /></Link></article>)}</div>
      <div className="public-detail-links" style={{ marginTop: 28 }}><Link to="/docs/verification" className="agata-button agata-button-primary">Verification checklist</Link><Link to="/trust" className="agata-button agata-button-secondary">Trust center</Link><Link to="/support/request?topic=security" className="agata-button agata-button-secondary">Report a security concern</Link></div>
    </div></section>
  </PublicPage>;
}
