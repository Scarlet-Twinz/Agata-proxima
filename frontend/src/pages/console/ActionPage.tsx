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
 "/app/verification/new":{eyebrow:"VERIFICATION",title:"Record verification result",description:"Record the outcome of a test already run against the protected application-to-database path. This form stores evidence; it does not execute the test.",kind:"verification"},
 "/app/support/new":{eyebrow:"SUPPORT",title:"Open support request",description:"Give the support team a complete operational context for the issue.",kind:"support"},
 "/app/developer/api-keys/new":{eyebrow:"DEVELOPER",title:"Create API key",description:"Create an organization-scoped machine credential. The full secret is shown once.",kind:"api-key"},
 "/app/developer/webhooks/new":{eyebrow:"DEVELOPER",title:"Add webhook",description:"Create a signed event endpoint and choose which Agata events it receives.",kind:"webhook"},
};

export function ActionPage(){
 const {pathname}=useLocation(); const navigate=useNavigate(); const config=configs[pathname]??configs["/app/tenants/new"];
 const [session,setSession]=useState<Session|null>(null); const [options,setOptions]=useState<Option[]>([]); const [form,setForm]=useState<Record<string,string>>({}); const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [result,setResult]=useState<Record<string,unknown>|null>(null);
 const [secretCopied,setSecretCopied]=useState(false); const [secretConfirmed,setSecretConfirmed]=useState(false); const [copyError,setCopyError]=useState("");
 useEffect(()=>{let active=true;(async()=>{try{const s=await api.get<Session>("/api/v1/session");if(active)setSession(s);if(config.kind==="deployment"){const n=await api.get<Option[]>("/api/v1/nodes");if(active)setOptions(n)}if(config.kind==="verification"){const t=await api.get<Array<Option&{slug?:string}>>("/api/v1/tenants");if(active)setOptions(t)}}catch(e){if(active)setError((e as ApiError)?.message??"Unable to load the workspace session.")}})();return()=>{active=false}},[config.kind]);
 function set(key:string,value:string){setForm(v=>({...v,[key]:value}))}
 async function submit(e:FormEvent){e.preventDefault();if(!session)return;setBusy(true);setError("");
  try{
   let path="/api/v1/tenants",body:Record<string,unknown>={organization_id:session.organization_id};
   if(config.kind==="tenant"){path="/api/v1/tenants";body={...body,name:form.name,slug:form.slug||form.name?.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""),isolation_mode:form.isolation_mode||"enforced-proxy"}}
   if(config.kind==="policy"){path="/api/v1/policies";body={...body,name:form.name,version:Number(form.version||1),document:JSON.parse(form.document||"{}")}}
   if(config.kind==="node"){path="/api/v1/nodes";body={...body,name:form.name,environment:form.environment||"production",region:form.region||"auto"}}
   if(config.kind==="deployment"){path="/api/v1/deployments";body={...body,node_id:form.node_id,version:form.version,desired_state:form.desired_state||"running"}}
   if(config.kind==="verification"){
    const evidenceValue: unknown = JSON.parse(form.evidence || "{}");
    if(!evidenceValue || typeof evidenceValue!=="object" || Array.isArray(evidenceValue) || Object.keys(evidenceValue).length===0){
     throw new Error("Add the actual test details to the evidence JSON before recording a result.");
    }
    const evidence=evidenceValue as Record<string,unknown>;
    if(Array.isArray(evidence.checks) && evidence.checks.length===0){
     throw new Error("Add at least one completed check to the evidence JSON.");
    }
    path="/api/v1/verifications";
    body={...body,tenant_id:form.tenant_id||null,kind:form.kind||"tenant-isolation",status:form.status||"review",evidence};
   }
   if(config.kind==="support"){path="/api/v1/support";body={...body,subject:form.subject,message:form.message,priority:form.priority||"normal"}}
   if(config.kind==="api-key"){path="/api/v1/developer/api-keys";body={name:form.name}}
   if(config.kind==="webhook"){path="/api/v1/developer/webhooks";body={name:form.name,endpoint_url:form.endpoint_url,events:(form.events||"verification.completed").split(",").map(v=>v.trim()).filter(Boolean)}}
   const data=await api.post<Record<string,unknown>>(path,body);
   if(config.kind==="api-key"&&(typeof data.key!=="string"||!data.key.trim())){
    throw new Error("The API key endpoint did not return its one-time secret. Do not create another key yet; check the API-key list and Control Plane response first.");
   }
   setResult(data);
  }catch(e){setError((e as ApiError)?.message??(e instanceof Error?e.message:"The operation failed."))}finally{setBusy(false)}
 }
 const secret=typeof result?.key==="string"?result.key:typeof result?.signing_secret==="string"?result.signing_secret:typeof result?.enrollment_token==="string"?result.enrollment_token:""; const secretLabel=config.kind==="api-key"?"API key":config.kind==="webhook"?"Webhook signing secret":config.kind==="node"?"Node enrollment token":"Secret";
 function fallbackCopySecret(value:string){
  const field=document.createElement("textarea");
  field.value=value;
  field.setAttribute("readonly","");
  field.style.position="fixed";
  field.style.opacity="0";
  field.style.pointerEvents="none";
  document.body.appendChild(field);
  field.focus();
  field.select();
  field.setSelectionRange(0,field.value.length);
  let copied=false;
  try{copied=document.execCommand("copy");}finally{document.body.removeChild(field);}
  if(!copied) throw new Error("The browser did not allow copying to the clipboard.");
 }
 async function copySecret(){
  if(!secret)return;
  setCopyError("");
  try{
   if(navigator.clipboard?.writeText) await navigator.clipboard.writeText(secret);
   else fallbackCopySecret(secret);
   setSecretCopied(true);
  }catch{
   try{
    fallbackCopySecret(secret);
    setSecretCopied(true);
   }catch{
    setSecretCopied(false);
    setCopyError("Copy was blocked by the browser. Select the key and copy it manually before confirming.");
   }
  }
 }
 function createAnother(){
  setResult(null);
  setSecretCopied(false);
  setSecretConfirmed(false);
  setCopyError("");
 }
 const maskedSecret=secret?secret.slice(0,Math.min(8,secret.length))+"••••••••":"";
 if(result) return <div className="resource-page"><Link className="back-link" to="/app"><ArrowLeft size={16}/> Command Center</Link><div className="page-heading"><div><span className="eyebrow">{config.eyebrow}</span><h1>{config.kind==="api-key"?"API key created":config.kind==="webhook"?"Webhook created":config.kind==="support"?"Support request sent":config.kind==="verification"?"Verification result recorded":"Operation completed"}</h1><p>{config.kind==="verification"?"The control plane saved the supplied outcome and marked it as operator-reported evidence.":"The control plane accepted the request and returned the created resource."}</p></div></div><section className="surface success-panel"><CheckCircle2 size={28}/><h2>{config.kind==="support"?"Support request sent successfully.":config.kind==="verification"?"Verification result saved.":"Created successfully."}</h2><p>{String(result.message??(config.kind==="verification"?"The result was saved as operator-reported evidence.":"The resource is now available in the workspace."))}</p>{secret&&<div className="secret-reveal"><span>{secretConfirmed?"Secret hidden after confirmation":"Save this secret now. It cannot be retrieved again after you confirm."}</span><code>{secretConfirmed?maskedSecret:secret}</code>{!secretConfirmed&&<><button type="button" className={secretCopied?"is-copied":""} onClick={()=>void copySecret()} aria-label={secretCopied?`${secretLabel} copied to clipboard`:`Copy ${secretLabel}`}>{secretCopied?<CheckCircle2 size={15}/>:<Copy size={15} />}{secretCopied?"Copied!":"Copy"}</button>{config.kind==="api-key"&&<button type="button" className="secondary-action" disabled={!secretCopied&&!copyError} onClick={()=>setSecretConfirmed(true)}>I have copied it</button>}</>}{secretCopied&&!secretConfirmed&&<div className="secret-copy-confirmation" role="status" aria-live="polite"><CheckCircle2 size={15}/> {secretLabel} copied to clipboard successfully.</div>}{copyError&&!secretConfirmed&&<span role="alert">{copyError}</span>}</div>}{secretConfirmed&&config.kind==="api-key"&&<p role="status">The full API key is now hidden. This page will not reveal it again.</p>}<div className="context-next"><button className="primary-action" disabled={config.kind==="api-key"&&!!secret&&!secretConfirmed} onClick={()=>navigate(config.kind==="api-key"?"/app/developer/api-keys":config.kind==="webhook"?"/app/developer/webhooks":pathname.replace("/new",""))}>Open resource</button><button className="secondary-action" disabled={config.kind==="api-key"&&!!secret&&!secretConfirmed} onClick={createAnother}>Create another</button></div></section></div>;
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
 {config.kind==="verification"&&<><label className="action-field"><span>Tenant</span><select value={form.tenant_id??""} onChange={e=>set("tenant_id",e.target.value)}><option value="">Organization-wide</option>{options.map(o=><option value={o.id} key={o.id}>{o.name}</option>)}</select></label>{field("Verification kind","kind","tenant-isolation")}<label className="action-field"><span>Recorded outcome</span><select value={form.status??"review"} onChange={e=>set("status",e.target.value)}><option value="review">review required</option><option value="pass">passed by operator</option><option value="fail">failed by operator</option></select></label><label className="action-field"><span>Test evidence (JSON)</span><textarea value={form.evidence??""} onChange={e=>set("evidence",e.target.value)} rows={10} required placeholder={'{"checks":[{"name":"tenant-local-read","result":"pass","details":"Describe the actual test performed"}]}'}/><small>Record real test observations. Do not submit an empty checks list or mark a result passed without running the protected-path test.</small></label></>}
 {config.kind==="support"&&<>
  {field("Subject","subject","Describe the issue")}
  <label className="action-field">
    <span>Priority</span>
    <select value={form.priority??"normal"} onChange={e=>set("priority",e.target.value)}>
      <option value="low">Low</option>
      <option value="normal">Normal</option>
      <option value="high">High</option>
      <option value="urgent">Urgent</option>
    </select>
  </label>
  <label className="action-field">
    <span>Message</span>
    <textarea value={form.message??""} onChange={e=>set("message",e.target.value)} rows={10} required/>
  </label>
</>}
 {config.kind==="webhook"&&<>{field("Endpoint URL","endpoint_url","https://example.com/agata/webhook")}<label className="action-field"><span>Events</span><input value={form.events??"verification.completed,security.event"} onChange={e=>set("events",e.target.value)} placeholder="Comma-separated event types" required/></label><div className="action-note"><ShieldCheck size={16}/> Webhook signing secrets are generated by the control plane and shown only once.</div></>}
 <div className="action-actions"><button className="primary-action" disabled={busy} type="submit">{busy?"Creating…":"Create "+config.title.replace("Create ","").replace("Add ","").replace("Register ","")}</button><Link className="secondary-action" to={pathname.replace("/new","")}>Cancel</Link></div>
 </form></section></div>;
}
