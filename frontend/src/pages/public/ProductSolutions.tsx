import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import "./product-solutions.css";

type Detail = {
  eyebrow: string;
  title: string;
  intro: string;
  sections: Array<{ title: string; body: string }>;
};

const productDetails: Record<string, Detail> = {
  "operating-model": {
    eyebrow: "PRODUCT / OPERATING MODEL",
    title: "A dedicated operating model for tenant-aware access.",
    intro: "Proxima separates identity, tenant context, enforcement, database isolation, verification and evidence into an explicit request path.",
    sections: [
      { title: "Identity establishes the principal", body: "Authentication answers who is making the request. It is necessary, but it does not establish which tenant the request is allowed to reach." },
      { title: "Tenant context establishes scope", body: "The request carries the intended tenant scope so the enforcement boundary has an explicit security decision to evaluate." },
      { title: "Enforcement protects the path", body: "Proxima evaluates the tenant-aware operation before protected data is reached, with PostgreSQL controls providing a second layer." },
      { title: "Verification tests the property", body: "The system deliberately exercises same-tenant, cross-tenant and invalid-context paths instead of assuming the configuration is correct." },
      { title: "Evidence makes the result inspectable", body: "Verification and operational records turn an isolation claim into something engineers and security teams can review." },
    ],
  },
  enforcement: {
    eyebrow: "PRODUCT / ENFORCEMENT",
    title: "Put tenant isolation at the boundary.",
    intro: "A secure application should not depend on every feature remembering to perform the same isolation check.",
    sections: [
      { title: "One decision path", body: "Tenant-aware requests should reach an explicit enforcement boundary rather than relying on scattered conventions across application code." },
      { title: "Allow the local path", body: "A request for tenant A against tenant A data is the expected positive path and should be allowed when the remaining policy conditions are satisfied." },
      { title: "Block the crossing path", body: "A request carrying tenant A context against tenant B data is a boundary violation and should be blocked." },
      { title: "Fail closed", body: "Expired, malformed or otherwise untrusted tenant context must not silently become an unscoped request." },
      { title: "Layer the database", body: "PostgreSQL enforcement gives the system another control point so one missed application convention is not the only protection." },
    ],
  },
  verification: {
    eyebrow: "PRODUCT / VERIFICATION",
    title: "Verify isolation instead of trusting configuration.",
    intro: "Verification is where the security property becomes a testable contract.",
    sections: [
      { title: "Define expected decisions", body: "Start with explicit outcomes: same-tenant access is allowed, cross-tenant access is blocked, and invalid context fails closed." },
      { title: "Exercise the dangerous paths", body: "A meaningful verification run deliberately attempts the requests that would expose a weakness if the boundary were missing." },
      { title: "Inspect the result", body: "A verification result should identify what was tested, what decision occurred and where a mismatch appeared." },
      { title: "Retain evidence", body: "The value of verification is not limited to a single test run. The result should remain available for operations and security review." },
    ],
  },
  evidence: {
    eyebrow: "PRODUCT / EVIDENCE",
    title: "Give security claims an inspectable record.",
    intro: "Evidence connects enforcement and verification to an operational story that can be reviewed after the request has finished.",
    sections: [
      { title: "Record decisions", body: "Important tenant-aware decisions should be attributable to a request, context, resource and time rather than disappearing into an application log." },
      { title: "Record verification", body: "Verification evidence should preserve the scenario, expected result and observed result so a reviewer can understand what was actually tested." },
      { title: "Support investigation", body: "When an unexpected block or verification failure occurs, evidence gives engineers a starting point for diagnosis." },
      { title: "Support review", body: "Security review becomes more concrete when the reviewer can inspect results rather than relying only on architecture diagrams or assertions." },
    ],
  },
};

const solutionDetails: Record<string, Detail> = {
  "b2b-saas": {
    eyebrow: "SOLUTIONS / B2B SAAS",
    title: "Keep customer organizations isolated inside one product.",
    intro: "A shared application can still have a strong tenant boundary when scope is explicit, enforced and continuously verified.",
    sections: [
      { title: "Model the customer boundary", body: "Define the organization or tenant identity that owns protected data before it becomes scattered across services and queries." },
      { title: "Enforce consistently", body: "Give tenant-aware operations a common boundary instead of asking every product feature to reinvent isolation checks." },
      { title: "Verify cross-tenant failure modes", body: "Exercise the exact paths that could expose one customer's data to another customer." },
      { title: "Keep evidence", body: "Make the security property inspectable when engineering, security or customer teams need to review it." },
    ],
  },
  "enterprise-saas": {
    eyebrow: "SOLUTIONS / ENTERPRISE SAAS",
    title: "Give enterprise workloads a stronger isolation story.",
    intro: "Enterprise identity can establish who someone is while Proxima separately governs the tenant scope that request may reach.",
    sections: [
      { title: "Separate identity from scope", body: "Do not let successful authentication become an implicit authorization to every tenant the principal can name." },
      { title: "Layer enforcement", body: "Combine request-level tenant enforcement with database controls for defense in depth." },
      { title: "Verify continuously", body: "Use explicit allow and block scenarios to detect regressions as the product evolves." },
      { title: "Make review concrete", body: "Retain evidence that security and operations teams can inspect during reviews and incidents." },
    ],
  },
  "developer-platforms": {
    eyebrow: "SOLUTIONS / DEVELOPER PLATFORMS",
    title: "Make tenant isolation a platform capability.",
    intro: "Platform teams can provide one consistent tenant-aware model to many product teams instead of distributing security conventions across repositories.",
    sections: [
      { title: "Standardize the request model", body: "Give application teams a predictable sequence: authenticate, establish tenant context, enforce, verify and inspect evidence." },
      { title: "Keep the boundary visible", body: "Developers should understand where the security decision occurs and which layer owns it." },
      { title: "Build verification into the platform", body: "Verification makes the platform promise observable instead of leaving teams to infer that isolation still works." },
      { title: "Scale the operating model", body: "As services and environments multiply, a common boundary reduces repeated security decisions and makes fleet-level confidence easier." },
    ],
  },
  "security-sensitive-systems": {
    eyebrow: "SOLUTIONS / SECURITY-SENSITIVE SYSTEMS",
    title: "Treat tenant isolation as a security control.",
    intro: "Systems with sensitive data need more than a convention hidden inside application code.",
    sections: [
      { title: "Assume mistakes happen", body: "Wrong tenant context, expired context, authorization mistakes and bypassed checks are realistic failure modes." },
      { title: "Use defense in depth", body: "Application enforcement and database controls should reinforce one another." },
      { title: "Exercise attack paths", body: "Verification should deliberately probe cross-tenant and invalid-context paths." },
      { title: "Preserve the evidence", body: "The outcome should be reviewable by engineers and security teams after the test or incident." },
    ],
  },
  startups: {
    eyebrow: "SOLUTIONS / STARTUPS",
    title: "Establish the tenant boundary before it becomes scattered.",
    intro: "A strong isolation model is easier to maintain when it is introduced before every service, query and background job invents its own convention.",
    sections: [
      { title: "Start with the architecture", body: "Define tenant scope while the system is still small enough to reason about end to end." },
      { title: "Protect developer velocity", body: "A shared boundary reduces repeated security decisions without hiding the architecture from the engineers using it." },
      { title: "Grow without losing the property", body: "Verification and evidence provide a way to check that isolation still holds as the product and infrastructure expand." },
    ],
  },
  "platform-engineering": {
    eyebrow: "SOLUTIONS / PLATFORM ENGINEERING",
    title: "Standardize tenant isolation as infrastructure.",
    intro: "Give internal platform teams a common enforcement and verification path for services that need tenant-aware access.",
    sections: [
      { title: "One shared capability", body: "Provide a consistent model to application teams instead of distributing isolation rules across every service." },
      { title: "Observable controls", body: "Make the decision path and verification result inspectable so platform teams can diagnose failures." },
      { title: "Operational confidence", body: "Verification and evidence can become part of deployment and operational workflows as the platform expands." },
    ],
  },
};

const productNav = [
  ["operating-model", "Operating Model"],
  ["enforcement", "Enforcement"],
  ["verification", "Verification"],
  ["evidence", "Evidence"],
] as const;

const solutionNav = [
  ["b2b-saas", "B2B SaaS"],
  ["enterprise-saas", "Enterprise SaaS"],
  ["developer-platforms", "Developer Platforms"],
  ["security-sensitive-systems", "Security-Sensitive Systems"],
  ["startups", "Startups"],
  ["platform-engineering", "Platform Engineering"],
] as const;

function BoundaryRail() {
  return (
    <div className="product-boundary-rail">
      {["Identity", "Tenant Context", "Proxima", "PostgreSQL", "Verification", "Evidence"].map((item, index) => (
        <div key={item} className="product-boundary-step">
          <span>{String(index + 1).padStart(2, "0")}</span>
          <strong>{item}</strong>
          {index < 5 && <ArrowRight size={15} aria-hidden="true" />}
        </div>
      ))}
    </div>
  );
}

function DetailPage({ data, nav, base, currentKey }: { data: Detail; nav: readonly (readonly [string, string])[]; base: string; currentKey: string }) {
  return (
    <main className="product-detail-page">
      <header className="product-detail-hero">
        <div className="product-detail-hero-inner">
          <span className="public-eyebrow">{data.eyebrow}</span>
          <h1>{data.title}</h1>
          <p>{data.intro}</p>
        </div>
      </header>
      <div className="product-detail-shell public-container">
        <aside className="product-detail-sidebar">
          <span>EXPLORE</span>
          {nav.map(([key, label]) => <Link key={key} className={currentKey === key ? "active" : ""} to={base + "/" + key}>{label}</Link>)}
          <div />
          <Link to={base === "/product" ? "/developers/quickstart" : "/docs/getting-started"}>Implementation guide <ArrowRight size={14}/></Link>
        </aside>
        <article className="product-detail-content">
          <BoundaryRail />
          {data.sections.map((section, index) => (
            <section key={section.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div><h2>{section.title}</h2><p>{section.body}</p></div>
            </section>
          ))}
          <div className="product-detail-footer">
            <Link to={base}>Back to {base === "/product" ? "Product" : "Solutions"} <ArrowRight size={15}/></Link>
            <Link to="/contact">Talk to Agata Proxima <ArrowRight size={15}/></Link>
          </div>
        </article>
      </div>
    </main>
  );
}

export function Product() {
  return (
    <main className="product-landing-page">
      <header className="product-landing-hero">
        <div>
          <span className="public-eyebrow">PRODUCT</span>
          <h1>Tenant isolation infrastructure for systems that need an enforceable boundary.</h1>
          <p>Agata Proxima gives multi-tenant systems a dedicated path from identity and tenant context through enforcement, PostgreSQL isolation, verification and evidence.</p>
          <div className="product-landing-actions">
            <Link className="button button-primary" to="/signup">Start building</Link>
            <Link className="button button-secondary" to="/product/operating-model">Explore the operating model</Link>
          </div>
        </div>
        <BoundaryRail />
      </header>
      <section className="product-proof public-container">
        <div><span className="public-eyebrow">THE MODEL</span><h2>Six responsibilities. One request path.</h2><p>Each layer has a defined job. The value is the boundary between them.</p></div>
        <div className="product-proof-grid">
          {productNav.map(([key, label], index) => <Link to={"/product/" + key} key={key}><span>{String(index + 1).padStart(2, "0")}</span><strong>{label}</strong><p>{productDetails[key].intro}</p><ArrowRight size={16}/></Link>)}
        </div>
      </section>
      <section className="product-decision">
        <div className="public-container product-decision-inner">
          <div><span className="public-eyebrow">DECISION MODEL</span><h2>Make the safe path explicit.</h2><p>Same-tenant access is allowed. Cross-tenant access and invalid tenant context are blocked.</p></div>
          <div className="product-decision-grid"><div><span>ALLOW</span><strong>A → A</strong><p>Requested and protected tenant match.</p></div><div><span>BLOCK</span><strong>A → B</strong><p>Requested tenant crosses the protected boundary.</p></div><div><span>BLOCK</span><strong>Expired context</strong><p>The request can no longer prove valid tenant scope.</p></div></div>
        </div>
      </section>
    </main>
  );
}

export function ProductDetail({ kind }: { kind: keyof typeof productDetails }) {
  return <DetailPage data={productDetails[kind]} nav={productNav} base="/product" currentKey={kind} />;
}

export function Solutions() {
  return (
    <main className="solutions-landing-page">
      <header className="solutions-landing-hero">
        <div className="public-container">
          <span className="public-eyebrow">SOLUTIONS</span>
          <h1>One isolation model, adapted to the system you are building.</h1>
          <p>Choose the environment where tenant boundaries matter most, then follow the operating model that fits your architecture.</p>
        </div>
      </header>
      <section className="solutions-grid-section public-container">
        <div className="solutions-intro"><span className="public-eyebrow">USE CASES</span><h2>Where Proxima fits.</h2></div>
        <div className="solutions-grid">
          {solutionNav.map(([key, label], index) => <Link key={key} to={"/solutions/" + key}><span>{String(index + 1).padStart(2, "0")}</span><strong>{label}</strong><p>{solutionDetails[key].intro}</p><ArrowRight size={16}/></Link>)}
        </div>
      </section>
      <section className="solutions-architecture">
        <div className="public-container"><span className="public-eyebrow">COMMON FOUNDATION</span><h2>Different workloads. The same enforceable boundary.</h2><BoundaryRail /></div>
      </section>
    </main>
  );
}

export function SolutionDetail({ kind }: { kind: keyof typeof solutionDetails }) {
  return <DetailPage data={solutionDetails[kind]} nav={solutionNav} base="/solutions" currentKey={kind} />;
}

export function Pricing() {
  const plans = [
    ["Free", "$0", "Explore the model and build with the core concepts."],
    ["Starter", "$149 / month", "Introduce a dedicated tenant isolation boundary in a production system."],
    ["Growth", "$499 / month", "Operate stronger verification and isolation controls as the system grows."],
    ["Scale", "$1,199 / month", "Run Proxima as infrastructure across larger production environments."],
    ["Enterprise", "Custom", "Align deployment, identity, security and commercial requirements with your organization."],
  ];
  return (
    <main className="pricing-page">
      <header className="pricing-hero">
        <div className="public-container">
          <span className="public-eyebrow">PRICING</span>
          <h1>Choose the operating level that matches your isolation needs.</h1>
          <p>Plans describe the commercial starting points. Exact capabilities and requirements should be confirmed against the deployed product and your environment.</p>
        </div>
      </header>
      <section className="pricing-plans public-container">
        {plans.map(([name, price, body], index) => (
          <article key={name} className={index === 2 ? "featured" : ""}>
            <span className="pricing-plan-index">{String(index + 1).padStart(2, "0")}</span>
            <h2>{name}</h2><strong>{price}</strong><p>{body}</p>
            <Link to="/contact">Talk to Agata <ArrowRight size={15}/></Link>
          </article>
        ))}
      </section>
      <section className="pricing-next public-container">
        <div><span className="public-eyebrow">BEFORE YOU CHOOSE</span><h2>See the implementation before the commercial decision.</h2><p>Review the product model, developer platform and documentation so you can evaluate how Proxima fits your architecture.</p></div>
        <div><Link to="/product">Product <ArrowRight size={15}/></Link><Link to="/developers">Developer Platform <ArrowRight size={15}/></Link><Link to="/docs">Documentation <ArrowRight size={15}/></Link></div>
      </section>
    </main>
  );
}

