import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const entries = [
  ["October 2026","Frontend reconstruction","The public product experience is being rebuilt around a real application architecture.","/changelog/frontend-reconstruction"],
  ["Platform foundation","Control plane foundation","Rust control-plane services, tenant isolation and operational contracts provide the backend foundation.","/changelog/control-plane-foundation"],
];

export function Changelog() {
  return (
    <PublicPage
      eyebrow="Changelog"
      title="See how Agata evolves."
      description="Product and platform changes should be visible to the people building on top of Agata."
    >
      <section className="public-content">
        <div className="agata-container">
          <div className="public-prose">
            {entries.map(([date,title,text,to]) => (
              <article key={title} className="public-changelog-entry">
                <div className="public-changelog-date">{date}</div>
                <h2>{title}</h2>
                <p>{text}</p>
                <Link to={to} className="public-inline-link">Read release details <ArrowRight size={15} /></Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
