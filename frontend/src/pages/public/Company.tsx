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
        </div>
      </section>
    </PublicPage>
  );
}
