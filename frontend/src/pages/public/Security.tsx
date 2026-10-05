import { PublicPage } from "../../components/layout/PublicPage";

export function Security() {
  return (
    <PublicPage
      eyebrow="Security"
      title="A security boundary designed to be enforced and tested."
      description="Agata Proxima treats tenant isolation as an infrastructure concern instead of relying solely on application discipline."
    >
      <section className="public-content">
        <div className="agata-container">
          <div className="public-feature-grid">
            <article className="public-feature">
              <h3>Identity</h3>
              <p>
                Establish who is making the request before protected
                tenant context is accepted.
              </p>
            </article>

            <article className="public-feature">
              <h3>Tenant context</h3>
              <p>
                Carry tenant identity through the protected request
                path instead of treating it as an untrusted parameter.
              </p>
            </article>

            <article className="public-feature">
              <h3>Enforcement</h3>
              <p>
                Reject invalid, missing, expired or cross-tenant
                context before protected operations proceed.
              </p>
            </article>

            <article className="public-feature">
              <h3>Database controls</h3>
              <p>
                Work with PostgreSQL roles and row-level security as
                part of a layered isolation model.
              </p>
            </article>

            <article className="public-feature">
              <h3>Verification</h3>
              <p>
                Exercise the boundary and verify both expected
                allows and expected blocks.
              </p>
            </article>

            <article className="public-feature">
              <h3>Audit evidence</h3>
              <p>
                Preserve operational evidence around security
                decisions and verification activity.
              </p>
            </article>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
