import { Link } from "react-router-dom";
import type { ReactNode } from "react";

export type ResourceSection = {
  title: string;
  body: string;
  bullets?: string[];
  code?: string;
};

type PublicResourcePageProps = {
  eyebrow: string;
  title: string;
  description: string;
  sections: ResourceSection[];
  related?: Array<{ label: string; to: string }>;
};

export function PublicResourcePage({
  eyebrow,
  title,
  description,
  sections,
  related = [],
}: PublicResourcePageProps) {
  return (
    <div className="public-resource">
      <section className="public-page-hero">
        <div className="agata-container public-page-hero-inner">
          <div className="public-eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </section>

      <section className="public-content">
        <div className="agata-container public-resource-layout">
          <aside className="public-resource-index">
            <span>On this page</span>
            {sections.map((section, index) => (
              <a key={section.title} href={`#section-${index + 1}`}>
                {section.title}
              </a>
            ))}
          </aside>

          <article className="public-prose public-resource-article">
            {sections.map((section, index) => (
              <section id={`section-${index + 1}`} key={section.title} className="public-resource-section">
                <h2>{section.title}</h2>
                <p>{section.body}</p>
                {section.bullets && (
                  <ul>
                    {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                  </ul>
                )}
                {section.code && <pre className="public-code">{section.code}</pre>}
              </section>
            ))}

            {related.length > 0 && (
              <div className="public-related">
                <strong>Continue exploring</strong>
                <div className="public-related-links">
                  {related.map((item) => (
                    <Link key={item.to} to={item.to} className="public-resource-link">
                      {item.label} →
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </article>
        </div>
      </section>
    </div>
  );
}

export function ResourceLinks({ items }: { items: Array<{ label: string; to: string }> }): ReactNode {
  return (
    <div className="public-related-links">
      {items.map((item) => <Link key={item.to} to={item.to} className="public-resource-link">{item.label} →</Link>)}
    </div>
  );
}
