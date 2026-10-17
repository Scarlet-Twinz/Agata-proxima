import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const destinations = [
  ["Product and adoption", "Discuss whether the tenant-isolation model fits your application's architecture and operational requirements.", "customers"],
  ["Developer questions", "Ask about API contracts, tenant context, authentication, webhooks or verification workflows.", "developers"],
  ["Security", "Raise a security concern or ask about the documented security model. Do not include secrets in the form.", "security"],
  ["Partnerships", "Start a discussion about a possible infrastructure, platform or technology partnership.", "partnerships"],
];

export function Contact() {
  return <PublicPage eyebrow="Contact" title="Start with the reason you are contacting Agata." description="Choose the closest topic so your request reaches the right support workflow with useful context.">
    <section className="public-content"><div className="agata-container">
      <div className="public-feature-grid">{destinations.map(([title, text, topic]) => <Link to={`/support/request?from=contact&topic=${topic}`} key={title} className="public-feature public-feature-action"><h3>{title}</h3><p>{text}</p><span className="public-inline-link">Start request <ArrowRight size={15} /></span></Link>)}</div>
      <div className="public-prose" style={{ marginTop: 32 }}><h2>For a technical issue</h2><p>Include the affected environment, a timestamp, expected versus observed behavior, reproduction steps and sanitized identifiers. Do not send credentials, private signing material or customer data through the public form.</p></div>
      <div className="public-request-open"><div><strong>Need help choosing a topic?</strong><p>Open a general contact request and explain what you need.</p></div><Link to="/support/request?from=contact" className="agata-button agata-button-primary">Open contact form</Link></div>
    </div></section>
  </PublicPage>;
}
