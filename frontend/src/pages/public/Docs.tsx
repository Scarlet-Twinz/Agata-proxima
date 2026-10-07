import { ArrowRight, BookOpen, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const resources=[
["Getting started","Move from the architecture model to your first verified integration.","/docs/getting-started"],
["Core concepts","Organizations, tenants, projects, policies, nodes, deployments and evidence.","/docs/core-concepts"],
["API reference","Authenticated control-plane contracts and the OpenAPI surface.","/docs/api-reference"],
["Security","The enforcement boundary, database controls and verification model.","/docs/security"],
["Operations","Desired state, observed state, verification and audit workflows.","/docs/operations"],
["Troubleshooting","A systematic path through authentication, policy, fleet and integration failures.","/docs/troubleshooting"],
["Verification","Expected allows, expected blocks and inspectable evidence.","/docs/verification"],
];

const side=[["Documentation home","/docs"],["Getting started","/docs/getting-started"],["Core concepts","/docs/core-concepts"],["API reference","/docs/api-reference"],["Security","/docs/security"],["Operations","/docs/operations"],["Troubleshooting","/docs/troubleshooting"],["Verification","/docs/verification"]];

export function Docs(){return <PublicPage eyebrow="Documentation" title="The engineering reference for Agata Proxima." description="A deep documentation tree for architecture, API contracts, operations, security and verification. Every concept has a destination and every destination points to the next useful action."><section className="public-content"><div className="agata-container"><div className="public-detail-layout"><aside className="public-detail-sidebar"><div className="public-detail-sidebar-title">Documentation</div>{side.map(([label,to])=><Link key={to} to={to}>{label}<ChevronRight size={13}/></Link>)}</aside><div><div className="public-prose"><h2>Start with the operating model.</h2><p>Agata Proxima establishes a dedicated boundary between application identity, tenant context and protected PostgreSQL operations. The management layer records intent and evidence; the Proxima Engine remains the runtime authority.</p><pre className="public-code">{`Application identity
        ↓
Tenant context
        ↓
Proxima enforcement boundary
        ↓
PostgreSQL roles / RLS
        ↓
Verification
        ↓
Audit evidence`}</pre></div><div className="public-feature-grid">{resources.map(([title,text,to])=><Link className="public-feature public-feature-action" key={title} to={to}><BookOpen size={19} color="var(--agata-blue)"/><h3>{title}</h3><p>{text}</p><span className="public-inline-link">Open guide <ArrowRight size={15}/></span></Link>)}</div><section className="public-detail-section"><h2>Documentation principles</h2><div className="public-feature-grid"><article className="public-feature"><h3>Evidence over status theatre</h3><p>Verification results and audit events are first-class resources.</p></article><article className="public-feature"><h3>Explicit contracts</h3><p>Authentication, tenant context, policy, fleet, billing and API behavior stay visible and testable.</p></article><article className="public-feature"><h3>Operational lifecycle</h3><p>Definition, deployment, enforcement and verification form one connected workflow.</p></article><article className="public-feature"><h3>Production honesty</h3><p>Deployment-gated capabilities are documented as gates rather than presented as completed facts.</p></article></div></section></div></div></div></section></PublicPage>;}
