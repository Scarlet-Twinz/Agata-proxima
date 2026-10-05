import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const entries = [
  {
    slug: "frontend-reconstruction",
    date: "October 2026",
    title: "Frontend reconstruction",
    summary: "The public and authenticated experience moved to a real React application architecture with explicit routes, a protected console and detailed public documentation.",
  },
  {
    slug: "authentication-boundary",
    date: "October 2026",
    title: "Authentication boundary",
    summary: "Signup, login, session inspection and logout now use the control-plane authentication lifecycle instead of a frontend-only state.",
  },
  {
    slug: "verification-model",
    date: "October 2026",
    title: "Verification model",
    summary: "Verification is treated as a first-class security workflow: expected decisions, observed decisions and evidence are part of the operating model.",
  },
  {
    slug: "api-foundation",
    date: "Earlier",
    title: "Control-plane API foundation",
    summary: "Authentication, organization, tenant, policy, infrastructure, verification and audit operations were separated into explicit control-plane resource boundaries.",
  },
  {
    slug: "control-plane-foundation",
    date: "Earlier",
    title: "Control plane foundation",
    summary: "The Rust control plane established sessions, organization membership, operational resources, security foundations, billing foundations and enterprise identity scaffolding.",
  },
];

export function Changelog() {
  return (
    <PublicPage
      eyebrow="Changelog"
      title="See what changed, why it changed and what it means."
      description="Release notes are written as product records rather than one-line announcements. Open an entry to read the scope, reasoning and operational impact."
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
