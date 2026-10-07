import { ExternalLink } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

type Section = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

type Detail = {
  eyebrow: string;
  title: string;
  description: string;
  sections: Section[];
  links?: { label: string; to: string; external?: boolean }[];
};

const details: Record<string, Detail> = {
  "/product/model": {
    eyebrow: "Product · Operating model",
    title: "A clear path from identity to evidence.",
    description: "Understand the boundary Proxima establishes between application identity, tenant context and protected PostgreSQL operations.",
    sections: [
      { title: "The boundary", paragraphs: ["Application identity establishes who is acting. Tenant context establishes which customer boundary is in scope. Proxima evaluates that context before protected database work proceeds."] },
      { title: "Why it matters", paragraphs: ["The goal is to make tenant isolation an infrastructure property that can be enforced and tested rather than a convention scattered across application code."] },
    ],
    links: [{label:"Product overview",to:"/product"},{label:"Security model",to:"/security"}],
  },
  "/product/enforcement": {
    eyebrow: "Product · Enforcement",
    title: "Invalid tenant context is a security failure.",
    description: "Proxima is designed to reject missing, invalid, expired or cross-tenant context before protected operations continue.",
    sections: [
      { title: "Decision boundary", paragraphs: ["Enforcement happens at a dedicated infrastructure boundary. The application does not get to silently bypass the tenant decision when it reaches the protected data path."] },
      { title: "Layered controls", bullets: ["Identity and tenant context", "Proxima enforcement", "PostgreSQL roles and row-level security", "Verification and audit evidence"] },
    ],
    links: [{label:"Security",to:"/security"},{label:"Verification",to:"/product/verification"}],
  },
  "/product/verification": {
    eyebrow: "Product · Verification",
    title: "Test the boundary instead of trusting it.",
    description: "Verification exercises expected isolation behavior and records evidence that engineering and security teams can inspect.",
    sections: [
      { title: "Expected allows", paragraphs: ["Valid tenant-local operations should be accepted when the configured policy and context permit them."] },
      { title: "Expected blocks", paragraphs: ["Cross-tenant, missing, malformed or otherwise invalid context should fail explicitly."] },
    ],
    links: [{label:"Verification documentation",to:"/docs/verification"},{label:"Trust center",to:"/trust"}],
  },
  "/product/evidence": {
    eyebrow: "Product · Evidence",
    title: "Make security decisions inspectable.",
    description: "Policies, verification outcomes and operational events form an evidence trail around the isolation boundary.",
    sections: [
      { title: "Operational evidence", paragraphs: ["Evidence gives teams a way to investigate what happened rather than relying on a dashboard claim or an application log alone."] },
      { title: "Auditability", paragraphs: ["The control plane exposes audit-oriented surfaces while the enforcement boundary remains independently responsible for isolation."] },
    ],
    links: [{label:"Audit documentation",to:"/docs/operations"},{label:"Changelog",to:"/changelog"}],
  },
  "/solutions/b2b-saas": {
    eyebrow:"Solutions · B2B SaaS", title:"Tenant boundaries for B2B SaaS.", description:"Protect customer organizations and their tenants without making every application path responsible for isolation alone.",
    sections:[{title:"Designed for customer boundaries",paragraphs:["Use a consistent infrastructure model as customer count, services and data access paths grow."]},{title:"What to explore",bullets:["Tenant context enforcement","Policy management","Verification","Audit evidence"]}],
    links:[{label:"Product",to:"/product"},{label:"Pricing",to:"/pricing"}],
  },
  "/solutions/enterprise-saas": {
    eyebrow:"Solutions · Enterprise SaaS", title:"Operational isolation for enterprise SaaS.", description:"Give security and engineering teams an infrastructure boundary they can inspect, operate and verify.",
    sections:[{title:"Enterprise operating model",paragraphs:["Centralize the controls and evidence around tenant isolation so security reviews can reference an explicit architecture."]}],
    links:[{label:"Security",to:"/security"},{label:"Trust",to:"/trust"}],
  },
  "/solutions/developer-platforms": {
    eyebrow:"Solutions · Developer platforms", title:"Keep tenant context attached to the request path.", description:"Build developer platforms where tenant identity remains part of the protected infrastructure flow.",
    sections:[{title:"Developer experience",paragraphs:["Give application teams clear integration points while keeping enforcement and verification outside individual feature paths."]}],
    links:[{label:"Developer platform",to:"/developers"},{label:"Documentation",to:"/docs"}],
  },
  "/solutions/security-sensitive": {
    eyebrow:"Solutions · Security-sensitive systems", title:"Make cross-tenant access an explicit failure condition.", description:"Use infrastructure controls when the cost of a tenant boundary mistake is high.",
    sections:[{title:"Security posture",paragraphs:["Proxima combines enforcement, database controls, verification and evidence into a model designed to be tested."]}],
    links:[{label:"Security",to:"/security"},{label:"Trust center",to:"/trust"}],
  },
  "/solutions/startups": {
    eyebrow:"Solutions · Growing startups", title:"Establish the isolation model before it becomes sprawling.", description:"Start with an explicit tenant boundary before customer growth turns isolation into a distributed application concern.",
    sections:[{title:"Start with a boundary",paragraphs:["A clear infrastructure contract can reduce the number of application paths that need to understand every tenant-security detail."]}],
    links:[{label:"Pricing",to:"/pricing"},{label:"FAQ",to:"/faq"}],
  },
  "/solutions/platform-engineering": {
    eyebrow:"Solutions · Platform engineering", title:"Centralize tenant-isolation enforcement.", description:"Give platform teams a consistent security boundary instead of rebuilding the same controls across services.",
    sections:[{title:"Platform responsibility",paragraphs:["Make the boundary a reusable infrastructure capability that application teams can integrate and verify."]}],
    links:[{label:"Developer platform",to:"/developers"},{label:"Operations docs",to:"/docs/operations"}],
  },
  "/developers/quickstart": {
    eyebrow:"Developers · Quickstart", title:"Your first Proxima integration.", description:"Follow the path from application identity to tenant context, enforcement and verification.",
    sections:[{title:"Integration path",bullets:["Establish application identity","Resolve tenant context","Connect to Proxima","Verify tenant-local and cross-tenant behavior","Inspect evidence"]}],
    links:[{label:"Getting started docs",to:"/docs/getting-started"},{label:"API reference",to:"/developers/api-reference"}],
  },
  "/developers/authentication": {
    eyebrow:"Developers · Authentication", title:"Authentication and service identity.", description:"Understand credentials, service identities and the authentication contracts around the control plane.",
    sections:[{title:"Authentication model",paragraphs:["Authentication identifies the caller. Tenant context then establishes the customer boundary that protected operations are permitted to access."]}],
    links:[{label:"API reference",to:"/developers/api-reference"},{label:"Security",to:"/security"}],
  },
  "/developers/tenant-context": {
    eyebrow:"Developers · Tenant context", title:"Carry tenant identity through the protected path.", description:"Treat tenant context as a first-class part of the infrastructure request path.",
    sections:[{title:"Context lifecycle",bullets:["Resolve context from authenticated identity","Validate the tenant boundary","Enforce before protected database access","Verify expected isolation behavior"]}],
    links:[{label:"Product model",to:"/product/model"},{label:"Verification",to:"/product/verification"}],
  },
  "/developers/webhooks": {
    eyebrow:"Developers · Webhooks", title:"Connect Proxima events to your systems.", description:"Design webhook consumers around explicit event contracts, retries and safe handling.",
    sections:[{title:"Webhook principles",bullets:["Authenticate incoming deliveries","Treat event IDs as idempotency keys","Persist processing state before side effects","Retry safely on transient failures","Log delivery outcomes without leaking secrets"]},{title:"Event surfaces",paragraphs:["Webhook contracts can carry verification, operational or security-oriented events into systems your engineering and security teams already operate."]}],
    links:[{label:"Events",to:"/developers/events"},{label:"Troubleshooting",to:"/docs/troubleshooting"}],
  },
  "/developers/events": {
    eyebrow:"Developers · Events", title:"Understand the event model.", description:"Use explicit event contracts for security, verification and operational workflows.",
    sections:[{title:"Event categories",bullets:["Verification outcomes","Security events","Deployment events","Operational changes","Support-related events"]}],
    links:[{label:"Webhooks",to:"/developers/webhooks"},{label:"Audit evidence",to:"/product/evidence"}],
  },
  "/developers/sdks": {
    eyebrow:"Developers · SDKs", title:"Integrate from the language your team already uses.", description:"The SDK surface is designed to keep application integration focused on explicit Proxima contracts.",
    sections:[{title:"SDK responsibilities",paragraphs:["SDKs should make authentication, tenant context and API calls predictable without hiding the security boundary."]}],
    links:[{label:"API reference",to:"/developers/api-reference"},{label:"Documentation",to:"/docs"}],
  },
  "/developers/cli": {
    eyebrow:"Developers · CLI", title:"Operate Proxima from the command line.", description:"A CLI surface gives engineers a direct workflow for inspecting configuration, verification and operational state.",
    sections:[{title:"CLI workflow",bullets:["Authenticate","Select the target environment","Inspect configuration","Run verification","Review results"]}],
    links:[{label:"Terraform",to:"/developers/terraform"},{label:"Operations",to:"/docs/operations"}],
  },
  "/developers/terraform": {
    eyebrow:"Developers · Terraform", title:"Infrastructure as code for Proxima.", description:"Connect Proxima provisioning and configuration to infrastructure workflows built around Terraform.",
    sections:[{title:"Terraform integration",paragraphs:["Terraform can describe infrastructure configuration as code and keep changes reviewable and repeatable. Proxima's Terraform experience should follow the same principle: explicit configuration, predictable plans and auditable changes."]},{title:"Official Terraform documentation",paragraphs:["Use HashiCorp's official Terraform documentation for the Terraform language, CLI and provider ecosystem."]}],
    links:[{label:"Terraform documentation",to:"https://developer.hashicorp.com/terraform/docs",external:true},{label:"Terraform CLI",to:"https://developer.hashicorp.com/terraform/cli",external:true},{label:"Proxima developer platform",to:"/developers"}],
  },
  "/developers/api-reference": {
    eyebrow:"Developers · API reference", title:"The control-plane contracts.", description:"Reference the API surfaces used for organizations, tenants, policies, deployments, verification, audit and developer operations.",
    sections:[{title:"Core resource groups",bullets:["Organizations and membership","Tenants and policies","Nodes and deployments","Verification and audit","Developer credentials and events"]},{title:"Contract discipline",paragraphs:["API behavior should be explicit, authenticated and compatible with the control-plane authority boundary described in the platform architecture."]}],
    links:[{label:"OpenAPI surface",to:"/docs/api-reference"},{label:"Developer platform",to:"/developers"}],
  },
  "/docs/getting-started": {
    eyebrow:"Docs · Getting started", title:"Get from zero to a verified integration.", description:"Start with the architecture and move through the smallest useful integration path.",
    sections:[{title:"First steps",bullets:["Understand the enforcement boundary","Configure identity and tenant context","Connect the protected database path","Run verification","Review evidence"]}],
    links:[{label:"Developer quickstart",to:"/developers/quickstart"},{label:"Troubleshooting",to:"/docs/troubleshooting"}],
  },
  "/docs/core-concepts": {
    eyebrow:"Docs · Core concepts", title:"The concepts behind Proxima.", description:"Organizations, tenants, policies, nodes, verification and evidence form the control-plane vocabulary.",
    sections:[{title:"Core concepts",bullets:["Organization — the administrative boundary","Tenant — the customer/data boundary","Policy — the declared security behavior","Node — an enrolled enforcement component","Verification — a test of expected behavior","Evidence — inspectable operational results"]}],
    links:[{label:"Product model",to:"/product/model"},{label:"API reference",to:"/docs/api-reference"}],
  },
  "/docs/api-reference": {
    eyebrow:"Docs · API reference", title:"API contracts and operational interfaces.", description:"Understand the control-plane API from authentication through tenant, policy, deployment and verification workflows.",
    sections:[{title:"Reference areas",bullets:["Authentication","Organizations","Tenants","Policies","Deployments","Verification","Audit","Developer operations"]}],
    links:[{label:"Developer API reference",to:"/developers/api-reference"},{label:"OpenAPI",to:"/developers/api-reference"}],
  },
  "/docs/security": {
    eyebrow:"Docs · Security", title:"Security architecture and verification.", description:"Read the explicit security boundary instead of relying on unsupported claims.",
    sections:[{title:"Security model",paragraphs:["Identity, tenant context, enforcement, PostgreSQL controls, verification and audit evidence form a layered model."]},{title:"Verification",paragraphs:["Security behavior should be tested against expected allows and expected blocks."]}],
    links:[{label:"Security overview",to:"/security"},{label:"Trust center",to:"/trust"}],
  },
  "/docs/operations": {
    eyebrow:"Docs · Operations", title:"Operate the control plane with evidence.", description:"Understand deployments, fleet operations, verification and audit workflows.",
    sections:[{title:"Operational loop",bullets:["Deploy intentionally","Observe service state","Run verification","Inspect audit evidence","Investigate failures","Record changes"]}],
    links:[{label:"Status",to:"/status"},{label:"Changelog",to:"/changelog"}],
  },
  "/docs/troubleshooting": {
    eyebrow:"Docs · Troubleshooting", title:"Diagnose failures systematically.", description:"A practical route through authentication, policy, database, verification and integration failures.",
    sections:[{title:"Start with the boundary",bullets:["Confirm authentication state","Confirm tenant context","Check policy version and assignment","Check node and deployment state","Run verification","Inspect audit events"]},{title:"When to escalate",paragraphs:["Use support or contact the Agata team when the observed behavior cannot be explained by the documented contract."]}],
    links:[{label:"Support",to:"/support"},{label:"Contact",to:"/contact"}],
  },
  "/docs/verification": {
    eyebrow:"Docs · Verification", title:"Verify tenant isolation as a system property.", description:"Run controlled tests that distinguish expected access from expected rejection.",
    sections:[{title:"Verification checklist",bullets:["Valid tenant-local access succeeds","Cross-tenant access is rejected","Missing context is rejected","Malformed context is rejected","Evidence is recorded"]}],
    links:[{label:"Product verification",to:"/product/verification"},{label:"Trust center",to:"/trust"}],
  },
  "/changelog/frontend-reconstruction": {
    eyebrow:"Changelog · October 2026", title:"Frontend reconstruction.", description:"The public experience is being rebuilt around explicit routes, real destinations and a dedicated public-site architecture.",
    sections:[{title:"What changed",bullets:["Public route architecture","Dedicated product and company pages","Developer and documentation surfaces","Support, status and trust surfaces","Navigation and footer destinations"]}],
    links:[{label:"Current changelog",to:"/changelog"},{label:"Developer platform",to:"/developers"}],
  },
  "/changelog/control-plane-foundation": {
    eyebrow:"Changelog · Platform", title:"Control-plane foundation.", description:"The backend foundation provides the authenticated control plane while preserving the Proxima Engine's independent enforcement boundary.",
    sections:[{title:"Foundation",bullets:["Organizations and membership","Tenant inventory","Versioned policies","Node enrollment","Deployment intent","Verification evidence","Append-only audit events","Support requests"]}],
    links:[{label:"Architecture",to:"/product/model"},{label:"Operations docs",to:"/docs/operations"}],
  },
};

export function PublicDetail() {
  const { pathname } = useLocation();
  const detail = details[pathname] ?? {
    eyebrow:"Agata Proxima",
    title:"Page not found",
    description:"The requested public destination does not exist.",
    sections:[{title:"Continue exploring",paragraphs:["Use the public navigation or return to the homepage."]}],
    links:[{label:"Home",to:"/"},{label:"Support",to:"/support"}],
  };

  return (
    <PublicPage eyebrow={detail.eyebrow} title={detail.title} description={detail.description}>
      <section className="public-content">
        <div className="agata-container">
          <article className="public-prose">
            {detail.sections.map((section) => (
              <section key={section.title} className="public-detail-section">
                <h2>{section.title}</h2>
                {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.bullets && <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}
              </section>
            ))}
            {detail.links && (
              <div className="public-detail-links">
                {detail.links.map((item) =>
                  item.external ? (
                    <a key={item.label} href={item.to} target="_blank" rel="noreferrer" className="agata-button agata-button-secondary">
                      {item.label}<ExternalLink size={15} />
                    </a>
                  ) : (
                    <Link key={item.label} to={item.to} className="agata-button agata-button-secondary">{item.label}</Link>
                  ),
                )}
              </div>
            )}
          </article>
        </div>
      </section>
    </PublicPage>
  );
}
