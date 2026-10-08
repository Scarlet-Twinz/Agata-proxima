import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const plans=[
{name:"Free",price:"$0",description:"Evaluation and small proofs of concept.",features:["1 node","3 tenants","1 environment","7-day audit retention","Core tenant isolation"]},
{name:"Starter",price:"$79/mo",description:"First production SaaS deployments.",features:["2 nodes","25 tenants","2 environments","30-day audit retention","Policy management"],featured:true},
{name:"Growth",price:"$249/mo",description:"Multi-tenant production workloads.",features:["5 nodes","100 tenants","5 environments","180-day audit retention","Advanced verification","Fleet controls","Priority support"]},
{name:"Scale",price:"$799/mo",description:"Larger fleets and security operations.",features:["15 nodes","500 tenants","50 environments","365-day audit retention","Advanced verification","Fleet controls","Priority support","Entra OIDC","Private deployment"]},
];

export function Pricing(){
return <PublicPage eyebrow="Pricing" title="Plans that match the current platform contract." description="Public pricing describes the server-side entitlement model. Billing limits and feature availability remain authoritative on the backend.">
<section className="public-content"><div className="agata-container">
<div className="public-pricing-grid">{plans.map(plan=><article className={`public-price${plan.featured?" public-price-featured":""}`} key={plan.name}><h3>{plan.name}</h3><div className="public-price-value">{plan.price}</div><p>{plan.description}</p><ul>{plan.features.map(f=><li key={f}>{f}</li>)}</ul><Link to="/signup" className={`agata-button ${plan.featured?"agata-button-primary":"agata-button-secondary"}`}>Get started</Link></article>)}</div>
<section className="public-detail-section"><h2>How billing works</h2><p>The public plan catalog mirrors the control-plane entitlement model. A plan determines capacity and feature gates; the backend remains authoritative when a workspace attempts an operation.</p><p>Starter, Growth and Scale checkout requires the corresponding server-side Paystack plan code to be configured. Enterprise is a contracted path rather than a public checkout tier.</p></section>
<section className="public-detail-section"><h2>Commercial lifecycle</h2><div className="home-three-up"><div className="home-three-up-card"><h3>Compare</h3><p>Understand limits and features before creating a workspace.</p></div><div className="home-three-up-card"><h3>Choose</h3><p>Select the commercial plan that matches the infrastructure you need.</p></div><div className="home-three-up-card"><h3>Operate</h3><p>Entitlements are enforced server-side rather than trusted from the browser.</p></div></div></section>
</div></section></PublicPage>;
}