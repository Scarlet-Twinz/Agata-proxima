import { PublicPage } from "../../components/layout/PublicPage";

export function Product() {
  return (
    <PublicPage
      eyebrow="Product"
      title="Tenant isolation as infrastructure."
      description="Agata Proxima places a dedicated enforcement boundary between application identity and protected PostgreSQL operations."
    >
      <section className="public-content">
        <div className="agata-container">
          <div className="public-content-grid">
            <aside className="public-content-aside">
              <div className="public-content-aside-title">
                Product
              </div>
              <a href="#model">Operating model</a>
              <a href="#enforcement">Enforcement</a>
              <a href="#verification">Verification</a>
              <a href="#evidence">Evidence</a>
            </aside>

            <article className="public-prose">
              <section id="model">
                <h2>The Proxima model</h2>
                <p>
                  A multi-tenant application should not have to rely
                  entirely on application code to preserve tenant
                  boundaries. Proxima introduces an explicit
                  infrastructure boundary where tenant context can be
                  enforced and verified before database operations are
                  allowed to proceed.
                </p>

                <pre className="public-code">
{`Identity
   ↓
Tenant context
   ↓
Proxima enforcement boundary
   ↓
PostgreSQL roles / RLS
   ↓
Verification
   ↓
Audit evidence`}
                </pre>
              </section>

              <div className="public-rule" />

              <section id="enforcement">
                <h2>Enforcement</h2>
                <p>
                  Proxima is designed around an explicit decision:
                  requests with valid tenant context can proceed;
                  missing, invalid, expired or cross-tenant context is
                  rejected.
                </p>
              </section>

              <section id="verification">
                <h2>Verification</h2>
                <p>
                  Isolation should be tested as a system property.
                  Verification exercises the boundary and records
                  whether expected tenant-local operations are allowed
                  and cross-tenant operations are blocked.
                </p>
              </section>

              <section id="evidence">
                <h2>Evidence</h2>
                <p>
                  Operational security becomes stronger when teams can
                  inspect what happened: policy versions, verification
                  outcomes, tenant context and security events.
                </p>
              </section>
            </article>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
