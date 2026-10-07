import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const destinations = [
  ["Customers","Discuss architecture, adoption, plans and operating requirements.","customers"],
  ["Developers","Ask integration questions or get help understanding the API and tenant context model.","developers"],
  ["Security","Review the security model and trust workflow before reporting a concern.","security"],
  ["Partnerships","Explore infrastructure, platform and technology partnerships with Agata.","partnerships"],
];

export function Contact() {
  return (
    <PublicPage eyebrow="Contact" title="Talk to the people building Agata." description="Whether you are evaluating Proxima, integrating it into a product or investigating a security concern, start here.">
      <section className="public-content">
        <div className="agata-container">
          <div className="public-feature-grid">
            {destinations.map(([title,text,topic]) => (
              <Link to={`/support/request?from=contact&topic=${topic}`} key={title} className="public-feature public-feature-action">
                <h3>{title}</h3>
                <p>{text}</p>
                <span className="public-inline-link">Start {title.toLowerCase()} request <ArrowRight size={15} /></span>
              </Link>
            ))}
          </div>
          <div className="public-request-open">
            <div>
              <strong>Something else?</strong>
              <p>Open a general contact request and write exactly what you need.</p>
            </div>
            <Link to="/support/request?from=contact" className="agata-button agata-button-primary">Open Contact</Link>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
