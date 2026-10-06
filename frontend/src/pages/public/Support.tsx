import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const resources = [
  ["Documentation","Start with architecture, integration and operational documentation.","documentation"],
  ["Troubleshooting","Diagnose authentication, policy, database and verification issues.","troubleshooting"],
  ["Security issues","Review the security model and use the contact route for responsible reporting.","security"],
  ["Customer support","Organizations can manage operational support from inside the authenticated command center.","customer"],
];

export function Support() {
  return (
    <PublicPage eyebrow="Support" title="Get help when infrastructure matters." description="Find technical guidance, understand operational issues and connect with the Agata team.">
      <section className="public-content">
        <div className="agata-container">
          <div className="public-feature-grid">
            {resources.map(([title,text,topic]) => (
              <Link to={`/support/request?topic=${topic}`} className="public-feature public-feature-action">
                <h3>{title}</h3>
                <p>{text}</p>
                <span className="public-inline-link">Open {title.toLowerCase()} <ArrowRight size={15} /></span>
              </Link>
            ))}
          </div>
          <div className="public-request-open">
            <div>
              <strong>Need something else?</strong>
              <p>If your issue is not covered above, open support and write your request in your own words.</p>
            </div>
            <Link to="/support/request" className="agata-button agata-button-primary">Open Support</Link>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
