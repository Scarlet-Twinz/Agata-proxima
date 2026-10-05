import { PublicPage } from "../../components/layout/PublicPage";

const entries = [
  [
    "Current",
    "Frontend reconstruction",
    "Agata's public product experience is being rebuilt around a real application architecture.",
  ],
  [
    "Previous",
    "Control plane foundation",
    "Rust control-plane services, tenant isolation and operational contracts continue to provide the backend foundation.",
  ],
];

export function Changelog() {
  return (
    <PublicPage
      eyebrow="Changelog"
      title="See how Agata evolves."
      description="Product and platform changes should be visible to the people building on top of Agata."
    >
      <section className="public-content">
        <div className="agata-container">
          <div className="public-prose">
            {entries.map(([date, title, text]) => (
              <div
                key={title}
                style={{
                  padding: "30px 0",
                  borderBottom:
                    "1px solid var(--agata-border)",
                }}
              >
                <div
                  style={{
                    color: "var(--agata-blue)",
                    fontSize: 13,
                    fontWeight: 700,
                    marginBottom: 8,
                  }}
                >
                  {date}
                </div>

                <h2 style={{ marginBottom: 10 }}>
                  {title}
                </h2>

                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
