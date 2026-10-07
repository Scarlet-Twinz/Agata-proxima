import { ArrowRight, ShieldCheck, Server, Code2, Database, FileSearch } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const resources = [
  ["Getting started","Connect a development application and understand the path from identity and tenant context to Proxima enforcement and PostgreSQL.","/docs/getting-started"],
  ["Architecture","Understand the Engine boundary, PostgreSQL role routing, authentication brokering, TLS legs and connection lifecycle.","/docs/core-concepts"],
  ["Security and threat model","Review cross-tenant threats, privileged bypass risks, context forgery, session leakage and required verification evidence.","/docs/security"],
  ["API reference","Understand authenticated organization, tenant, policy, node, deployment, verification, audit and support contracts.","/docs/api-reference"],
  ["Operations","Deploy intentionally, observe state, run verification, inspect evidence and investigate failures without manufacturing success.","/docs/operations"],
  ["Verification","Exercise expected allows and expected blocks, including cross-tenant, missing and malformed context.","/docs/verification"],
  ["Troubleshooting","Diagnose authentication, policy, database, deployment and verification failures systematically.","/docs/troubleshooting"],
];

export function Docs() {
  return (
    <PublicPage eyebrow="Documentation" title="The architecture, contracts and security model behind Agata Proxima." description="These guides describe what the platform actually enforces, what the control plane manages, how verification works and which production boundaries still require real infrastructure evidence.">
      <section className="public-content">
        <div className="agata-container">
          <div className="public-feature-grid">
            {resources.map(([title,text,to]) => (
              <article className="public-feature" key={title}>
                <h3>{title}</h3><p>{text}</p>
                <Link to={to} className="public-inline-link">Read the full guide <ArrowRight size={15}/></Link>
              </article>
            ))}
          </div>
          <div className="public-prose" style={{marginTop:"72px"}}>
            <h2>How the platform fits together</h2>
            <p>Proxima sits between an application and PostgreSQL. Tenant identity is established before protected database work continues, and PostgreSQL remains part of the enforcement model through tenant-specific roles and row-level security.</p>
            <div className="public-feature-grid">
              <article className="public-feature"><ShieldCheck size={22}/><h3>Security boundary</h3><p>Missing, expired, duplicate or tampered tenant context is intended to fail closed. Security claims are backed by executable tests rather than dashboard labels.</p></article>
              <article className="public-feature"><Server size={22}/><h3>Runtime engine</h3><p>The Engine is the data-plane authority. The hosted control-plane foundation manages configuration and evidence but does not silently become the runtime enforcement authority.</p></article>
              <article className="public-feature"><Code2 size={22}/><h3>Developer contracts</h3><p>Authenticated APIs expose organization-scoped resources for tenants, policies, nodes, deployments, verification, audit and support.</p></article>
              <article className="public-feature"><Database size={22}/><h3>Database enforcement</h3><p>PostgreSQL roles and RLS remain important because privileged database paths can otherwise bypass application-level assumptions.</p></article>
              <article className="public-feature"><FileSearch size={22}/><h3>Evidence</h3><p>Verification results and audit events provide an inspectable trail around security decisions and operational changes.</p></article>
            </div>
            <div className="public-callout" style={{marginTop:"48px"}}><strong>Production-readiness distinction</strong><p>The repository can prove implementation and automated checks. It cannot honestly claim a real customer SaaS acceptance environment, production secret management, backups, external identity or operational capacity without running those environments.</p></div>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
