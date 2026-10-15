import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const entries = [
  ["October 2026", "Developer documentation and integration guides", "Expanded the developer portal with practical API and Node.js examples, webhook receiver guidance, SDK/CLI/Terraform implementation guidance, and integration recipes for ChatGPT/MCP architecture, Supabase, Firebase, GitHub Actions, Vercel and PostgreSQL RLS.", "/developers"],
  ["Platform foundation", "Organization-scoped control plane", "The control plane brings organization membership, tenant inventory, policies, nodes, deployments, verification, audit history, API keys and webhook configuration into a connected operating workflow.", "/product"],
];

export function Changelog() {
  return <PublicPage eyebrow="Changelog" title="What's changing in Agata Proxima." description="Product updates, developer improvements and platform capabilities, with links to the guides for each area.">
    <section className="public-content"><div className="agata-container"><div className="public-prose">
      {entries.map(([date, title, text, to]) => <article key={title} className="public-changelog-entry"><div className="public-changelog-date">{date}</div><h2>{title}</h2><p>{text}</p><Link to={to} className="public-inline-link">Explore details <ArrowRight size={15} /></Link></article>)}
      <div className="public-detail-links"><Link to="/docs" className="agata-button agata-button-secondary">Documentation</Link><Link to="/developers/downloads" className="agata-button agata-button-secondary">Developer downloads</Link></div>
    </div></div></section>
  </PublicPage>;
}
