import { ArrowDownToLine, BookOpen, Code2, Container, ExternalLink, FileJson, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const repository = "https://github.com/Scarlet-Twinz/Agata-proxima";
const downloads = [
  { title: "Integration starter kit", description: "Download the source repository, including the Rust control plane, React console, Docker Compose setup, migrations, scripts and test suites.", href: `${repository}/archive/refs/heads/main.zip`, label: "Download source ZIP", icon: ArrowDownToLine },
  { title: "Docker and local setup", description: "Start the local PostgreSQL services, run the control plane, check health endpoints and diagnose common Compose failures.", to: "/docs/usage", label: "Open local setup guide", icon: Container },
  { title: "Customer integration blueprint", description: "Map the application, customer tenant, organization, protected PostgreSQL path and verification workflow before connecting production data.", href: `${repository}/blob/main/docs/customer-integration.md`, label: "Read customer blueprint", icon: Database },
  { title: "OpenAPI contract", description: "Inspect the versioned HTTP API contract before generating an application-owned client or wiring an integration.", href: `${repository}/blob/main/control-plane/openapi.json`, label: "View OpenAPI JSON", icon: FileJson },
  { title: "Developer quickstart", description: "Follow the authentication, organization context, tenant creation and verification workflow.", to: "/developers/quickstart", label: "Open quickstart", icon: Code2 },
  { title: "ChatGPT / MCP integration", description: "Connect an assistant through a scoped MCP server and a least-privilege service identity.", to: "/developers/integrations/chatgpt", label: "Open ChatGPT integration guide", icon: Code2 },
  { title: "Vercel deployment", description: "Configure frontend routing, environment variables, HTTPS and preview/production separation.", to: "/developers/integrations/vercel", label: "Open Vercel deployment guide", icon: ShieldCheck },
  { title: "Deployment blueprint", description: "Review the frontend, API, database, same-origin routing, secrets and production operations architecture.", href: `${repository}/blob/main/docs/production/deployment-architecture.md`, label: "Read deployment blueprint", icon: ShieldCheck },
  { title: "Source and release history", description: "Review implementation, tests, issues and repository changes directly in GitHub.", href: repository, label: "Open GitHub repository", icon: ExternalLink },
];

export function Downloads() {
  return <PublicPage eyebrow="Downloads & integrations" title="Everything needed to start an Agata Proxima integration." description="Get the source starter kit, inspect the API contract, configure Docker and follow the documented integration path.">
    <section className="public-content"><div className="agata-container">
      <div className="public-feature-grid">
        {downloads.map(({title,description,href,to,label,icon:Icon}) => <article className="public-feature" key={title}>
          <Icon size={21} color="var(--agata-blue)"/><h3>{title}</h3><p>{description}</p>
          {href ? <a className="public-inline-link" href={href} target="_blank" rel="noreferrer">{label} <ArrowDownToLine size={15}/></a> : <Link className="public-inline-link" to={to!}>{label} <BookOpen size={15}/></Link>}
        </article>)}
      </div>
      <div className="public-callout"><strong>Build integrations against the published contract.</strong><p>Use the HTTP API and OpenAPI document as the integration source of truth. Keep credentials server-side and verify third-party deployment or ChatGPT workflows against their actual connector and runtime requirements before enabling them.</p></div>
    </div></section>
  </PublicPage>;
}
