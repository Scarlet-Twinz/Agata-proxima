import { ArrowRight, ChevronRight, Code2 } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const resources=[
["Quickstart","Create a workspace, authenticate, establish organization context and verify the first tenant boundary.","/developers/quickstart"],
["Authentication","Understand sessions, CSRF, email verification and enterprise identity.","/developers/authentication"],
["Organizations","Understand membership, roles, invitations and the workspace boundary.","/developers/organizations"],
["Tenant context","Carry tenant identity through the protected request path.","/developers/tenant-context"],
["Policies","Author versioned enforcement intent.","/developers/policies"],
["Fleet","Register nodes and environments.","/developers/fleet"],
["Deployments","Move desired state through a real lifecycle.","/developers/deployments"],
["Verification","Record and inspect security evidence.","/developers/verification"],
["Audit","Inspect organization-scoped history.","/developers/audit"],
["Webhooks","Create signed event endpoints and inspect delivery history.","/developers/webhooks"],
["Events","Understand security and operational event categories.","/developers/events"],
["SDKs","Language-level integration guidance.","/developers/sdks"],
["CLI","Command-line operator workflows.","/developers/cli"],
["Terraform","Infrastructure-as-code integration.","/developers/terraform"],
["API reference","Machine-readable control-plane contracts.","/developers/api-reference"],
];
const side=[["Developer home","/developers"],["Quickstart","/developers/quickstart"],["Authentication","/developers/authentication"],["Organizations","/developers/organizations"],["Tenant context","/developers/tenant-context"],["Policies","/developers/policies"],["Fleet","/developers/fleet"],["Deployments","/developers/deployments"],["Verification","/developers/verification"],["Audit","/developers/audit"],["Webhooks","/developers/webhooks"],["Events","/developers/events"],["SDKs","/developers/sdks"],["CLI","/developers/cli"],["Terraform","/developers/terraform"],["API reference","/developers/api-reference"]];

export function Developers(){return <PublicPage eyebrow="Developer platform" title="A developer portal with a destination for every integration concern." description="Authentication, tenant context, fleet, deployments, verification, webhooks, SDKs, CLI and API reference are organized as a real documentation tree rather than a set of dead cards."><section className="public-content"><div className="agata-container"><div className="public-detail-layout"><aside className="public-detail-sidebar"><div className="public-detail-sidebar-title">Developer platform</div>{side.map(([label,to])=><Link key={to} to={to}>{label}<ChevronRight size={13}/></Link>)}</aside><div><div className="public-prose"><h2>Authenticate → configure → enforce → verify.</h2><p>The dashboard is the operational surface. The developer portal explains what applications and infrastructure actually need to do.</p><pre className="public-code">{`POST /api/v1/auth/login
GET  /api/v1/session
POST /api/v1/tenants
POST /api/v1/policies
POST /api/v1/nodes
POST /api/v1/deployments
POST /api/v1/verifications
GET  /api/v1/audit
GET  /api/v1/developer/webhooks`}</pre></div><div className="public-feature-grid">{resources.map(([title,text,to])=><Link className="public-feature public-feature-action" key={title} to={to}><Code2 size={19} color="var(--agata-blue)"/><h3>{title}</h3><p>{text}</p><span className="public-inline-link">Open resource <ArrowRight size={15}/></span></Link>)}</div></div></div></div></section></PublicPage>;}
