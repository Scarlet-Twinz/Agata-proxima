import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const resources=[
["Quickstart","Create a workspace, authenticate, establish organization context and move through the first verified tenant-isolation workflow.","/developers/quickstart"],
["Authentication","Understand password sessions, CSRF protection, email verification and the enterprise identity path.","/developers/authentication"],
["Organizations","Understand organization membership, roles, invitations and the workspace boundary.","/developers/organizations"],
["Tenant context","Keep tenant identity attached to the protected request path instead of treating it as ordinary application metadata.","/developers/tenant-context"],
["Policies","Author versioned enforcement intent as explicit JSON policy documents and understand plan-controlled policy management.","/developers/policies"],
["Fleet","Register nodes, environments and operational identity before moving desired state into the enforcement fleet.","/developers/fleet"],
["Deployments","Understand desired state, observed state and deployment lifecycle without pretending that a queued deployment is already healthy.","/developers/deployments"],
["Verification","Submit explicit verification evidence and distinguish expected access from expected rejection.","/developers/verification"],
["Audit","Inspect organization-scoped administrative and security history.","/developers/audit"],
["API reference","Explore the control-plane contracts and resource groups exposed under /api/v1.","/developers/api-reference"],
["Webhooks and events","Connect operational and security events to the systems your engineering and security teams already use.","/developers/webhooks"],
["SDKs / CLI / Terraform","Use language-level, command-line and infrastructure-as-code integration surfaces without hiding the underlying security contract.","/developers/sdks"],
];

export function Developers(){
return <PublicPage eyebrow="Developer platform" title="Integrate tenant isolation into the infrastructure you already have." description="The developer surface explains the contracts behind Proxima: authentication, tenant context, lifecycle, verification, API resources and operational evidence.">
<section className="public-content"><div className="agata-container">
<div className="public-prose"><h2>Authenticate → configure → enforce → verify.</h2><p>The dashboard is an operational surface. The developer portal explains what the application and infrastructure must actually do. Proxima is designed so tenant context remains explicit before protected database access is allowed.</p><pre className="public-code">{`POST /api/v1/auth/login
GET  /api/v1/session
POST /api/v1/tenants
POST /api/v1/policies
POST /api/v1/nodes
POST /api/v1/deployments
POST /api/v1/verifications
GET  /api/v1/audit`}</pre></div>
<div className="public-feature-grid">{resources.map(([title,text,to])=><article className="public-feature" key={title}><h3>{title}</h3><p>{text}</p><Link to={to} className="public-inline-link">Open resource <ArrowRight size={15}/></Link></article>)}</div>
<section className="public-detail-section"><h2>Engineering contract</h2><p>Authentication identifies the caller. Organization context identifies the administrative boundary. Tenant context identifies the protected customer boundary. Policies describe intended enforcement behavior. The Engine enforces the runtime boundary. Verification and audit make the result inspectable.</p><p>Do not treat a control-plane response as proof that the data plane is healthy. Desired state, observed state and verified state are distinct concepts and should remain distinct in integrations.</p></section>
</div></section>
</PublicPage>;
}