import { Link, useParams } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../api/client";

type Project={id:string;name:string;slug:string};
type Environment={id:string;name:string;slug:string;kind:string;status:string};
type Integration={id:string;project_id:string;environment_id?:string|null;mode:string;status:string;verification_status:string;endpoint?:string|null;};

function ErrorMessage({message}:{message:string}){return message ? <p role="alert" className="customer-error">{message}</p> : null;}

export function ProjectsPage(){
 const [projects,setProjects]=useState<Project[]>([]); const [name,setName]=useState(""); const [error,setError]=useState(""); const [loading,setLoading]=useState(true); const [creating,setCreating]=useState(false);
 useEffect(()=>{api.get<Project[]>("/api/v1/projects").then(setProjects).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
 async function create(){setError("");setCreating(true);try{const p=await api.post<Project>("/api/v1/projects",{name:name.trim()});setProjects(v=>[...v,p]);setName("");}catch(e){setError(e instanceof Error?e.message:"Unable to create project.");}finally{setCreating(false);}}
 return <section className="resource-page">
  <div className="page-heading"><div><span className="eyebrow">CUSTOMER LIFECYCLE</span><h1>Projects</h1><p>A project is the explicit boundary for a customer application, its environments, integrations and tenant inventory.</p></div><Link className="agata-button agata-button-secondary" to="/app/docs/overview">Lifecycle documentation</Link></div>
  <div className="surface"><h2>Create a project</h2><p>Creating a project also creates its canonical Production environment.</p><div className="customer-form"><input aria-label="Project name" value={name} onChange={e=>setName(e.target.value)} placeholder="Project name"/><button onClick={create} disabled={!name.trim()||creating}>{creating?"Creating…":"Create project"}</button></div><ErrorMessage message={error}/></div>
  <div className="surface"><h2>Your projects</h2>{loading?<p>Loading projects…</p>:projects.length===0?<p>No projects exist in this organization yet. Create the first project above.</p>:<ul>{projects.map(p=><li key={p.id}><Link to={`/app/projects/${p.id}`} onClick={() => localStorage.setItem("agata.active.project", p.id)}>{p.name}</Link><span> · {p.slug}</span></li>)}</ul>}</div>
 </section>;
}

export function ProjectDetailPage(){
 const {projectId}=useParams(); const id=projectId ?? ""; const [envs,setEnvs]=useState<Environment[]>([]); const [name,setName]=useState(""); const [kind,setKind]=useState("development"); const [error,setError]=useState(""); const [loading,setLoading]=useState(true); const [creating,setCreating]=useState(false);
 useEffect(()=>{if(!id)return;api.get<Environment[]>(`/api/v1/projects/${id}/environments`).then(setEnvs).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[id]);
 async function create(){setError("");setCreating(true);try{const e=await api.post<Environment>(`/api/v1/projects/${id}/environments`,{project_id:id,name:name.trim(),kind});setEnvs(v=>[...v,e]);setName("");}catch(e){setError(e instanceof Error?e.message:"Unable to create environment.");}finally{setCreating(false);}}
 return <section className="resource-page">
  <div className="page-heading"><div><span className="eyebrow">PROJECT</span><h1>Project workspace</h1><p>Environments make development, staging and production promotion explicit instead of mixing lifecycle state.</p></div><Link className="agata-button agata-button-secondary" to="/app/docs/overview" onClick={() => localStorage.setItem("agata.active.project", id)}>Read lifecycle documentation</Link></div>
  <div className="surface"><h2>Environment inventory</h2>{loading?<p>Loading environments…</p>:envs.length===0?<p>No environments are currently returned.</p>:envs.map(e=><div className="customer-row" key={e.id}><strong>{e.name}</strong><span>{e.kind}</span><span>{e.status}</span></div>)}<div className="customer-form"><input aria-label="Environment name" value={name} onChange={e=>setName(e.target.value)} placeholder="Environment name"/><select aria-label="Environment kind" value={kind} onChange={e=>setKind(e.target.value)}><option value="development">Development</option><option value="staging">Staging</option><option value="production">Production</option></select><button onClick={create} disabled={!name.trim()||creating}>{creating?"Creating…":"Add environment"}</button></div><ErrorMessage message={error}/></div>
  <div className="surface"><h2>Next: integration</h2><p>Register the integration mode for this project and environment. Registration intentionally starts in <strong>pending</strong> until the external system is actually configured and verified.</p><Link className="public-inline-link" to="/app/integrations">Continue to integration</Link></div>
 </section>;
}

export function EnvironmentDetailPage(){
 const {projectId,environmentId}=useParams(); const [environment,setEnvironment]=useState<Environment|null>(null); const [error,setError]=useState(""); const [loading,setLoading]=useState(true);
 useEffect(()=>{if(!projectId||!environmentId)return;api.get<Environment[]>(`/api/v1/projects/${projectId}/environments`).then(items=>setEnvironment(items.find(item=>item.id===environmentId)??null)).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[projectId,environmentId]);
 return <section className="resource-page">
  <div className="page-heading"><div><span className="eyebrow">ENVIRONMENT</span><h1>{environment?.name ?? "Environment"}</h1><p>This environment is a first-class project lifecycle boundary. Runtime state is only considered authoritative when returned by the backend and verified against the deployed system.</p></div><Link className="agata-button agata-button-secondary" to={`/app/projects/${projectId}`}>Project environments</Link></div>
  <div className="surface">{loading?<p>Loading environment…</p>:error?<p role="alert">{error}</p>:!environment?<p>No environment with this identifier was returned by the active project.</p>:<><div className="customer-row"><strong>{environment.name}</strong><span>{environment.kind}</span><span>{environment.status}</span></div><h2>Lifecycle role</h2><p>{environment.kind==="production"?"Production is the canonical live environment and must be the final promotion target after external verification.":environment.kind==="staging"?"Staging is the pre-production verification boundary for integration and release checks.":"Development is the safe place to establish configuration and prove the integration contract before staging."}</p><Link className="public-inline-link" to="/app/integrations">Manage integrations <ArrowUpRight size={15}/></Link></>}</div>
  <div className="surface"><h2>Environment documentation</h2><p>Promotion should follow development → staging → canary → production. Environment registration alone does not prove that a deployed application is secure or healthy.</p><Link className="public-inline-link" to="/app/docs/overview">Read the full lifecycle documentation <ArrowUpRight size={15}/></Link></div>
 </section>;
}

export function IntegrationsPage(){
 const [items,setItems]=useState<Integration[]>([]); const [projects,setProjects]=useState<Project[]>([]); const [envs,setEnvs]=useState<Environment[]>([]); const [project,setProject]=useState(""); const [environment,setEnvironment]=useState(""); const [mode,setMode]=useState("engine"); const [endpoint,setEndpoint]=useState(""); const [error,setError]=useState(""); const [loading,setLoading]=useState(true); const [creating,setCreating]=useState(false);
 useEffect(()=>{Promise.all([api.get<Integration[]>("/api/v1/integrations"),api.get<Project[]>("/api/v1/projects")]).then(([i,p])=>{setItems(i);setProjects(p);}).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
 useEffect(()=>{if(!project)return;api.get<Environment[]>(`/api/v1/projects/${project}/environments`).then(v=>{setEnvs(v);setEnvironment(v[0]?.id ?? "");}).catch(e=>setError(e.message));},[project]);
 async function create(){setError("");setCreating(true);try{const x=await api.post<Integration>("/api/v1/integrations",{project_id:project,environment_id:environment||undefined,mode,endpoint:endpoint.trim()||undefined});setItems(v=>[x,...v]);setEndpoint("");}catch(e){setError(e instanceof Error?e.message:"Unable to register integration.");}finally{setCreating(false);}}
 return <section className="resource-page">
  <div className="page-heading"><div><span className="eyebrow">INTEGRATION</span><h1>Customer integration</h1><p>Connect an existing SaaS to Agata Proxima without replacing its application, authentication, or business authorization model.</p></div><Link className="agata-button agata-button-secondary" to="/app/developer/quickstart">Open developer quickstart</Link></div>
  <div className="surface"><h2>Integration contract</h2><p className="integration-contract">Customer application → Agata integration → Proxima Engine → PostgreSQL.</p><ol><li>Create the project boundary.</li><li>Create development, staging and production environments.</li><li>Select Engine, SDK or Proxy mode.</li><li>Configure the actual protected database endpoint.</li><li>Execute tenant A/B/C verification and negative cross-tenant tests.</li><li>Promote only after evidence and external SaaS acceptance pass.</li></ol><Link className="public-inline-link" to="/docs/customer-integration">Read the complete customer integration guide</Link></div>
  <div className="surface"><h2>Register an integration</h2><div className="customer-form"><select aria-label="Project" value={project} onChange={e=>setProject(e.target.value)}><option value="">Select project</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><select aria-label="Environment" value={environment} onChange={e=>setEnvironment(e.target.value)} disabled={!project}><option value="">Select environment</option>{envs.map(e=><option key={e.id} value={e.id}>{e.name} · {e.kind}</option>)}</select><select aria-label="Integration mode" value={mode} onChange={e=>setMode(e.target.value)}><option value="engine">Engine</option><option value="sdk">SDK</option><option value="proxy">Proxy</option></select><input aria-label="Integration endpoint" value={endpoint} onChange={e=>setEndpoint(e.target.value)} placeholder="Optional endpoint"/><button onClick={create} disabled={!project||creating}>{creating?"Registering…":"Register integration"}</button></div><ErrorMessage message={error}/></div>
  <div className="surface"><h2>Registered integrations</h2>{loading?<p>Loading integrations…</p>:items.length===0?<p>No integration has been registered for this organization.</p>:items.map(x=><div className="customer-row" key={x.id}><strong>{x.mode}</strong><span>{x.status}</span><span>verification: {x.verification_status}</span><span>{x.environment_id?"environment linked":"environment not linked"}</span></div>)}</div>
 </section>;
}

export function DeveloperQuickstartPage(){
 return <section className="resource-page">
  <div className="page-heading"><div><span className="eyebrow">DEVELOPER</span><h1>Integration quickstart</h1><p>A production-oriented path from an existing multi-tenant SaaS to a verified Proxima enforcement boundary.</p></div><Link className="agata-button agata-button-secondary" to="/app/docs/developer">Developer documentation</Link></div>
  <div className="surface"><h2>1. Preserve the application</h2><p>Keep your existing frontend, backend, authentication, tenant identity and business authorization. Proxima does not replace those responsibilities.</p></div>
  <div className="surface"><h2>2. Establish the protected path</h2><p>Route the database connection through the selected Engine, SDK or Proxy integration mode. Carry signed tenant context to the database boundary and keep secrets outside source control.</p></div>
  <div className="surface"><h2>3. Verify behavior</h2><ol><li>Run valid tenant-local reads and writes.</li><li>Attempt cross-tenant reads and writes.</li><li>Test missing, malformed, expired and tampered context.</li><li>Exercise transactions, prepared statements and connection reuse.</li><li>Rotate or expire credentials.</li><li>Restart the Engine.</li><li>Disable the Control Plane and repeat runtime security tests.</li><li>Compare application results with verification and audit evidence.</li></ol></div>
  <div className="surface"><h2>4. Promote deliberately</h2><p>Development → staging → canary → production. A Control Plane record saying an integration is registered is not the same as external SaaS acceptance.</p><Link className="public-inline-link" to="/docs/external-saas-v2">Read the external SaaS acceptance procedure</Link></div>
 </section>;
}
