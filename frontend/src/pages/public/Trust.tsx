import { PublicPage } from "../../components/layout/PublicPage";

export function Trust() {
  return (
    <PublicPage
      eyebrow="Trust center"
      title="Security claims should be backed by evidence."
      description="The Agata trust model focuses on architecture, controls, verification and operational evidence rather than unsupported certification claims."
    >
      <section className="public-content">
        <div className="agata-container">
          <div className="public-prose">
            <h2>How we think about trust</h2>

            <p>
              A security infrastructure product should make it easier
              for customers to understand what protects their data,
              which controls exist and how those controls can be
              verified.
            </p>

            <h3>Architecture</h3>
            <p>
              Identity, tenant context, enforcement, PostgreSQL,
              verification and audit evidence form the core security
              model.
            </p>

            <h3>Evidence</h3>
            <p>
              Verification results and operational events should be
              inspectable rather than hidden behind marketing claims.
            </p>

            <h3>Disclosure</h3>
            <p>
              Security issues should have a defined path for
              responsible reporting and investigation.
            </p>

            <h3>Transparency</h3>
            <p>
              Agata should distinguish clearly between controls that
              exist today, capabilities in development and external
              assurances that have actually been obtained.
            </p>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
