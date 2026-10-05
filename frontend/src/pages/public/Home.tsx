import { Link } from "react-router-dom";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";

export function Home() {
  return (
    <>
      <section className="public-hero">
        <div className="agata-container public-hero-grid">

          <div>
            <div className="public-eyebrow">
              Tenant isolation infrastructure
            </div>

            <h1>
              Make tenant isolation an independently verifiable boundary.
            </h1>

            <p className="public-hero-copy">
              Agata Proxima gives multi-tenant applications a dedicated
              enforcement boundary between application identity and
              PostgreSQL — making isolation enforceable, verifiable and
              auditable.
            </p>

            <div className="public-hero-actions">
              <Link
                to="/signup"
                className="agata-button agata-button-primary"
              >
                Start building
                <ArrowRight size={17} />
              </Link>

              <Link
                to="/product"
                className="agata-button agata-button-secondary"
              >
                Explore Proxima
              </Link>
            </div>
          </div>

          <div className="platform-visual">
            <div className="platform-visual-content">

              <div className="platform-label">
                Proxima enforcement boundary
              </div>

              <div className="platform-flow">

                <div className="platform-node">
                  <strong>Application</strong>
                  <span>Identity & tenant context</span>
                </div>

                <div className="platform-arrow">→</div>

                <div className="platform-node">
                  <strong>Proxima</strong>
                  <span>Enforcement & verification</span>
                </div>

                <div className="platform-arrow">→</div>

                <div className="platform-node">
                  <strong>PostgreSQL</strong>
                  <span>Roles & RLS</span>
                </div>

              </div>

              <div className="platform-status">
                <span className="platform-status-dot" />
                Isolation boundary active
              </div>

            </div>
          </div>

        </div>
      </section>

      <section className="public-section">
        <div className="agata-container">

          <div className="public-section-header">
            <div className="public-eyebrow">
              The operating model
            </div>

            <h2>
              Security should be something your infrastructure can prove.
            </h2>

            <p>
              Proxima connects identity, tenant context, enforcement,
              database access, verification and audit evidence into one
              operational boundary.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(3, minmax(0, 1fr))",
              gap: "1px",
              background: "var(--agata-border)",
              border: "1px solid var(--agata-border)",
            }}
          >
            {[
              {
                title: "Enforce",
                text:
                  "Tenant context is enforced before protected database operations reach the data layer.",
              },
              {
                title: "Verify",
                text:
                  "Isolation behavior can be tested instead of being accepted as an assumption.",
              },
              {
                title: "Prove",
                text:
                  "Security events and verification outcomes become operational evidence.",
              },
            ].map((item) => (
              <div
                key={item.title}
                style={{
                  background: "var(--agata-white)",
                  padding: "32px",
                }}
              >
                <ShieldCheck
                  size={22}
                  color="var(--agata-blue)"
                />

                <h3
                  style={{
                    margin:
                      "22px 0 10px",
                    fontSize: "20px",
                  }}
                >
                  {item.title}
                </h3>

                <p
                  style={{
                    margin: 0,
                    color:
                      "var(--agata-text-secondary)",
                    lineHeight: 1.7,
                  }}
                >
                  {item.text}
                </p>
              </div>
            ))}
          </div>

        </div>
      </section>

      <section className="public-section public-section-dark">
        <div className="agata-container">

          <div className="public-section-header">
            <div className="public-eyebrow">
              Built for multi-tenant systems
            </div>

            <h2>
              One boundary. Multiple tenants. Verifiable isolation.
            </h2>

            <p>
              Designed for teams building serious multi-tenant
              applications where isolation cannot depend on application
              discipline alone.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2, minmax(0, 1fr))",
              gap: "28px",
            }}
          >
            {[
              "B2B SaaS platforms",
              "Enterprise applications",
              "Developer platforms",
              "Security-sensitive workloads",
            ].map((item) => (
              <div
                key={item}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  paddingBottom: "18px",
                  borderBottom:
                    "1px solid var(--agata-border-dark)",
                  color: "#d8e2ef",
                }}
              >
                <Check
                  size={18}
                  color="var(--agata-blue-light)"
                />

                {item}
              </div>
            ))}
          </div>

        </div>
      </section>

      <section className="public-section">
        <div className="agata-container">

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "32px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div className="public-eyebrow">
                Explore the platform
              </div>

              <h2
                style={{
                  margin: 0,
                  fontSize: "clamp(32px, 4vw, 48px)",
                  letterSpacing: "-0.04em",
                }}
              >
                Build with a security boundary you can inspect.
              </h2>
            </div>

            <Link
              to="/developers"
              className="agata-button agata-button-primary"
            >
              Explore developers
              <ArrowRight size={17} />
            </Link>
          </div>

        </div>
      </section>
    </>
  );
}
