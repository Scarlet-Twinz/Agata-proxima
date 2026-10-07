import { Link } from "react-router-dom";
import { Check, ArrowRight } from "lucide-react";
import { PublicPage } from "../../components/layout/PublicPage";

const plans = [
  {name:"Free",price:"$0",description:"Evaluate the Proxima model and build a small proof of concept.",features:["Core tenant-isolation model","Local development","Verification basics","Developer documentation"],limits:"1 node · 3 tenants · 1 environment"},
  {name:"Starter",price:"$149/mo",description:"For an early production SaaS deployment that needs an explicit tenant boundary.",features:["Production tenant protection","Policy management","Verification","Audit capabilities"],limits:"2 nodes · 25 tenants · 2 environments"},
  {name:"Growth",price:"$499/mo",description:"For teams operating serious multi-tenant workloads and fleet controls.",features:["Expanded tenant capacity","Fleet operations","Advanced verification","Team controls"],limits:"5 nodes · 100 tenants · 5 environments",featured:true},
  {name:"Scale",price:"$1,199/mo",description:"For larger production environments with expanded operational and security controls.",features:["Expanded infrastructure","Advanced operational controls","Security workflows","Priority support"],limits:"15 nodes · 500 tenants · 50 environments"},
  {name:"Enterprise",price:"Custom",description:"For contracted enterprise deployments with organization-specific requirements.",features:["Contracted capacity","Enterprise identity","Advanced security controls","Dedicated commercial terms"],limits:"Custom limits and retention"},
];

export function Pricing() {
  return (
    <PublicPage eyebrow="Pricing" title="Scale protection with the infrastructure you operate." description="Pricing reflects the control-plane capabilities available to an organization. The API exposes the same plan catalog and limits so the dashboard does not invent a separate pricing model.">
      <section className="public-content">
        <div className="agata-container">
          <div className="public-pricing-grid">
            {plans.map((plan) => (
              <article className={\`public-price\${plan.featured ? " public-price-featured" : ""}\`} key={plan.name}>
                <h3>{plan.name}</h3><div className="public-price-value">{plan.price}</div><p>{plan.description}</p>
                <strong style={{fontSize:"12px",marginTop:"6px"}}>{plan.limits}</strong>
                <ul>{plan.features.map((feature)=><li key={feature}><Check size={14} style={{verticalAlign:"-2px",marginRight:"6px"}}/>{feature}</li>)}</ul>
                <Link to="/signup" className={\`agata-button \${plan.featured ? "agata-button-primary" : "agata-button-secondary"}\`}>Get started <ArrowRight size={15}/></Link>
              </article>
            ))}
          </div>
          <div className="public-prose" style={{marginTop:"72px"}}>
            <h2>What plan limits mean</h2>
            <p>Plan limits are enforced by the control plane for resources such as tenants, nodes and environments. Feature gates include advanced verification, fleet controls, priority support, enterprise identity and private deployment capabilities.</p>
            <p>A billing plan is not a security shortcut. Tenant isolation remains a layered property of identity, Proxima enforcement and PostgreSQL controls regardless of commercial tier.</p>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
