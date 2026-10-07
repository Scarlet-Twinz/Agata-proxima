import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { PublicPage } from "../../components/layout/PublicPage";

const areas = [
  ["Operating model","See how identity, tenant context, enforcement, PostgreSQL and evidence fit together.","/product/model"],
  ["Enforcement","Understand the explicit security decision boundary.","/product/enforcement"],
  ["Verification","See how isolation behavior is tested instead of assumed.","/product/verification"],
  ["Evidence","Understand the operational evidence around security decisions.","/product/evidence"],
];

export function Product() {
  return (
    <PublicPage
      eyebrow="Product"
      title="Tenant isolation as infrastructure."
      description="Agata Proxima places a dedicated enforcement boundary between application identity and protected PostgreSQL operations."
    >
      <section className="public-content">
        <div className="agata-container">
          <div className="public-prose">
            <h2>The Proxima model</h2>
            <p>
              A multi-tenant application should not rely entirely on application code
              to preserve tenant boundaries. Proxima introduces an explicit infrastructure
              boundary where tenant context can be enforced and verified before database
              operations are allowed to proceed.
            </p>
            <pre className="public-code">{`Identity
   ↓
Tenant context
   ↓
Proxima enforcement boundary
   ↓
PostgreSQL roles / RLS
   ↓
Verification
   ↓
Audit evidence`}</pre>
          </div>

          <div className="public-feature-grid public-product-area-grid">
            {areas.map(([title,text,to]) => (
              <article className="public-feature" key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
                <Link to={to} className="public-inline-link">
                  Explore {title} <ArrowRight size={15} />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
