import { ArrowUpRight, BookOpen, CircleHelp, KeyRound, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

const guideSections = [
  {
    title: "1. Start with your workspace",
    intro: "The command center summarizes the active organization's current control-plane records. It does not create security guarantees by itself: use the linked resource pages and run verification against the real protected request path.",
    links: [
      { label: "Command Center", to: "/app" },
      { label: "Organization settings", to: "/app/settings" },
      { label: "Team and access", to: "/app/team" },
    ],
  },
  {
    title: "2. Create and manage tenants",
    intro: "Tenants represent customer or data boundaries. Create separate test tenants for separate customer contexts, open a tenant to review its details, and avoid using one tenant identifier to stand in for another customer's boundary.",
    steps: [
      "Open Tenants and choose Create tenant.",
      "Enter the real tenant details required by the form and save.",
      "Open the created tenant and confirm the returned record is correct.",
      "Use separate test tenants when validating cross-tenant denial.",
    ],
    links: [{ label: "Open Tenants", to: "/app/tenants" }, { label: "Create tenant", to: "/app/tenants/new" }],
  },
  {
    title: "3. Configure policies, nodes and deployments",
    intro: "Policies describe intended enforcement behavior, nodes represent registered enforcement targets, and deployments connect desired state to a target. Creating a dashboard record does not prove that a runtime has received or enforced it.",
    steps: [
      "Create or review a policy and verify its intended rules before rollout.",
      "Register and inspect a node in the environment where enforcement will run.",
      "Create or review a deployment using the actual target and policy records.",
      "Inspect the resulting status, then run verification against the protected path.",
    ],
    links: [
      { label: "Policies", to: "/app/policies" },
      { label: "Infrastructure nodes", to: "/app/nodes" },
      { label: "Deployments", to: "/app/deployments" },
    ],
  },
  {
    title: "4. Create an API key and make an API request",
    intro: "Use an organization-scoped key for trusted server-side or CI integrations. The secret may only be displayed at creation time; copy it directly into a secret manager. Never put it in frontend code, a VITE_ variable, source control, screenshots or logs.",
    steps: [
      "Open Developer, then API keys, and choose the create action.",
      "Give the key a clear purpose and the narrowest supported access scope.",
      "Copy the secret once into your secure local secret store.",
      "Use the API reference to confirm the route and request contract for your deployed version.",
      "Test an authorized request and a denied request before using the integration with real customer data.",
    ],
    links: [
      { label: "Developer area", to: "/app/developer" },
      { label: "API keys", to: "/app/developer/api-keys" },
      { label: "Create API key", to: "/app/developer/api-keys/new" },
      { label: "API reference", to: "/app/developer/api-reference" },
    ],
  },
  {
    title: "5. Configure webhooks and integrations",
    intro: "Use webhooks when a trusted external service needs event notifications. Configure only endpoints you control, protect signing secrets, validate signatures using the documented raw-body contract, and make event processing idempotent. A configured endpoint still needs a real delivery test.",
    steps: [
      "Open Developer and choose Webhooks.",
      "Register the HTTPS endpoint that your service actually operates.",
      "Store the signing secret securely and configure the receiver to validate signatures.",
      "Send a controlled test event where supported and inspect delivery attempts and receiver logs.",
      "Test duplicate deliveries and transient receiver failures before relying on automation.",
    ],
    links: [
      { label: "Webhooks", to: "/app/developer/webhooks" },
      { label: "Create webhook", to: "/app/developer/webhooks/new" },
      { label: "Developer API reference", to: "/app/developer/api-reference" },
    ],
  },
  {
    title: "6. Run verification and inspect evidence",
    intro: "Verification should test both expected success and expected rejection. Do not treat an empty dashboard, a healthy API endpoint or a successful configuration save as proof of tenant isolation.",
    steps: [
      "Confirm that test tenants and the required policy, node and deployment records exist.",
      "Run the verification workflow available in your environment.",
      "Test an allowed tenant-local operation.",
      "Attempt cross-tenant access and confirm it is denied.",
      "Inspect the verification result and the related audit events; record skipped tests as unverified, not passed.",
    ],
    links: [
      { label: "Run verification", to: "/app/verification" },
      { label: "Audit events", to: "/app/audit" },
      { label: "Security overview", to: "/app/security" },
    ],
  },
  {
    title: "7. Manage team access and account security",
    intro: "Use organization roles to limit who can administer settings and operational resources. Invite only the intended email address, assign the least-privileged suitable role, and revoke access when it is no longer needed.",
    links: [
      { label: "Team and invitations", to: "/app/team" },
      { label: "Identity settings", to: "/app/settings/identity" },
      { label: "Security settings", to: "/app/settings/security" },
      { label: "Notifications", to: "/app/notifications" },
    ],
  },
  {
    title: "8. Understand settings, plans and usage",
    intro: "Settings control the organization preferences exposed by this deployment. Billing and plan pages show the provider-backed status available to the account; displayed entitlements do not by themselves prove that a checkout or external provider webhook is operational.",
    links: [
      { label: "Settings", to: "/app/settings" },
      { label: "Plan and billing", to: "/app/billing" },
      { label: "Usage", to: "/app/billing/usage" },
      { label: "Plans", to: "/app/billing/plans" },
    ],
  },
  {
    title: "9. Troubleshoot common problems",
    intro: "For a missing resource, refresh the relevant page and confirm the active organization. For 401 responses, check authentication and whether the key is valid; for 403, check organization membership and role; for 429, check rate limits; and for 5xx, inspect service and database logs before repeating a state-changing request. If an action is absent or fails consistently, report the exact page, time, request ID if available, and sanitized error text.",
    links: [
      { label: "Verification", to: "/app/verification" },
      { label: "Audit", to: "/app/audit" },
      { label: "Settings", to: "/app/settings" },
      { label: "Contact support", to: "/app/support" },
    ],
  },
];

export function DashboardGuide() {
  return (
    <div className="dashboard-guide">
      <div className="page-heading">
        <div>
          <span className="eyebrow">HELP CENTER · CONTROL PLANE</span>
          <h1>Dashboard guide</h1>
          <p>
            A practical walkthrough of the workspace: what each area is for,
            where to go next, how to create an API integration, and how to
            verify results without assuming that a saved record proves runtime behavior.
          </p>
        </div>
        <Link className="secondary-action dashboard-guide-support" to="/app/support">
          <CircleHelp size={16} /> Contact support
        </Link>
      </div>

      <div className="dashboard-guide-callout surface">
        <BookOpen size={22} aria-hidden="true" />
        <div>
          <strong>Not sure where to begin?</strong>
          <p>For a first integration, start with Tenants, configure the policy and target required by your environment, create a server-side API key, then run verification and review the audit trail.</p>
          <div className="dashboard-guide-links">
            <Link to="/app/tenants">Start with tenants <ArrowUpRight size={14} /></Link>
            <Link to="/app/developer/api-keys">API keys <KeyRound size={14} /></Link>
            <Link to="/app/verification">Verification <ShieldCheck size={14} /></Link>
          </div>
        </div>
      </div>

      <nav className="dashboard-guide-index surface" aria-label="Guide contents">
        <strong>In this guide</strong>
        <div>
          {guideSections.map((section, index) => (
            <a href={`#dashboard-guide-${index + 1}`} key={section.title}>{section.title}</a>
          ))}
        </div>
      </nav>

      <div className="dashboard-guide-sections">
        {guideSections.map((section, index) => (
          <section className="surface dashboard-guide-section" id={`dashboard-guide-${index + 1}`} key={section.title}>
            <span className="eyebrow">GUIDE {String(index + 1).padStart(2, "0")}</span>
            <h2>{section.title}</h2>
            <p>{section.intro}</p>
            {section.steps && (
              <ol>{section.steps.map((step) => <li key={step}>{step}</li>)}</ol>
            )}
            <div className="dashboard-guide-links">
              {section.links.map((link) => (
                <Link to={link.to} key={link.to}>{link.label} <ArrowUpRight size={14} /></Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="dashboard-guide-final surface">
        <div>
          <h2>Still stuck?</h2>
          <p>Contact support with the page you were using, the action you attempted, the approximate time, and a sanitized error message. Do not send passwords, API keys, session cookies, signing secrets, or customer records.</p>
        </div>
        <Link className="primary-action" to="/app/support">Open support <ArrowUpRight size={15} /></Link>
      </section>
    </div>
  );
}
