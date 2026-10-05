import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type PublicPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function PublicPage({
  eyebrow,
  title,
  description,
  children,
}: PublicPageProps) {
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

      <section className="public-section">
        <div className="agata-container">
          <div className="public-callout">
            <strong>Build with Agata Proxima.</strong>
            <p>
              Connect your application to an independently verifiable
              tenant-isolation boundary.
            </p>
            <div style={{ marginTop: 20 }}>
              <Link
                to="/signup"
                className="agata-button agata-button-primary"
              >
                Start building
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
