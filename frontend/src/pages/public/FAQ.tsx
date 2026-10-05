import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { PublicPage } from "../../components/layout/PublicPage";

const questions = [
  ["What is Agata Proxima?", "Agata Proxima is tenant-isolation infrastructure designed to make tenant boundaries enforceable, independently verifiable and auditable."],
  ["How does the Proxima boundary fit into an application?", "The intended path is application identity and tenant context, then Proxima enforcement, then protected PostgreSQL access. The boundary is designed to make the tenant decision explicit before protected data operations proceed."],
  ["Does Agata replace PostgreSQL?", "No. Proxima works alongside PostgreSQL controls such as roles and row-level security. It provides an additional operational boundary and verification model."],
  ["What happens when tenant context is invalid?", "Missing, malformed, expired or cross-tenant context should be rejected rather than silently falling through to a broader database identity."],
  ["Can I verify that cross-tenant access is blocked?", "Yes. Verification is a first-class concept in the product model. Expected allow and block decisions can be exercised and recorded as evidence."],
  ["What does the control plane manage?", "The control plane is intended to manage organizations, tenants, policies, nodes, deployments, verification, audit evidence, team access, billing and developer configuration."],
  ["Can Agata work with enterprise identity?", "Yes. Enterprise identity is part of the authentication and organization-management model, with OIDC configuration available in the control plane."],
  ["Where does billing fit?", "Billing controls the organization's plan and entitlements. Stripe-backed checkout, customer billing and webhook synchronization belong on the control-plane side, not in the browser."],
  ["What happens if the control plane is unavailable?", "The architecture treats Proxima enforcement as the security authority. Control-plane availability should not turn a protected data boundary into an allow-all path."],
  ["How do I get help?", "Use the support surface for authenticated workspace issues or the contact surface for product, developer, security and partnership conversations."],
  ["Is there a free plan?", "The public pricing model includes a Free plan alongside Starter, Growth, Scale and Enterprise options. Production billing configuration will determine the final purchasable catalog."],
  ["How do I start?", "Create a workspace, connect a development application, follow the quickstart and run verification before moving a protected workload toward production."],
];

export function FAQ() {
  const [open, setOpen] = useState(0);

  return (
    <PublicPage
      eyebrow="FAQ"
      title="Questions engineers and security teams ask."
      description="Tap a question to expand the answer. The FAQ is deliberately organized around architecture, security behavior, operations and adoption."
    >
      <section className="public-content">
        <div className="agata-container">
          <div className="public-faq">
            {questions.map(([question, answer], index) => (
              <button
                key={question}
                type="button"
                className={`public-faq-item ${open === index ? "is-open" : ""}`}
                onClick={() => setOpen(open === index ? -1 : index)}
                aria-expanded={open === index}
              >
                <span className="public-faq-question">
                  <strong>{question}</strong>
                  <ChevronDown size={18} />
                </span>
                {open === index && <span className="public-faq-answer">{answer}</span>}
              </button>
            ))}
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
