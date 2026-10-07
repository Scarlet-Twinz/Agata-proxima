import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const resources = [
["Getting started","Understand the complete path from the first workspace to a verified integration: identity, organization context, tenant context, protected database access and verification.","/docs/getting-started"],
["Core concepts","Organizations, tenants, projects, policies, nodes, deployments, verification results, audit evidence and billing entitlements form the platform vocabulary.","/docs/core-concepts"],
["API reference","The control-plane API exposes authenticated organization, tenant, policy, fleet, deployment, verification, audit, support and billing contracts.","/docs/api-reference"],
["Security architecture","Understand why the Proxima Engine remains the runtime enforcement authority and why the control plane must never become an authorization bypass.","/docs/security"],
["Operations","Follow the desired-state → observed-state → verified lifecycle for nodes, deployments, policy changes and security evidence.","/docs/operations"],
["Troubleshooting","Diagnose authentication, tenant context, policy, database, deployment, verification, billing and integration failures systematically.","/docs/troubleshooting"],
["Verification","Run explicit expected-allow and expected-block tests so tenant isolation becomes inspectable evidence rather than an assumption.","/docs/verification"],
];

const principles=[
["01","Engine-first enforcement","The Proxima Engine remains authoritative for the data-plane security boundary."],
["02","Control without bypass","The control plane manages intent and lifecycle but cannot authorize a protected operation merely because it is available."],
["03","Evidence over status theatre","Verification results and audit events are first-class resources."],
["04","Explicit contracts","Authentication, tenant context, policy, fleet, billing and API behavior should remain visible and testable."],
["05","Operational lifecycle","The platform connects definition, deployment, enforcement and verification rather than treating the dashboard as a collection of disconnected pages."],
["06","Production honesty","Capabilities that require real infrastructure, provider credentials or business validation are not represented as completed merely because source code exists."],
];

export function Docs(){
return <PublicPage eyebrow="Documentation" title="Everything your engineering team needs to understand Proxima." description="Architecture, integration, security, API contracts, operations and verification—written as an engineering reference rather than a marketing checklist.">
<section className="public-content"><div className="agata-container">
<div className="public-prose"><h2>Start with the operating model.</h2><p>Agata Proxima establishes a dedicated boundary between application identity, tenant context and protected PostgreSQL operations. The management layer records intent and evidence; the Proxima Engine remains the runtime authority.</p><pre className="public-code">{`Application identity
        ↓
Tenant context
        ↓
Proxima enforcement boundary
        ↓
PostgreSQL roles / RLS
        ↓
Verification
        ↓
Audit evidence`}</pre></div>
<div className="public-feature-grid">{resources.map(([title,text,to])=><article className="public-feature" key={title}><h3>{title}</h3><p>{text}</p><Link to={to} className="public-inline-link">Read the guide <ArrowRight size={15}/></Link></article>)}</div>
<section className="public-detail-section"><h2>Documentation principles</h2><div className="public-feature-grid">{principles.map(([n,t,d])=><article className="public-feature" key={n}><div className="public-changelog-date">{n}</div><h3>{t}</h3><p>{d}</p></article>)}</div></section>
<section className="public-detail-section"><h2>Integration sequence</h2><p>1. Create or join an organization. 2. Authenticate and establish the session contract. 3. Define projects and tenant boundaries. 4. Author versioned policy intent. 5. Enroll enforcement nodes and environments. 6. Create desired deployments. 7. Run verification against expected isolation behavior. 8. Inspect audit evidence.</p><p>For machine-readable integration, use the developer API reference and OpenAPI surface. For security-sensitive changes, treat the backend contract and verification evidence as authoritative over UI presentation.</p></section>
</div></div></section>
</PublicPage>;
}