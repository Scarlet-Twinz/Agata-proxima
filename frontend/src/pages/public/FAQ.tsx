import { PublicPage } from "../../components/layout/PublicPage";

const questions = [
  [
    "What is Agata Proxima?",
    "Agata Proxima is tenant-isolation infrastructure designed to make tenant boundaries enforceable, independently verifiable and auditable.",
  ],
  [
    "Does Agata replace PostgreSQL?",
    "No. Proxima works as an enforcement boundary around protected PostgreSQL access and complements database controls such as roles and row-level security.",
  ],
  [
    "What happens when tenant context is invalid?",
    "The security model treats missing, invalid, expired or cross-tenant context as a condition that should be rejected.",
  ],
  [
    "Is Agata only for large companies?",
    "No. The model is intended to help teams establish a strong tenant-isolation foundation as their multi-tenant application grows.",
  ],
  [
    "Does Agata provide audit evidence?",
    "The platform is designed around verification and operational evidence so security decisions can be inspected.",
  ],
  [
    "Can Agata work with enterprise identity?",
    "Enterprise identity is part of the platform's authentication and organization-management model.",
  ],
];

export function FAQ() {
  return (
    <PublicPage
      eyebrow="FAQ"
      title="Questions engineers and security teams ask."
      description="A straightforward explanation of the product, architecture and operating model."
    >
      <section className="public-content">
        <div className="agata-container">
          <div className="public-faq">
            {questions.map(([question, answer]) => (
              <article
                className="public-faq-item"
                key={question}
              >
                <h3>{question}</h3>
                <p>{answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
