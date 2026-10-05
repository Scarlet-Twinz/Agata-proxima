import { PublicPage } from "../../components/layout/PublicPage";

export function Privacy() {
  return <PublicPage eyebrow="Legal" title="Privacy Policy" description="How Agata Proxima approaches information associated with accounts, organizations and platform use.">
    <section className="public-content"><div className="agata-container"><article className="public-prose">
      <h2>1. Information we handle</h2><p>Depending on how the service is used, Agata may handle account information, organization information, configuration, security events, support communications and technical information required to operate the platform.</p>
      <h2>2. How information is used</h2><p>Information is used to provide, secure, maintain and improve the service, authenticate users, operate workspaces, investigate security events and respond to support requests.</p>
      <h2>3. Customer data</h2><p>Customers remain responsible for determining what data they send through their integrations and for configuring their systems in accordance with their legal and security obligations.</p>
      <h2>4. Security</h2><p>Agata applies access controls and security practices appropriate to the platform. Security architecture and operational evidence are treated as first-class product concerns.</p>
      <h2>5. Retention and requests</h2><p>Retention periods and data-subject or customer requests depend on the applicable service, agreement and legal requirements.</p>
      <h2>6. Updates</h2><p>This policy may be updated as the platform and applicable requirements evolve. Material changes will be communicated through appropriate channels.</p>
    </article></div></section>
  </PublicPage>;
}
