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
    description: "The terms for accessing Agata Proxima services, software, APIs, documentation and support.",
    sections: [
      ["1. Agreement and scope", "These terms govern access to Agata Proxima services, software, APIs, documentation and related support unless a separate signed agreement applies. By using a service, you agree to these terms and to any applicable order form or product-specific conditions."],
      ["2. Accounts and access", "Provide accurate account information, protect authentication credentials and ensure that each person using an organization workspace is authorized. You are responsible for activity performed through credentials assigned to you, subject to applicable law and any separate agreement."],
      ["3. Organization and tenant administration", "Organization membership controls administrative access to workspace resources. Application tenant context controls which customer data an application request may access. You must configure these boundaries for your architecture and keep membership, tenant mapping and service credentials current."],
      ["4. Acceptable use", "Do not use Agata Proxima to violate applicable law, interfere with service operation, probe systems without authorization, bypass access controls, expose another customer's data, distribute malicious code or abuse API, identity or webhook credentials."],
      ["5. Customer applications and configuration", "You remain responsible for your applications, data model, identity provider, database permissions, PostgreSQL row-level security, network configuration, deployment secrets, backups and the correctness of the protected request path. Agata Proxima provides infrastructure controls and verification workflows; it does not replace application security or your operational responsibilities."],
      ["6. Customer data and permitted processing", "You retain your rights in the data you submit or connect. You authorize processing necessary to provide the service, operate and secure the platform, respond to support requests, maintain audit records and meet applicable legal obligations. Do not submit data that you lack the right to process."],
      ["7. Credentials and integrations", "You are responsible for the credentials and permissions you configure for connected systems. Store credentials securely, grant only required permissions, rotate exposed credentials and revoke access when no longer needed. Third-party integrations remain subject to the applicable provider's terms."],
      ["8. Plans, fees and taxes", "Plan features, limits, fees and applicable commercial terms are described in the relevant pricing materials or signed agreement. Taxes, billing cadence, cancellation, refunds and renewal terms are governed by the applicable checkout terms or commercial agreement for the service purchased."],
      ["9. Security and verification", "Agata Proxima provides controls and workflows for managing tenant boundaries, testing permitted and denied operations, and reviewing operational evidence. Verification results describe the checks performed and their environment. They do not replace your own risk assessment or independently establish a certification or compliance status."],
      ["10. Availability and changes", "We may update the service, documentation or supported integrations as the platform evolves. Operational status is based on the signals available for the relevant service. Any binding availability commitment applies only when stated in a separate agreement."],
      ["11. Intellectual property", "Agata Proxima and its licensors retain rights in the service, software, documentation, trademarks and underlying technology, except for rights expressly granted to you. You retain rights in your own applications and customer data."],
      ["12. Third-party services", "The service may rely on hosting, database, identity, email, payment, monitoring or other third-party services. Third-party terms, availability and processing practices may apply independently of these terms."],
      ["13. Suspension", "Access may be restricted when reasonably necessary to protect the service, respond to abuse or security risks, comply with law, or address material contractual violations. Where appropriate and permitted, we will use the available account or support channels to communicate the reason and next steps."],
      ["14. Termination and data handling", "You may stop using the service subject to any applicable subscription or written agreement. On termination, access, export, retention and deletion are handled according to the applicable product settings, retention rules, contractual terms and legal obligations."],
      ["15. Disclaimers and liability", "The service is provided subject to the applicable service agreement and law. To the extent permitted by law, implied warranties are excluded and liability is limited as stated in the governing agreement. No general product description guarantees that a customer application can never experience a security incident."],
      ["16. Conflicting agreements and governing law", "A signed enterprise agreement, order form or other applicable written agreement controls where it expressly conflicts with these general terms. Governing law, dispute venue and any negotiated warranty or liability terms are determined by the applicable signed agreement and mandatory law."],
      ["17. Contact", "For questions about these terms, use the public contact form and select the closest topic so the request can be routed appropriately."]
    ],
  },
  "/privacy": {
    eyebrow: "Legal · Privacy",
    title: "Privacy policy.",
    description: "How information is handled when you use Agata Proxima, contact support or connect services to the platform.",
    sections: [
      ["1. Scope", "This policy describes information handled through the public website, accounts, control plane, APIs, integrations, transactional messages and support channels. A separate customer data-processing agreement applies where one has been signed."],
      ["2. Information we handle", "Depending on the feature used, information may include account name and email, organization membership, authentication and session metadata, tenant and configuration metadata, API-key identifiers, webhook endpoint and delivery metadata, verification outcomes, audit events, support messages, billing records and technical diagnostics."],
      ["3. Customer application data", "Customers control the application data stored in their own systems. Agata processes information sent to or generated by the service to provide the configured control-plane, enforcement, verification, audit and support functions. Do not send unnecessary personal data or secrets in support requests or event payloads."],
      ["4. How information is used", "Information is used to create and secure accounts, authenticate users, authorize organization access, manage resources, record security-relevant activity, deliver configured events, respond to support requests, operate and protect the service, prevent abuse, investigate incidents and meet legal obligations."],
      ["5. Authentication and security records", "Security records may include sign-in events, credential lifecycle metadata, request identifiers, authorization outcomes, audit events and verification results. These records support access control, troubleshooting, security investigation and accountability."],
      ["6. Transactional email and support communications", "Email addresses and message metadata are used for account verification, password recovery, invitations, service notifications and responses to support or contact requests. Message contents should be limited to information needed for the relevant workflow."],
      ["7. Service providers", "Service providers may process information for hosting, database operations, DNS and network protection, identity, transactional email, payment processing, monitoring and support tooling. Access should be limited to the service required. The current provider list and processing locations must be made available with the applicable customer or legal materials."],
      ["8. Sharing", "Information may be shared with service providers that support the service, with organization administrators according to their permissions, when necessary to protect users or the platform, to comply with law, or as part of a corporate transaction subject to applicable obligations. We do not publish customer secrets or use private application data as public content."],
      ["9. International processing", "Service providers may process information in countries other than the user's location. Where required, appropriate contractual or legal transfer mechanisms apply to that processing."],
      ["10. Retention", "Retention depends on the information type, product configuration, plan settings, security needs, contractual requirements and legal obligations. Audit, verification, webhook, billing, support and account records may have different retention periods. The applicable product settings or agreement determine the period for a specific service."],
      ["11. Access, correction and deletion requests", "Depending on applicable law and your role, you may request access to, correction of or deletion of personal information. Requests can be submitted through the contact form. We may need to verify identity and authority before acting, and some records may be retained where law or security obligations require it."],
      ["12. Cookies and browser storage", "The website and application may use cookies, session storage or similar technologies needed for sign-in, session security, CSRF protection, navigation and product functionality. Any optional analytics or advertising technologies must be disclosed and managed according to applicable requirements when enabled."],
      ["13. Security practices", "The platform is designed around organization-scoped authorization, explicit tenant context, protected credentials and operational evidence. Users must protect their credentials and avoid placing secrets in browser code, public requests, support forms or logs. No transmission or storage method can be guaranteed risk-free in every circumstance."],
      ["14. Children", "Agata Proxima is intended for business and professional use and is not directed to children."],
      ["15. Policy updates", "This policy may be updated as the service, processing practices or legal requirements change. Material changes should be reflected in the published policy and communicated where required."],
      ["16. Privacy contact", "For a privacy request or question, use the public contact form and identify it as a privacy matter. Do not include passwords, session cookies, API keys, webhook secrets or unnecessary customer records."]
    ],
  },
};

export function Legal() {
  const { pathname } = useLocation();
  const page = legal[pathname] ?? legal["/privacy"];
  return (
    <PublicPage eyebrow={page.eyebrow} title={page.title} description={page.description}>
      <section className="public-content"><div className="agata-container"><article className="public-prose">
        {page.sections.map(([title, text]) => <section key={title} className="public-detail-section"><h2>{title}</h2><p>{text}</p></section>)}
        <div className="public-detail-links"><Link to="/contact" className="agata-button agata-button-secondary">Contact Agata</Link><Link to="/trust" className="agata-button agata-button-secondary">Trust center</Link></div>
      </article></div></section>
    </PublicPage>
  );
}
