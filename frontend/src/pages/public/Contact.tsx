import { PublicPage } from "../../components/layout/PublicPage";

export function Contact() {
  return (
    <PublicPage
      eyebrow="Contact"
      title="Talk to the people building Agata."
      description="Whether you are evaluating Proxima, integrating it into a product or investigating a security concern, start here."
    >
      <section className="public-content">
        <div className="agata-container">
          <div className="public-feature-grid">
            <article className="public-feature">
              <h3>Customers</h3>
              <p>
                Discuss architecture, adoption, plans and operating
                requirements.
              </p>
            </article>

            <article className="public-feature">
              <h3>Developers</h3>
              <p>
                Ask integration questions or get help understanding
                the API and tenant context model.
              </p>
            </article>

            <article className="public-feature">
              <h3>Security</h3>
              <p>
                Report a security concern through the appropriate
                security communication path.
              </p>
            </article>

            <article className="public-feature">
              <h3>Partnerships</h3>
              <p>
                Explore infrastructure, platform and technology
                partnerships with Agata.
              </p>
            </article>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
