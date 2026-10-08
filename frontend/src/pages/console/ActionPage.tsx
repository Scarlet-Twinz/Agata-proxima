import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Copy, ShieldCheck } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, type ApiError } from "../../api/client";

type Session = { organization_id: string; csrf_token: string; role: string };
type Option = { id:string; name:string };

const configs:Record<string,{eyebrow:string;title:string;description:string;kind:string}> = {
 "/app/tenants/new":{eyebrow:"TENANTS",title:"Create tenant",description:"Create a customer boundary inside the active organization.",kind:"tenant"},
 "/app/policies/new":{eyebrow:"POLICIES",title:"Create policy",description:"Create a versioned policy document that can move through deployment and verification.",kind:"policy"},
 "/app/nodes/new":{eyebrow:"INFRASTRUCTURE",title:"Register node",description:"Register a Proxima enforcement node and its operating environment.",kind:"node"},
 "/app/deployments/new":{eyebrow:"DEPLOYMENTS",title:"Create deployment",description:"Declare the desired state and version for an enrolled node.",kind:"deployment"},
 "/app/verification/new":{eyebrow:"VERIFICATION",title:"Run verification",description:"Record a verification run and its evidence against the isolation boundary.",kind:"verification"},
 "/app/support/new":{eyebrow:"SUPPORT",title:"Open support request",description:"Give the support team a complete operational context for the issue.",kind:"support"},
 "/app/developer/api-keys/new":{eyebrow:"DEVELOPER",title:"Create API key",description:"Create an organization-scoped machine credential. The full secret is shown once.",kind:"api-key"},
 "/app/developer/webhooks/new":{eyebrow:"DEVELOPER",title:"Add webhook",description:"Create a signed event endpoint and choose which Agata events it receives.",kind:"webhook"},
};

export function ActionPage(){
 const {pathname}=useLocation(); const navigate=useNavigate(); const config=configs[pathname]??configs["/app/tenants/new"];
 const [session,setSession]=useState<Session|null>(null); const [options,setOptions]=useState<Option[]>([]); const [form,setForm]=useState<Record<string,string>>({}); const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [result,setResult]=useState<Record<string,unknown>|null>(null); const [secretHidden,setSecretHidden]=useState(false); const [copied,setCopied]=useState(false);
 useEffect(()=>{let active=true;(async()=>{try{const s=await api.get<Session>("/api/v1/session");if(active)setSession(s);if(config.kind==="deployment"){const n=await api.get<Option[]>("/api/v1/nodes");if(active)setOptions(n)}if(config.kind==="verification"){const t=await api.get<Array<Option&{slug?:string}>>("/api/v1/tenants");if(active)setOptions(t)}}catch(e){if(active)setError((e as ApiError)?.message??"Unable to load the workspace session.")}})();return()=>{active=false}},[config.kind]);
 function set(key:string,value:string){setForm(v=>({...v,[key]:value}))}
 async function submit(e:FormEvent){e.preventDefault();if(!session)return;setBusy(true);setError("");
  try{
   let path="/api/v1/tenants",body:Record<string,unknown>={organization_id:session.organization_id};
   if(config.kind==="tenant"){path="/api/v1/tenants";body={...body,name:form.name,slug:form.slug||form.name?.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""),isolation_mode:form.isolation_mode||"enforced-proxy"}}
   if(config.kind==="policy"){path="/api/v1/policies";let document:unknown;try{document=JSON.parse(form.document||"{}")}catch{throw new Error("Policy document must be valid JSON. Check for an extra comma, quote, or character after the closing brace.")}body={...body,name:form.name,version:Number(form.version||1),document}}
   if(config.kind==="node"){path="/api/v1/nodes";body={...body,name:form.name,environment:form.environment||"production",region:form.region||"auto"}}
   if(config.kind==="deployment"){path="/api/v1/deployments";body={...body,node_id:form.node_id,version:form.version,desired_state:form.desired_state||"running"}}
   if(config.kind==="verification"){path="/api/v1/verifications";let evidence:unknown;try{evidence=JSON.parse(form.evidence||'{"checks":[]}')}catch{throw new Error("Verification evidence must be valid JSON. Keep one JSON object only, for example {"checks":[]}." )}body={...body,tenant_id:form.tenant_id||null,kind:form.kind||"tenant-isolation",status:form.status||"pass",evidence}}
   if(config.kind==="support"){path="/api/v1/support";body={...body,subject:form.subject,message:form.message,priority:form.priority||"normal"}}
   if(config.kind==="api-key"){path="/api/v1/developer/api-keys";body={name:form.name}}
   if(config.kind==="webhook"){path="/api/v1/developer/webhooks";body={name:form.name,endpoint_url:form.endpoint_url,events:(form.events||"verification.completed").split(",").map(v=>v.trim()).filter(Boolean)}}
   const data=await api.post<Record<string,unknown>>(path,body);setResult(data);setSecretHidden(false);setCopied(false);
  }catch(e){setError((e as ApiError)?.message??(e instanceof Error?e.message:"The operation failed."))}finally{setBusy(false)}
 }
 const secret=typeof result?.key==="string"?result.key:typeof result?.signing_secret==="string"?result.signing_secret:"";
 const secretLabel=config.kind==="api-key"?"API key":config.kind==="webhook"?"Webhook signing secret":"Secret";
 async function copySecret(){if(!secret)return;try{await navigator.clipboard.writeText(secret);setCopied(true);window.setTimeout(()=>setCopied(false),1800)}catch{setError("Clipboard access was blocked. Copy the secret manually before hiding it.")}}
 if(result) return <div className="resource-page"><Link className="back-link" to="/app"><ArrowLeft size={16}/> Command Center</Link><div className="page-heading"><div><span className="eyebrow">{config.eyebrow}</span><h1>{config.kind==="api-key"?"API key created":config.kind==="webhook"?"Webhook created":"Operation completed"}</h1><p>The control plane accepted the request and returned the created resource.</p></div></div><section className="surface success-panel"><CheckCircle2 size={28}/><h2>Created successfully.</h2><p>{String(result.message??"The resource is now available in the workspace.")}</p>{secret&&<div className="secret-reveal"><span>{secretLabel} — shown once</span><strong>Copy this secret now. Agata stores only its hash and prefix after creation.</strong>{!secretHidden&&<code>{secret}</code>}{!secretHidden&&<button onClick={()=>void copySecret()}><Copy size={15}/>{copied?"Copied":"Copy"}</button>}{secretHidden&&<code>{String(result?.key_prefix??result?.signing_secret_hint??"Secret hidden after confirmation")}</code>}<div className="secret-reveal-actions">{!secretHidden?<button className="secret-dismiss" onClick={()=>setSecretHidden(true)}>I copied it — hide secret</button>:<span>Full secret hidden. Rotate/recreate the credential if it was not saved.</span>}</div></div>}<div className="context-next"><button className="primary-action" onClick={()=>navigate(config.kind==="api-key"?"/app/developer/api-keys":config.kind==="webhook"?"/app/developer/webhooks":pathname.replace("/new",""))}>Open resource</button><button className="secondary-action" onClick={()=>setResult(null)}>Create another</button></div></section></div>;
 const field=(label:string,key:string,placeholder:string,opts?:{type?:string})=><label className="action-field"><span>{label}</span><input type={opts?.type??"text"} value={form[key]??""} onChange={e=>set(key,e.target.value)} placeholder={placeholder} required /></label>;
 return <div className="resource-page"><Link className="back-link" to="/app"><ArrowLeft size={16}/> Command Center</Link><div className="page-heading"><div><span className="eyebrow">{config.eyebrow}</span><h1>{config.title}</h1><p>{config.description}</p></div></div><section className="surface action-card">{error&&<div className="console-inline-error">{error}</div>}<form onSubmit={submit} className="action-form">
 {["tenant","policy","node","api-key","webhook"].includes(config.kind)&&field("Name","name","Production tenant")}
 {config.kind==="tenant"&&field("Slug","slug","production-customer")}
 {config.kind==="tenant"&&field("Isolation mode","isolation_mode","enforced-proxy")}
 {config.kind==="policy"&&field("Version","version","1",{type:"number"})}
 {config.kind==="policy"&&<label className="action-field"><span>Policy document (JSON)</span><textarea value={form.document??'{"rules":[]}'} onChange={e=>set("document",e.target.value)} rows={12} required/></label>}
 {config.kind==="node"&&field("Environment","environment","production")}
 {config.kind==="node"&&field("Region","region","auto")}
 {config.kind==="deployment"&&<label className="action-field"><span>Node</span><select value={form.node_id??""} onChange={e=>set("node_id",e.target.value)} required><option value="">Select a node</option>{options.map(o=><option value={o.id} key={o.id}>{o.name}</option>)}</select></label>}
 {config.kind==="deployment"&&field("Version","version","1.0.0")}
 {config.kind==="deployment"&&<label className="action-field"><span>Desired state</span><select value={form.desired_state??"running"} onChange={e=>set("desired_state",e.target.value)}><option>running</option><option>stopped</option><option>draining</option></select></label>}
 {config.kind==="verification"&&<><label className="action-field"><span>Tenant</span><select value={form.tenant_id??""} onChange={e=>set("tenant_id",e.target.value)}><option value="">Organization-wide</option>{options.map(o=><option value={o.id} key={o.id}>{o.name}</option>)}</select></label>{field("Verification kind","kind","tenant-isolation")}<label className="action-field"><span>Status</span><select value={form.status??"pass"} onChange={e=>set("status",e.target.value)}><option>pass</option><option>fail</option><option>review</option><option>running</option></select></label><label className="action-field"><span>Evidence (JSON)</span><textarea value={form.evidence??'{"checks":[]}'} onChange={e=>set("evidence",e.target.value)} rows={10} required/></label></>}
 {config.kind==="support"&&<>{field("Subject","subject","Describe the issue")}<label className="action-field"><span>Priority</span><select value={form.priority??"normal"} onChange={e=>set("priority",e.target.value)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label className="action-field"><span>Message</span><textarea value={form.message??""} onChange={e=>set("message",e.target.value)} rows={10} required/></label></>}
 {config.kind==="webhook"&&<>{field("Endpoint URL","endpoint_url","https://example.com/agata/webhook")}<label className="action-field"><span>Events</span><input value={form.events??"verification.completed,security.event"} onChange={e=>set("events",e.target.value)} placeholder="Comma-separated event types" required/></label><div className="action-note"><ShieldCheck size={16}/> Webhook signing secrets are generated by the control plane and shown only once.</div></>}
 <div className="action-actions"><button className="primary-action" disabled={busy} type="submit">{busy?"Creating…":"Create "+config.title.replace("Create ","").replace("Add ","").replace("Register ","")}</button><Link className="secondary-action" to={pathname.replace("/new","")}>Cancel</Link></div>
 </form></section></div>;
}
