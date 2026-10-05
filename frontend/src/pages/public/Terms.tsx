import { PublicPage } from "../../components/layout/PublicPage";

export function Terms() {
  return <PublicPage eyebrow="Legal" title="Terms of Service" description="The terms governing access to Agata Proxima services, workspaces and platform capabilities.">
    <section className="public-content"><div className="agata-container"><article className="public-prose">
      <h2>1. Platform use</h2><p>Agata Proxima provides infrastructure and control-plane capabilities for organizations operating multi-tenant applications. Customers are responsible for configuring their applications, identities, tenants and infrastructure appropriately.</p>
      <h2>2. Workspace responsibility</h2><p>Organizations are responsible for the accounts, members, credentials and integrations they authorize within their workspace. Access should be limited to people and systems that require it.</p>
      <h2>3. Security responsibilities</h2><p>Proxima is designed to provide an enforcement and verification boundary. It does not remove the customer's responsibility to secure application code, credentials, databases, networks and systems outside the Proxima boundary.</p>
      <h2>4. Acceptable use</h2><p>Customers must not use the service to violate applicable law, compromise systems without authorization, or interfere with the availability and security of the platform or other customers.</p>
      <h2>5. Changes</h2><p>Platform capabilities, documentation and commercial terms may evolve. Material changes will be communicated through the appropriate product or contractual channels.</p>
      <h2>6. Contact</h2><p>Questions about these terms can be directed through the Agata contact and support channels.</p>
    </article></div></section>
  </PublicPage>;
}
