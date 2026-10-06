import { useEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

type PublicPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

const ctaByPath: Record<string, { title: string; text: string; label: string; to: string }> = {
  "/product": { title: "Build with Agata Proxima.", text: "Connect your application to an independently verifiable tenant-isolation boundary.", label: "Start building", to: "/signup" },
  "/pricing": { title: "Ready to evaluate Proxima?", text: "Start with the developer experience and move into the plan that fits your infrastructure.", label: "Choose a plan", to: "/signup" },
  "/developers": { title: "Start with the developer platform.", text: "Follow the quickstart, understand the contracts and verify the boundary in your own integration.", label: "Open quickstart", to: "/developers/quickstart" },
  "/docs": { title: "Ready to build?", text: "Use the getting-started guide to move from architecture concepts to a verified integration.", label: "Get started", to: "/docs/getting-started" },
  "/security": { title: "Inspect the security model.", text: "Read the verification and trust surfaces behind the tenant-isolation boundary.", label: "Read verification", to: "/docs/verification" },
  "/trust": { title: "Need deeper assurance?", text: "Review the security architecture, verification model and direct contact paths.", label: "Contact security", to: "/contact" },
  "/status": { title: "Need help with service state?", text: "Use support for an operational question while live public telemetry is being connected.", label: "Get support", to: "/support" },
  "/support": { title: "Need help with something specific?", text: "Open a support request and start with the issue category that best matches what you need.", label: "Open Support", to: "/support/request" },
  "/contact": { title: "Have something else to discuss?", text: "Open a contact request and write the conversation in your own words.", label: "Open Contact", to: "/support/request?from=contact" },
};

export function PublicPage({ eyebrow, title, description, children }: PublicPageProps) {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = title + " · Agata Proxima";
    const meta = document.querySelector('meta[name="description"]');
    meta?.setAttribute("content", description);
  }, [description, title]);

  const isLegal = pathname === "/terms" || pathname === "/privacy";
  const cta = ctaByPath[pathname] ?? {
    title: "Build with Agata Proxima.",
    text: "Connect your application to an independently verifiable tenant-isolation boundary.",
    label: "Start building",
    to: "/signup",
  };

  return (
    <div className="public-page">
      <section className="public-page-hero">
        <div className="agata-container public-page-hero-inner">
          <div className="public-eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </section>

      {children}

      {!isLegal && (
        <section className="public-section">
          <div className="agata-container">
            <div className="public-callout">
              <strong>{cta.title}</strong>
              <p>{cta.text}</p>
              <div style={{ marginTop: 20 }}>
                <Link to={cta.to} className="agata-button agata-button-primary">{cta.label}</Link>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
