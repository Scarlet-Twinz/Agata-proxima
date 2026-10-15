import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const resources = [
  ["Documentation", "Follow setup, integration, security and operations procedures before changing production configuration.", "documentation"],
  ["Troubleshooting", "Diagnose login, API, database, verification, email and webhook failures using a repeatable checklist.", "troubleshooting"],
  ["Security concerns", "Report a suspected security issue with safe reproduction details and sanitized evidence.", "security"],
  ["Customer support", "Ask about a workspace, plan limits, organization access or a product workflow.", "customer"],
];

export function Support() {
  return <PublicPage eyebrow="Support" title="Get help with a specific Agata Proxima issue." description="Start with the right guide, then send a support request that includes enough detail to investigate without exposing secrets or customer data.">
    <section className="public-content"><div className="agata-container">
      <div className="public-feature-grid">{resources.map(([title, text, topic]) => <Link to={`/support/request?topic=${topic}`} key={title} className="public-feature public-feature-action"><h3>{title}</h3><p>{text}</p><span className="public-inline-link">Open {title.toLowerCase()} <ArrowRight size={15} /></span></Link>)}</div>
      <article className="public-prose" style={{ marginTop: 32 }}><h2>What to include in a useful support request</h2><ol><li>Environment: local, test or production, plus the affected service name.</li><li>Timestamp and timezone of the failure.</li><li>Expected behavior and what happened instead.</li><li>Steps to reproduce, relevant resource IDs and sanitized request/correlation IDs.</li><li>Checks already attempted and whether the issue is repeatable.</li></ol><p>Never include passwords, API keys, session cookies, webhook signing secrets, private keys or unnecessary customer payloads.</p></article>
      <div className="public-request-open"><div><strong>Still need help?</strong><p>Send the details through the support form. A successful submission returns a request reference you can use when following up.</p></div><Link to="/support/request" className="agata-button agata-button-primary">Open support request</Link></div>
    </div></section>
  </PublicPage>;
}
