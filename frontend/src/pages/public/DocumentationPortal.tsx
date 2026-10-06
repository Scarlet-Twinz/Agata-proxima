import { Link, useParams } from "react-router-dom";
import "./documentation-portal.css";

type DocPage={title:string;intro:string;sections:Array<{title:string;text:string;code?:string}>};
const docs:Record<string,DocPage>={
  "getting-started":{title:"Get started with Proxima",intro:"Move from tenant modeling to an observable verification result.",sections:[
    {title:"1. Define the boundary",text:"Choose the tenant identity your application must protect and list every path that can read or mutate tenant data."},
    {title:"2. Authenticate",text:"The current control plane uses a server-managed session and CSRF protection for state-changing requests.",code:"POST /api/v1/auth/login\nContent-Type: application/json\n\n{\n  \"email\": \"you@example.com\",\n  \"password\": \"YOUR_PASSWORD\"\n}"},
    {title:"3. Create the tenant model",text:"Use the organization and tenant APIs to make the scope explicit before protected operations depend on it.",code:"POST /api/v1/tenants\n\n{\n  \"organization_id\": \"ORG_UUID\",\n  \"name\": \"Acme\",\n  \"slug\": \"acme\",\n  \"isolation_mode\": \"rls\"\n}"},
    {title:"4. Verify negative paths",text:"A useful integration deliberately tests cross-tenant requests and invalid or expired context, not only successful access."},
    {title:"5. Retain evidence",text:"Verification results and audit events are part of the operational story. A passing integration should be explainable after the fact."},
  ]},
  "core-concepts":{title:"Core concepts",intro:"The vocabulary that connects identity, tenant scope, enforcement, verification and evidence.",sections:[
    {title:"Organization",text:"The control-plane customer boundary for users, resources, billing context and operational configuration."},
    {title:"Tenant",text:"The data-isolation boundary inside an application. A tenant's protected data must not be reachable through another tenant's scope."},
    {title:"Tenant context",text:"The requested tenant scope carried through the request path so enforcement can compare intended and protected scope."},
    {title:"Policy",text:"The explicit decision model used to determine what operations are permitted."},
    {title:"Verification",text:"A deliberate test of the isolation property, including adversarial cases."},
    {title:"Evidence",text:"The inspectable record of what was tested, what decision occurred and when it happened."},
  ]},
  "api-reference":{title:"API reference",intro:"The machine-readable contract lives in control-plane/openapi.json. The developer portal provides the human-readable route guide.",sections:[
    {title:"Authentication",text:"POST /api/v1/auth/signup, POST /api/v1/auth/login, POST /api/v1/auth/logout and GET /api/v1/session."},
    {title:"Resources",text:"Organizations, tenants, policies, nodes, deployments and verifications expose GET/POST control-plane operations where supported."},
    {title:"Verification",text:"POST /api/v1/verifications records a verification result with organization, optional tenant, kind, status and evidence."},
    {title:"Public intake",text:"POST /api/v1/public/contact and POST /api/v1/public/support accept public requests without an authenticated session."},
  ]},
  security:{title:"Security",intro:"Understand the controls and the failure modes the platform is designed to make visible.",sections:[
    {title:"Identity is not isolation",text:"Authentication establishes who is calling. It does not prove that the caller can access every tenant they can name."},
    {title:"Fail closed",text:"Expired, malformed or invalid tenant context should produce a block rather than silently falling back to an unscoped request."},
    {title:"Defense in depth",text:"Application enforcement and PostgreSQL controls should reinforce one another so a missed application convention does not become the only protection."},
    {title:"Verification as evidence",text:"Security claims become stronger when the dangerous paths can be exercised and their expected block decisions retained as evidence."},
  ]},
  operations:{title:"Operations",intro:"Operate Proxima as infrastructure with explicit environments, deployments, nodes and verification checks.",sections:[
    {title:"Environments",text:"Keep development, staging and production configuration distinguishable. Never reuse production credentials in local development."},
    {title:"Deployments",text:"After infrastructure changes, run verification against the relevant tenant-isolation contract before treating the deployment as healthy."},
    {title:"Nodes",text:"Track execution components participating in enforcement and verification so operational state is attributable."},
    {title:"Incidents",text:"Capture verification results, relevant audit events, environment details and reproduction steps before changing state."},
  ]},
  troubleshooting:{title:"Troubleshooting",intro:"A systematic path for diagnosing isolation and control-plane failures.",sections:[
    {title:"Cross-tenant request blocked",text:"First determine whether the block is the expected security result. Compare the requested tenant with the protected resource before changing policy or enforcement."},
    {title:"Expired context",text:"Regenerate context using the supported authentication flow. Do not bypass the boundary to make an expired request succeed."},
    {title:"Verification failure",text:"Start with the failing scenario, inspect context and policy inputs, then examine the evidence record to locate where the expected decision diverged."},
    {title:"Database enforcement failure",text:"Inspect PostgreSQL policy configuration and the tenant value reaching the database. Do not disable database enforcement as a troubleshooting shortcut."},
  ]},
};

const nav=[["getting-started","Getting Started"],["core-concepts","Core Concepts"],["api-reference","API Reference"],["security","Security"],["operations","Operations"],["troubleshooting","Troubleshooting"]] as const;

export default function DocumentationPortal(){
 const {kind}=useParams();
 const key=kind===undefined?"getting-started":kind;
 if (!docs[key]) {
  return <main className="documentation-portal"><header className="documentation-hero"><div className="documentation-hero-inner"><span className="public-eyebrow">DOCUMENTATION / 404</span><h1>Documentation page not found.</h1><p>The requested documentation resource does not exist. Choose a published guide instead.</p><Link className="button button-primary" to="/docs">Back to Documentation</Link></div></header></main>;
 }
 const page=docs[key];
 return <main className="documentation-portal">
  <header className="documentation-hero"><div className="documentation-hero-inner">
   <span className="public-eyebrow">DOCUMENTATION</span><h1>{page.title}</h1><p>{page.intro}</p>
   <div className="documentation-actions"><Link className="button button-primary" to="/developers/quickstart">Developer Quickstart</Link><Link className="button button-secondary" to="/support">Support Center</Link></div>
  </div></header>
  <div className="documentation-shell public-container">
   <aside className="documentation-sidebar"><span>DOCUMENTATION</span>{nav.map(([path,label])=><Link className={key===path?"active":""} key={path} to={"/docs/"+path}>{label}</Link>)}<div className="documentation-divider"/><Link to="/developers">Developer Platform</Link><Link to="/changelog">Changelog</Link></aside>
   <article className="documentation-content">
    {page.sections.map((section,i)=><section key={section.title}><div className="documentation-number">{String(i+1).padStart(2,"0")}</div><div><h2>{section.title}</h2><p>{section.text}</p>{section.code&&<pre><code>{section.code}</code></pre>}</div></section>)}
    <div className="documentation-footer">
    <Link to="/docs">Documentation home</Link>
    <Link to="/contact">Contact</Link>
    <a href="/docs/openapi.json" target="_blank" rel="noreferrer">OpenAPI JSON</a>
    <a href="https://github.com/Scarlet-Twinz/Agata-proxima" target="_blank" rel="noreferrer">GitHub source</a>
   </div>
   </article>
  </div>
 </main>;
}
