import { PublicPage } from "../../components/layout/PublicPage";

export function Company() {
  return (
    <PublicPage
      eyebrow="Company"
      title="Infrastructure should make difficult security properties easier to operate."
      description="Agata Proxima exists to give engineering teams a clearer, more enforceable model for tenant isolation."
    >
      <section className="public-content">
        <div className="agata-container">
          <div className="public-feature-grid">
            <article className="public-feature">
              <h3>Engineering first</h3>
              <p>
                Product decisions start with what engineering teams
                actually need to build and operate.
              </p>
            </article>

            <article className="public-feature">
              <h3>Evidence over claims</h3>
              <p>
                Security properties should be demonstrated wherever
                they can be tested.
              </p>
            </article>

            <article className="public-feature">
              <h3>Operational clarity</h3>
              <p>
                Infrastructure should expose enough information for
                teams to understand what is happening.
              </p>
            </article>

            <article className="public-feature">
              <h3>Simple mental models</h3>
              <p>
                Complex infrastructure should still be understandable
                to the people responsible for running it.
              </p>
            </article>
          </div>
          <div className="public-prose company-details">
            <section>
              <h2>The problem we are focused on</h2>
              <p>As SaaS products grow, tenant access rules can become scattered across application handlers, background jobs and database queries. Agata Proxima focuses on making the tenant boundary explicit, enforceable and testable across the protected request path.</p>
            </section>
            <section>
              <h2>Who it is for</h2>
              <p>Agata Proxima is intended for engineering, platform and security teams building multi-tenant software that need clear organization administration, tenant-scoped controls, policy management, verification and operational evidence.</p>
            </section>
            <section>
              <h2>What Agata Proxima is not</h2>
              <p>It is not a substitute for secure application design, least-privilege database roles, correctly configured PostgreSQL row-level security, operational monitoring or independent security review. A configured dashboard record is not proof that a deployed runtime enforces the intended policy. Certifications, contractual service commitments and unverified integrations must not be inferred from product screens.</p>
            </section>
            <section>
              <h2>How we measure progress</h2>
              <p>We measure progress through repeatable tests: permitted tenant-local operations succeed, cross-tenant reads and writes are rejected, invalid context is handled as expected, evidence is inspectable, and integration behavior is verified in the target environment. Results that have not been tested are recorded as unverified rather than passed.</p>
            </section>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
