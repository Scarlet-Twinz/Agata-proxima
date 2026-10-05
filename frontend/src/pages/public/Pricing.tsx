import { PublicPage } from "../../components/layout/PublicPage";

const plans = [
  {
    name: "Free",
    price: "$0",
    description: "For evaluating the Proxima model.",
    features: [
      "Core tenant isolation",
      "Local development",
      "Verification basics",
      "Developer documentation",
    ],
  },
  {
    name: "Starter",
    price: "$149/mo",
    description: "For growing multi-tenant products.",
    features: [
      "Production tenant protection",
      "Policy management",
      "Verification",
      "Audit capabilities",
    ],
  },
  {
    name: "Growth",
    price: "$499/mo",
    description: "For teams operating serious SaaS infrastructure.",
    features: [
      "Expanded tenant capacity",
      "Fleet operations",
      "Advanced verification",
      "Team controls",
    ],
    featured: true,
  },
  {
    name: "Scale",
    price: "$1,199/mo",
    description: "For larger production environments.",
    features: [
      "Expanded infrastructure",
      "Advanced operational controls",
      "Security workflows",
      "Priority support",
    ],
  },
];

export function Pricing() {
  return (
    <PublicPage
      eyebrow="Pricing"
      title="Start small. Scale the protection with your infrastructure."
      description="Agata pricing follows the product's operating model: protected tenants, infrastructure and operational capabilities."
    >
      <section className="public-content">
        <div className="agata-container">
          <div className="public-pricing-grid">
            {plans.map((plan) => (
              <article
                className={`public-price${
                  plan.featured
                    ? " public-price-featured"
                    : ""
                }`}
                key={plan.name}
              >
                <h3>{plan.name}</h3>

                <div className="public-price-value">
                  {plan.price}
                </div>

                <p>{plan.description}</p>

                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>

                <a
                  href="/signup"
                  className={`agata-button ${
                    plan.featured
                      ? "agata-button-primary"
                      : "agata-button-secondary"
                  }`}
                >
                  Get started
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
