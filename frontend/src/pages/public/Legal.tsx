import { Link, useLocation } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

type LegalPage = {
  eyebrow: string;
  title: string;
  description: string;
  sections: [string, string][];
};

const commonIntro = "Agata Proxima provides tenant-isolation infrastructure, developer interfaces, hosted control-plane capabilities and related documentation. These pages describe the baseline public terms and privacy practices; a negotiated enterprise agreement or data-processing agreement may add or replace terms for that customer.";

const legal: Record<string, LegalPage> = {
  "/terms": {
    eyebrow: "Legal · Terms of Service",
    title: "Terms of Service",
    description: "The baseline terms governing access to Agata Proxima products, APIs, documentation, support and related services.",
    sections: [
      ["Last updated", "October 7, 2026. These general terms are intended to be read with any order form, subscription agreement, service-specific terms or other written agreement that applies to a customer."],
      ["1. Agreement and scope", commonIntro],
      ["2. Definitions", "“Agata”, “we” and “us” refer to Agata Proxima. “Customer” means the organization or person authorized to use a service. “Services” includes the hosted control plane, developer interfaces and other hosted capabilities made available by Agata. “Proxima Engine” means the data-plane software that operates between an application and PostgreSQL. “Customer Data” means information submitted to or processed through a service on the customer's behalf."],
      ["3. Accounts and organization access", "Customers must provide accurate account information, protect credentials and ensure that organization members are authorized to act for the organization. Customers are responsible for activity performed through their accounts, subject to Agata's obligations for security and unauthorized access caused by Agata."],
      ["4. Customer responsibilities", "Customers remain responsible for their applications, business authorization, tenant identity, database content, integration configuration, credentials, network configuration and compliance obligations. Proxima is an infrastructure security control and does not replace application authorization or other customer security controls."],
      ["5. Acceptable use", "Customers must not use the Services to violate applicable law, interfere with service operation, probe or access another customer's environment without authorization, bypass documented security controls, distribute malicious code, abuse credentials, or use the Services to cause harm. Security testing of a customer's own deployment should follow the documented testing and disclosure process."],
      ["6. Customer Data and privacy", "Customer ownership of Customer Data is not transferred to Agata by these terms. Agata may process Customer Data as necessary to provide, secure, support and improve the applicable Services and to satisfy legal obligations. The Privacy Policy and, where applicable, a data-processing agreement govern personal-data processing."],
      ["7. Security model", "Agata is designed around explicit identity, tenant context, enforcement, PostgreSQL controls, verification and audit evidence. Security documentation distinguishes implemented controls from external production gates. No infrastructure product can guarantee that a customer application will never suffer a security incident."],
      ["8. Verification and testing", "Verification results represent the tests actually submitted or executed. Customers must perform external SaaS acceptance against their own deployed application before treating a production integration as accepted. A Control Plane record must not be interpreted as proof of an external deployment that has not been exercised."],
      ["9. Plans, fees and payment", "Applicable prices, usage limits and billing terms are presented through the commercial materials or customer agreement. Taxes and payment-provider terms may apply. Provider-backed payment status, not a browser display, determines whether a paid entitlement is active."],
      ["10. Intellectual property", "Agata and its licensors retain rights in the Services, software, documentation, branding and technology except for rights expressly granted to customers. Customers retain rights in their applications and Customer Data. Feedback may be used to improve the Services without transferring Customer Data ownership."],
      ["11. Confidentiality", "Each party should protect non-public information received from the other party and use it only for the relationship. Confidentiality obligations do not prevent disclosures required by law, valid legal process or necessary security investigations, subject to applicable notice requirements."],
      ["12. Third-party services", "Services may depend on infrastructure, identity providers, payment processors, email providers, cloud platforms and other third parties. Those providers may have separate terms and availability constraints. Agata remains responsible for the portions of the Services it controls."],
      ["13. Availability and changes", "Agata may maintain, improve, modify or discontinue features as the platform evolves. Material service changes should be communicated through appropriate product, service or contractual channels. Operational status is reported through the available status and support surfaces."],
      ["14. Suspension and termination", "Agata may suspend or restrict access when reasonably necessary for security, abuse prevention, legal compliance, non-payment or a material breach. Customers may stop using a service or terminate according to the applicable subscription or commercial agreement. Termination does not erase records that must be retained for security, legal or accounting reasons."],
      ["15. Data return and deletion", "After termination, Customer Data is handled according to the applicable service contract, retention schedule and legal requirements. Customers should export information they need before termination where the service provides an export mechanism. Deletion may be delayed where retention is required for security, fraud prevention, disputes or law."],
      ["16. Disclaimers", "Except for commitments expressly made in an applicable agreement, the Services are provided according to their documented capabilities and applicable law. Agata does not promise that every customer configuration will be secure, uninterrupted or suitable for a particular regulatory requirement."],
      ["17. Limitation of liability", "Any limitation of liability, indemnity, warranty or remedy applicable to a paid service is governed by the applicable commercial agreement and mandatory law. These general terms do not expand liability beyond what the applicable agreement permits."],
      ["18. Governing terms and conflict", "Where an order form, enterprise agreement, service-specific terms or data-processing agreement applies, that document controls to the extent of a conflict with these general terms."],
      ["19. Changes to these terms", "Agata may update these terms as the Services, business model or legal requirements change. Material changes should be reflected through an updated effective date or appropriate customer communication."],
      ["20. Contact", "Questions about these terms, commercial agreements or customer obligations can be started through the public contact route. Do not include passwords, API keys or other secrets in a public contact request."],
    ],
  },
  "/privacy": {
    eyebrow: "Legal · Privacy Policy",
    title: "Privacy Policy",
    description: "How Agata Proxima handles account, operational, support and customer information across its products and services.",
    sections: [
      ["Last updated", "October 7, 2026. This policy describes baseline practices and should be read with any customer agreement or data-processing agreement that applies."],
      ["1. Scope and roles", "Agata may act as a controller for account, commercial, support and website information. When a customer uses Agata to process personal data on the customer's behalf, Agata may act as a processor or service provider. The applicable customer agreement and data-processing agreement determine the specific role and instructions."],
      ["2. Information we collect", "Depending on the service, information may include name, business email, organization membership, authentication records, security events, tenant and project metadata, integration configuration, support communications, billing records, device or network metadata and information needed to operate and secure the Services."],
      ["3. Customer Data", "Customers control the application data and tenant records they submit through their own systems. Agata processes such information only as necessary for the configured service, security, support, reliability and other documented purposes, subject to the customer's instructions and applicable agreement."],
      ["4. Purposes of processing", "We may use information to create and authenticate accounts, manage organizations and permissions, provide the Services, enforce entitlements, send transactional communications, provide support, detect abuse, investigate security incidents, maintain audit evidence, process payments, improve reliability and communicate material changes."],
      ["5. Legal bases", "Where privacy law requires a legal basis, the basis may include performance of a contract, legitimate interests such as security and service reliability, compliance with legal obligations, or consent where consent is appropriate. The precise basis depends on the context and applicable law."],
      ["6. Security", "Agata uses layered controls including authenticated access, CSRF protection for state-changing control-plane requests, organization-scoped authorization, audit evidence and a Proxima data-plane boundary. Customers should not submit secrets or unnecessary sensitive information through public support or contact forms."],
      ["7. Service providers and subprocessors", "Agata may use infrastructure, authentication, communications, billing, observability and other service providers needed to operate the Services. Provider access is limited to the function being performed. Where a customer requires a formal subprocessor list, the applicable contractual documentation controls."],
      ["8. International processing", "Service providers or infrastructure may process information in countries other than the user's or customer's home country. Where required by applicable law, Agata uses an appropriate transfer mechanism or contractual safeguard."],
      ["9. Retention", "Information is retained for the period reasonably necessary for the purpose collected, contractual requirements, security investigations, auditability, dispute resolution, fraud prevention and legal obligations. Different records may therefore have different retention periods."],
      ["10. Cookies and browser storage", "The public site may use essential browser storage and similar technologies for functionality. If non-essential analytics or tracking is enabled, the applicable notice or consent mechanism should describe it."],
      ["11. Individual rights", "Depending on applicable law, individuals may have rights to access, correct, delete, restrict, object to processing or receive a portable copy of certain information. Requests can be initiated through the contact route and may require verification of identity and authority."],
      ["12. Security incidents", "Agata maintains operational processes for investigating security events. Where a legally required notification obligation applies, affected customers or authorities are notified according to the applicable agreement and law."],
      ["13. Children", "The Services are intended for business and professional use and are not directed to children. Agata does not knowingly request personal information from children through the public service."],
      ["14. Account and marketing communications", "Transactional messages such as verification, security alerts, password recovery and support confirmations are part of service operation. Optional marketing communications, where used, should provide an appropriate opt-out mechanism."],
      ["15. Data deletion requests", "Requests to delete personal information are evaluated against contractual and legal retention requirements. Customer-controlled application data should normally be deleted or exported through the customer's own systems unless a service contract provides another mechanism."],
      ["16. Policy changes", "This policy may change as the Services, providers or legal requirements evolve. The updated effective date will be shown on this page, and material changes may be communicated through appropriate service channels."],
      ["17. Privacy contact", "Privacy questions and rights requests can be started through the public contact route. Do not include passwords, API keys, authentication tokens or other secrets in a privacy request."],
    ],
  },
};

export function Legal() {
  const { pathname } = useLocation();
  const page = legal[pathname] ?? legal["/privacy"];

  return <PublicPage eyebrow={page.eyebrow} title={page.title} description={page.description}>
    <section className="public-content">
      <div className="agata-container">
        <article className="public-prose">
          {page.sections.map(([title, text]) => <section key={title} className="public-detail-section"><h2>{title}</h2><p>{text}</p></section>)}
          <div className="public-detail-links">
            <Link to="/contact" className="agata-button agata-button-secondary">Contact Agata</Link>
            <Link to="/trust" className="agata-button agata-button-secondary">Trust center</Link>
            <Link to="/docs" className="agata-button agata-button-secondary">Documentation</Link>
          </div>
        </article>
      </div>
    </section>
  </PublicPage>;
}
