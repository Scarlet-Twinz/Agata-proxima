import { PublicPage } from "../../components/layout/PublicPage";

const legal = {
  "/terms": {
    eyebrow: "Legal · Terms",
    title: "Terms of service.",
    description: "The terms governing access to Agata Proxima services and the relationship between Agata and its customers.",
    sections: [
      ["Scope", "These terms govern use of Agata Proxima products, hosted services, developer interfaces and related documentation."],
      ["Acceptable use", "Customers are responsible for using the platform lawfully, protecting credentials and maintaining appropriate controls around their own applications and data."],
      ["Security responsibilities", "Agata provides documented platform controls and verification capabilities. Customers remain responsible for their application, credentials, configuration and data outside the Agata-controlled boundary."],
      ["Changes", "Product capabilities, documentation and terms may evolve. Material changes should be communicated through the appropriate product or legal channels."],
    ],
  },
  "/privacy": {
    eyebrow: "Legal · Privacy",
    title: "Privacy policy.",
    description: "How Agata Proxima approaches information handled through its products, services and support channels.",
    sections: [
      ["Information we handle", "Depending on the service used, information may include account details, organization metadata, operational events, support communications and technical information required to provide the service."],
      ["Use of information", "Information is used to operate, secure, support and improve the service, subject to applicable law and the commitments that apply to the relevant service."],
      ["Security", "Agata is designed around explicit security boundaries and operational evidence. Customers should avoid sending secrets or unnecessary sensitive information through support channels."],
      ["Questions", "For privacy questions, use the Contact destination so the appropriate team can respond."],
    ],
  },
} as const;

export function Legal() {
  const pathname = window.location.pathname as keyof typeof legal;
  const page = legal[pathname] ?? legal["/privacy"];
  return (
    <PublicPage eyebrow={page.eyebrow} title={page.title} description={page.description}>
      <section className="public-content">
        <div className="agata-container">
          <article className="public-prose">
            {page.sections.map(([title, text]) => (
              <section key={title} className="public-detail-section">
                <h2>{title}</h2>
                <p>{text}</p>
              </section>
            ))}
          </article>
        </div>
      </section>
    </PublicPage>
  );
}
