import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../../api/client";

type Project={id:string;name:string;slug:string};
type Environment={id:string;name:string;slug:string;kind:string;status:string};
type Integration={id:string;project_id:string;environment_id?:string|null;mode:string;status:string;verification_status:string;endpoint?:string|null};

export function ProjectsPage(){
 const [projects,setProjects]=useState<Project[]>([]); const [name,setName]=useState(""); const [error,setError]=useState("");
 useEffect(()=>{api.get<Project[]>("/api/v1/projects").then(setProjects).catch(e=>setError(e.message));},[]);
 async function create(){setError("");try{const p=await api.post<Project>("/api/v1/projects",{name});setProjects(v=>[...v,p]);setName("");}catch(e){setError(e instanceof Error?e.message:"Unable to create project.");}}
 return <section className="resource-page"><div className="page-heading"><div><span className="eyebrow">PROJECTS</span><h1>Projects</h1><p>Define the customer application boundary before configuring environments and Proxima integration.</p></div></div><div className="surface"><h2>Create a project</h2><div className="resource-links"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Project name"/><button onClick={create} disabled={!name.trim()}>Create project</button></div>{error&&<p role="alert">{error}</p>}</div><div className="surface"><h2>Your projects</h2>{projects.length===0?<p>No projects yet.</p>:<ul>{projects.map(p=><li key={p.id}><Link to={`/app/projects/${p.id}`}>{p.name}</Link><span> {p.slug}</span></li>)}</ul>}</div></section>
}

export function ProjectDetailPage(){
 const {pathname}=useLocation(); const id=pathname.split("/").pop()!; const [envs,setEnvs]=useState<Environment[]>([]); const [name,setName]=useState(""); const [error,setError]=useState("");
 useEffect(()=>{api.get<Environment[]>(`/api/v1/projects/${id}/environments`).then(setEnvs).catch(e=>setError(e.message));},[id]);
 async function create(){try{const e=await api.post<Environment>(`/api/v1/projects/${id}/environments`,{project_id:id,name,kind:"development"});setEnvs(v=>[...v,e]);setName("");}catch(e){setError(e instanceof Error?e.message:"Unable to create environment.");}}
 return <section className="resource-page"><div className="page-heading"><div><span className="eyebrow">PROJECT</span><h1>Project workspace</h1><p>Manage isolated development, staging, and production environments for this project.</p></div></div><div className="surface"><h2>Environments</h2>{envs.map(e=><div className="resource-identity" key={e.id}><strong>{e.name}</strong><span>{e.kind}</span><span>{e.status}</span></div>)}<div className="resource-links"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Environment name"/><button onClick={create} disabled={!name.trim()}>Add development environment</button></div>{error&&<p role="alert">{error}</p>}</div><Link to="/app/integrations">Continue to integration</Link></section>
}

export function IntegrationsPage(){
 const [items,setItems]=useState<Integration[]>([]); const [project,setProject]=useState(""); const [mode,setMode]=useState("engine"); const [error,setError]=useState("");
 useEffect(()=>{api.get<Integration[]>("/api/v1/integrations").then(setItems).catch(e=>setError(e.message));},[]);
 async function create(){try{const x=await api.post<Integration>("/api/v1/integrations",{project_id:project,mode});setItems(v=>[x,...v]);}catch(e){setError(e instanceof Error?e.message:"Unable to create integration.");}}
 return <section className="resource-page"><div className="page-heading"><div><span className="eyebrow">INTEGRATION</span><h1>Customer integration</h1><p>Connect an existing SaaS to Agata Proxima without replacing its application, authentication, or business logic.</p></div></div><div className="surface"><h2>Integration contract</h2><p>Customer application → Agata integration → Proxima Engine → PostgreSQL.</p><ol><li>Create the project.</li><li>Create development and staging environments.</li><li>Select Engine, SDK, or Proxy mode.</li><li>Configure the integration endpoint in your deployment.</li><li>Run tenant A/B/C verification before production promotion.</li></ol></div><div className="surface"><h2>Register an integration</h2><div className="resource-links"><input value={project} onChange={e=>setProject(e.target.value)} placeholder="Project UUID"/><select value={mode} onChange={e=>setMode(e.target.value)}><option value="engine">Engine</option><option value="sdk">SDK</option><option value="proxy">Proxy</option></select><button onClick={create} disabled={!project}>Register</button></div>{error&&<p role="alert">{error}</p>}</div><div className="surface"><h2>Integrations</h2>{items.length===0?<p>No integration registered.</p>:items.map(x=><div className="resource-identity" key={x.id}><strong>{x.mode}</strong><span>{x.status}</span><span>verification: {x.verification_status}</span></div>)}</div></section>
}

export function DeveloperQuickstartPage(){
 return <section className="resource-page"><div className="page-heading"><div><span className="eyebrow">DEVELOPER</span><h1>Integration quickstart</h1><p>A production-oriented path from an existing multi-tenant SaaS to verified Proxima enforcement.</p></div></div><div className="surface"><h2>Before you start</h2><p>Keep your existing frontend, backend, authentication, tenant identity, and business authorization. Proxima becomes the protected database boundary.</p></div><div className="surface"><h2>Implementation sequence</h2><ol><li>Register project and environments.</li><li>Choose the Engine, SDK, or Proxy integration mode.</li><li>Configure the database endpoint and tenant context.</li><li>Run positive tenant requests.</li><li>Run cross-tenant read/write attacks.</li><li>Run transactions, prepared statements, and connection-reuse tests.</li><li>Compare verification evidence and audit events.</li><li>Canary staging before production promotion.</li></ol></div><div className="surface"><h2>Authority boundary</h2><p>The Control Plane manages desired state and evidence. Proxima remains the runtime tenant-isolation authority. A Control Plane outage must not disable an already-running enforcement boundary.</p></div></section>
}
