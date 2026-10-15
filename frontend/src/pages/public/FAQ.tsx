import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const questions: [string, string][] = [
  ["What is Agata Proxima?", "Agata Proxima is tenant-isolation infrastructure for multi-tenant software. Its control plane manages organizations, tenants, policies, nodes, deployments, verification and audit activity. The Proxima enforcement boundary works with trusted identity, tenant context and PostgreSQL controls to make customer boundaries explicit and testable."],
  ["Who is Agata Proxima built for?", "Agata Proxima is for SaaS founders, application engineers, platform teams and security teams operating software for multiple customer organizations. It supports the same core goal across a small startup, a growing SaaS business, a medium-sized engineering organization or an enterprise: keep each customer's data within its authorized boundary."],
  ["What problem does it solve?", "Multi-tenant applications can expose customer data when a request uses the wrong tenant identifier, a database query misses a filter, or a service trusts an unverified identity claim. Agata Proxima provides an explicit enforcement model and repeatable verification workflows for testing allowed and denied tenant access."],
  ["How does tenant isolation work?", "The application authenticates the caller, resolves the authorized organization and tenant context, and sends the protected operation through the configured Proxima enforcement path. PostgreSQL roles and row-level security provide complementary data-layer controls. Verification tests tenant-local access and prohibited cross-tenant operations."],
  ["Does Agata Proxima replace PostgreSQL or row-level security?", "No. PostgreSQL remains the database. Agata Proxima complements database roles, privileges and row-level security (RLS) with an explicit control and enforcement model. Teams can keep their existing PostgreSQL architecture while integrating the protected request path."],
  ["Does Agata Proxima replace application authentication?", "No. Your application continues to authenticate users and services. Agata Proxima uses trusted identity and tenant context to apply the relevant authorization boundary. Authentication answers who is calling; tenant isolation determines which customer's data that caller may access."],
  ["What can I manage in the dashboard?", "The control plane provides organization-scoped workflows for tenants, policies, nodes, deployments, verification, audit activity, team access, API keys, environments and webhook configuration. Available actions are governed by the active organization's role permissions and plan entitlements."],
  ["What is the difference between an organization and a tenant?", "An organization is the administrative workspace that owns managed resources and team membership. A tenant represents a customer or data boundary inside the application. Keep the identifiers and authorization checks separate unless your architecture explicitly maps them together."],
  ["How do I verify that cross-tenant access is blocked?", "Create controlled test data for at least two tenants. Confirm that tenant A can perform an allowed operation on its own data, then attempt reads and writes against tenant B and confirm they are rejected. Repeat with missing or malformed context, inspect database state, and retain the verification result and audit details."],
  ["What evidence can I inspect?", "Use verification results to review the checks performed and their outcomes, and use audit history to investigate administrative and security-relevant changes. Useful records include the environment, timestamp, resource identifiers, policy or deployment version, expected result and observed result."],
  ["How do developers integrate with Agata Proxima?", "Use the versioned `/api/v1` control-plane API, organization-scoped credentials and the documented resource workflows. The developer guides include request examples, authentication guidance, webhook setup, verification steps and troubleshooting. Start with the quickstart, then use the API reference for the exact request and response contract."],
  ["What are Agata Proxima webhooks used for?", "Webhooks deliver selected Agata events to an endpoint you control. Configure an HTTPS destination, store the signing secret securely, verify the HMAC-SHA256 signature against the exact raw request body, deduplicate delivery IDs and make event processing idempotent. The dashboard provides endpoint configuration and delivery history for investigation."],
  ["How do I install an integration?", "Open Developer Downloads and get the integration starter kit. It includes a Node.js client example, PowerShell and Bash scripts, a webhook receiver example, and Supabase/Firebase integration samples. The developer guides cover installation, configuration, expected responses and acceptance checks."],
  ["Can I connect Agata Proxima to ChatGPT, Supabase, Firebase, GitHub or Vercel?", "Agata Proxima integrates with application stacks through its HTTP API, signed webhooks and deployment workflows. The integration catalog covers ChatGPT/MCP architecture, Supabase, Firebase, GitHub Actions, Vercel and PostgreSQL RLS. The ChatGPT guide defines the scoped MCP connector flow and its server-side authorization requirements."],
  ["How does Microsoft Entra ID sign-in fit in?", "Microsoft Entra ID uses OpenID Connect (OIDC) for enterprise identity. In the current entitlement contract, Entra OIDC is included with Growth, Scale and Enterprise. The backend entitlement is authoritative for the organization's access to this feature."],
  ["How are plan features and limits applied?", "The control plane exposes the plan catalog and the authenticated organization's entitlement state. Server-side enforcement determines resource capacity, feature access and usage limits; the browser does not grant entitlements on its own. Use the Pricing page for the current catalog and the authenticated entitlement response for the active organization's state."],
  ["How do I get started?", "Start with the getting-started guide, sign in to the intended organization, create two synthetic test tenants, configure the required policy and runtime path, and run both allowed and denied access tests. Finish by reviewing verification and audit evidence before expanding the integration."],
  ["Where can I get help?", "Use Support or Contact and include the affected environment, timestamp and timezone, expected and observed behavior, reproduction steps, and sanitized request or resource identifiers. Never include passwords, session cookies, API keys, signing secrets or unnecessary customer data."],
];

export function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <PublicPage eyebrow="Frequently asked questions" title="Answers for teams building secure multi-tenant software." description="Learn how Agata Proxima fits into your architecture, how developers integrate it, and how teams manage tenant boundaries and verification.">
      <section className="public-content"><div className="agata-container">
        <div className="public-faq">
          {questions.map(([question, answer], index) => {
            const isOpen = open === index;
            return <article className={"public-faq-item" + (isOpen ? " is-open" : "")} key={question}>
              <button type="button" className="public-faq-question" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? -1 : index)}>
                <span>{question}</span><ChevronDown size={18} aria-hidden="true" />
              </button>
              {isOpen && <p>{answer}</p>}
            </article>;
          })}
        </div>
        <div className="public-detail-links" style={{ marginTop: 28 }}>
          <Link to="/docs/getting-started" className="agata-button agata-button-primary">Get started</Link>
          <Link to="/developers" className="agata-button agata-button-secondary">Developer platform</Link>
          <Link to="/developers/downloads" className="agata-button agata-button-secondary">Developer downloads</Link>
          <Link to="/support/request" className="agata-button agata-button-secondary">Contact support</Link>
        </div>
      </div></section>
    </PublicPage>
  );
}
