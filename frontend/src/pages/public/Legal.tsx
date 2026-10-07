import { Link, useLocation } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

type LegalPage = {
  eyebrow: string;
  title: string;
  description: string;
  sections: [string, string][];
};

const legal: Record<string, LegalPage> = {
  "/terms": {
    eyebrow: "Legal · Terms",
    title: "Terms of service.",
    description: "The terms governing access to Agata Proxima products, hosted services, developer interfaces and related documentation.",
    sections: [
      ["1. Scope", "These terms govern use of Agata Proxima services and related software, APIs, documentation and support surfaces made available by Agata Proxima."],
      ["2. Accounts and access", "You are responsible for information provided for an account, maintaining credential confidentiality and ensuring that people using an organization account are authorized to do so."],
      ["3. Acceptable use", "You must not use the service to violate applicable law, interfere with the service, bypass documented security controls, abuse credentials, or attempt unauthorized access to another customer, tenant or system."],
      ["4. Customer responsibility", "Customers remain responsible for their applications, configuration, credentials, data, integrations and decisions made outside the Agata-controlled service boundary. Proxima is an infrastructure control, not a substitute for application security."],
      ["5. Security and verification", "Agata is designed around enforceable tenant-isolation controls and verification evidence. Documentation distinguishes implemented controls from capabilities that are still in development. Customers should evaluate the service against their own threat model and requirements."],
      ["6. Fees and subscriptions", "Paid plans, usage limits, billing terms and applicable taxes are presented through the relevant pricing or commercial materials. A paid subscription does not grant ownership of the underlying Agata software or intellectual property."],
      ["7. Intellectual property", "Agata and its licensors retain rights in the service, documentation, branding and underlying technology except for rights expressly granted to customers. Customers retain rights in their own applications and customer data."],
      ["8. Availability and changes", "Services may change as the platform evolves. Agata may add, modify or retire features and will use appropriate product or service communications for material changes."],
      ["9. Third-party services", "Integrations may depend on infrastructure, identity providers, payment providers, cloud services or other third parties. Their terms and availability may apply independently."],
      ["10. Suspension and termination", "Access may be restricted or terminated where necessary for security, legal compliance, abuse prevention, non-payment or other material violations of these terms, subject to applicable contractual obligations."],
      ["11. Disclaimers", "The service is provided according to the applicable service commitments and documentation. No security product can guarantee that a customer application will never experience a security incident."],
      ["12. Limitation of liability", "Any limitation of liability, indemnity, warranty or other commercial term applicable to a paid service should be read together with the governing agreement for that service and applicable law."],
      ["13. Governing terms", "Where a separate order form, enterprise agreement or other written commercial agreement applies, that agreement controls to the extent of a conflict with these general terms."],
      ["14. Contact", "Questions about these terms can be started through the public contact route."],
    ],
  },
  "/privacy": {
    eyebrow: "Legal · Privacy",
    title: "Privacy policy.",
    description: "How Agata Proxima approaches information handled through its products, services, documentation and support channels.",
    sections: [
      ["1. Information we handle", "Depending on the service used, information may include account and organization details, authentication metadata, tenant and configuration metadata, operational events, support communications, billing information and technical information required to provide and secure the service."],
      ["2. Customer data", "Customers control the data they place in their applications and connected systems. Agata processes customer data only as necessary to provide the relevant service, maintain security, support customers and satisfy applicable obligations."],
      ["3. How information is used", "Information may be used to authenticate users, operate and secure services, provide support, process subscriptions, investigate incidents, improve reliability and communicate material service changes."],
      ["4. Security", "Agata uses an infrastructure model centered on explicit security boundaries, least-necessary access and auditable operational evidence. Customers should not send secrets or unnecessary sensitive information through public or support channels."],
      ["5. Retention", "Information is retained only for as long as reasonably necessary for the purpose for which it was collected, contractual requirements, security investigations, dispute resolution or applicable legal obligations."],
      ["6. Service providers", "Agata may use trusted service providers for infrastructure, authentication, communications, billing, analytics or other necessary operations. Providers receive only the access needed for their contracted function."],
      ["7. International processing", "Information may be processed in countries other than where a customer or user is located when required to operate the service. Appropriate contractual or legal mechanisms are used where required."],
      ["8. Cookies and similar technologies", "The public site may use essential browser storage or similar technologies required for functionality. Additional analytics or non-essential tracking should be disclosed when enabled."],
      ["9. Your choices and rights", "Depending on applicable law, individuals may have rights concerning access, correction, deletion, restriction, portability or objection. Requests can be initiated through the contact route."],
      ["10. Children", "Agata services are intended for business and professional use and are not directed at children."],
      ["11. Policy changes", "This policy may be updated as the service and legal requirements evolve. Material changes should be reflected through an updated policy date or appropriate service communication."],
      ["12. Privacy contact", "Privacy questions or requests can be started through the public contact route so they can be directed to the appropriate team."],
    ],
  },
};

export function Legal() {
  const { pathname } = useLocation();
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
            <div className="public-detail-links">
              <Link to="/contact" className="agata-button agata-button-secondary">Contact Agata</Link>
              <Link to="/trust" className="agata-button agata-button-secondary">Trust center</Link>
            </div>
          </article>
        </div>
      </section>
    </PublicPage>
  );
}
