import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

export function Trust() {
  return <PublicPage eyebrow="Trust center" title="Review the architecture, controls and evidence behind Agata Proxima." description="Our trust model is built around inspectable architecture, explicit controls, repeatable tests and clear evidence.">
    <section className="public-content"><div className="agata-container"><article className="public-prose">
      <h2>Architecture and shared responsibility</h2>
      <p>The Agata Proxima model separates administrative control-plane functions from the runtime tenant-isolation path. It works alongside application identity, PostgreSQL permissions and row-level security. Verification workflows exercise the configured path and record the environment and observed outcomes.</p>
      <h2>Evidence we expect to retain</h2>
      <ul><li>Which environment and build were tested.</li><li>The identity, organization and test tenants used.</li><li>The policy/deployment version and relevant resource IDs.</li><li>Expected and observed outcomes for allowed and denied operations.</li><li>Failure details, remediation and any checks that were skipped.</li></ul>
      <h2>Assurance and evidence</h2>
      <p>Security certifications, independent assessment reports and contractual service commitments are provided only where a current, approved report or agreement exists. For an evaluation, request the specific evidence relevant to your requirements.</p>
      <h2>Security issue reporting</h2>
      <p>Report a concern through the security support route. Include a concise description, the affected component, steps to reproduce and sanitized evidence. Do not include customer records, passwords, API keys, cookies or signing secrets.</p>
      <h2>Operational transparency</h2>
      <p>Operational status should be read from the relevant service health signals and delivery history. Verification results identify the environment and checks performed, so teams can evaluate the evidence in context.</p>
      <div className="public-detail-links"><Link to="/security" className="agata-button agata-button-secondary">Security model</Link><Link to="/docs/verification" className="agata-button agata-button-secondary">Verification procedure</Link><Link to="/support/request?topic=security" className="agata-button agata-button-primary">Report a concern</Link></div>
    </article></div></section>
  </PublicPage>;
}
