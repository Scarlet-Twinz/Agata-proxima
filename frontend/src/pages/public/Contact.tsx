import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const destinations = [
  ["Customers","Discuss architecture, adoption, plans and operating requirements.","/pricing"],
  ["Developers","Ask integration questions or get help understanding the API and tenant context model.","/developers"],
  ["Security","Review the security model and trust workflow before reporting a concern.","/trust"],
  ["Partnerships","Explore infrastructure, platform and technology partnerships with Agata.","/company"],
];

export function Contact() {
  return (
    <PublicPage eyebrow="Contact" title="Talk to the people building Agata." description="Whether you are evaluating Proxima, integrating it into a product or investigating a security concern, start here.">
      <section className="public-content">
        <div className="agata-container">
          <div className="public-feature-grid">
            {destinations.map(([title,text,to]) => (
              <article className="public-feature" key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
                <Link to={to} className="public-inline-link">Continue <ArrowRight size={15} /></Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
