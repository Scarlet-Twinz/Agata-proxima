import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const resources = [
  ["Quickstart","Understand the integration path from application identity to Proxima and PostgreSQL.","/developers/quickstart"],
  ["Authentication","Work with API credentials, service identities and enterprise identity configuration.","/developers/authentication"],
  ["Tenant context","Learn how tenant identity moves through the protected request path.","/developers/tenant-context"],
  ["Verification","Test expected isolation behavior and inspect the resulting evidence.","/product/verification"],
  ["API reference","Explore the control-plane contracts and operational interfaces exposed by Agata.","/developers/api-reference"],
  ["Webhooks and events","Connect Agata events to the systems your engineering and security teams already operate.","/developers/webhooks"],
  ["SDKs","Explore the language-level integration surface.","/developers/sdks"],
  ["CLI","Operate Proxima from a direct command-line workflow.","/developers/cli"],
  ["Terraform","Connect infrastructure-as-code workflows to Proxima.","/developers/terraform"],
];

export function Developers() {
  return (
    <PublicPage
      eyebrow="Developer platform"
      title="Integrate tenant isolation into the infrastructure you already have."
      description="Agata is designed for engineering teams. Understand the model, connect your application, enforce tenant context and verify the boundary."
    >
      <section className="public-content">
        <div className="agata-container">
          <div className="public-feature-grid">
            {resources.map(([title,text,to]) => (
              <article className="public-feature" key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
                <Link to={to} className="public-inline-link">Open resource <ArrowRight size={15} /></Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
