import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const resources = [
  ["Documentation","Start with architecture, integration and operational documentation.","/docs"],
  ["Troubleshooting","Diagnose authentication, policy, database and verification issues.","/docs/troubleshooting"],
  ["Security issues","Review the security model and use the contact route for responsible reporting.","/security"],
  ["Customer support","Organizations can manage operational support from inside the authenticated command center.","/contact"],
];

export function Support() {
  return (
    <PublicPage eyebrow="Support" title="Get help when infrastructure matters." description="Find technical guidance, understand operational issues and connect with the Agata team.">
      <section className="public-content">
        <div className="agata-container">
          <div className="public-feature-grid">
            {resources.map(([title,text,to]) => (
              <article className="public-feature" key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
                <Link to={to} className="public-inline-link">Open support resource <ArrowRight size={15} /></Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
