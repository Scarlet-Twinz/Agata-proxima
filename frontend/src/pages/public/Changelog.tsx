import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const entries = [
  {
    slug: "frontend-reconstruction",
    date: "October 2026",
    title: "Frontend reconstruction",
    summary: "The public experience was rebuilt around a real React application architecture with dedicated product, developer, documentation, company and trust surfaces.",
  },
  {
    slug: "control-plane-foundation",
    date: "Earlier",
    title: "Control plane foundation",
    summary: "The Rust control plane established authenticated sessions, organization membership, tenant operations, policy workflows, verification, audit and production billing foundations.",
  },
];

export function Changelog() {
  return (
    <PublicPage
      eyebrow="Changelog"
      title="See what changed, why it changed and what the change means."
      description="Each release note is written as a product record: scope, reason, user impact and implementation direction."
    >
      <section className="public-content">
        <div className="agata-container">
          <div className="public-changelog-list">
            {entries.map((entry) => (
              <Link key={entry.slug} to={`/changelog/${entry.slug}`} className="public-changelog-entry">
                <span>{entry.date}</span>
                <div>
                  <h2>{entry.title}</h2>
                  <p>{entry.summary}</p>
                  <strong>Read release details →</strong>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
