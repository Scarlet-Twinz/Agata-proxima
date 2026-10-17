import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowUpRight, CheckCircle2, Copy, ShieldCheck } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, type ApiError } from "../../api/client";

type Session = { organization_id: string; csrf_token: string; role: string };
type Option = { id:string; name:string };

const configs:Record<string,{eyebrow:string;title:string;description:string;kind:string}> = {
 "/app/tenants/new":{eyebrow:"TENANTS",title:"Create tenant",description:"Create a customer boundary inside the active organization.",kind:"tenant"},
 "/app/policies/new":{eyebrow:"POLICIES",title:"Create policy",description:"Create a versioned policy document that can move through deployment and verification.",kind:"policy"},
 "/app/nodes/new":{eyebrow:"INFRASTRUCTURE",title:"Register node",description:"Register a Proxima enforcement node and its operating environment.",kind:"node"},
 "/app/deployments/new":{eyebrow:"DEPLOYMENTS",title:"Create deployment",description:"Declare the desired state and version for an enrolled node.",kind:"deployment"},
 "/app/verification/new":{eyebrow:"VERIFICATION",title:"Record verification",description:"Save the outcome and evidence from an isolation test you have executed in the target environment.",kind:"verification"},
 "/app/support/new":{eyebrow:"SUPPORT",title:"Open support request",description:"Give the support team a complete operational context for the issue.",kind:"support"},
 "/app/developer/api-keys/new":{eyebrow:"DEVELOPER",title:"Create API key",description:"Create an organization-scoped machine credential. The full secret is shown once.",kind:"api-key"},
 "/app/developer/webhooks/new":{eyebrow:"DEVELOPER",title:"Add webhook",description:"Create a signed event endpoint and choose which Agata events it receives.",kind:"webhook"},
};

export function ActionPage(){
 const {pathname}=useLocation(); const navigate=useNavigate(); const config=configs[pathname]??configs["/app/tenants/new"];
 const [session,setSession]=useState<Session|null>(null); const [options,setOptions]=useState<Option[]>([]); const [form,setForm]=useState<Record<string,string>>({}); const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [result,setResult]=useState<Record<string,unknown>|null>(null);
 const [secretCopied,setSecretCopied]=useState(false); const [secretConfirmed,setSecretConfirmed]=useState(false); const [copyError,setCopyError]=useState(""); const [guideCopied,setGuideCopied]=useState(false); const [testCopied,setTestCopied]=useState(false);
 useEffect(()=>{let active=true;(async()=>{try{const s=await api.get<Session>("/api/v1/session");if(active)setSession(s);if(config.kind==="deployment"){const n=await api.get<Option[]>("/api/v1/nodes");if(active)setOptions(n)}if(config.kind==="verification"){const t=await api.get<Array<Option&{slug?:string}>>("/api/v1/tenants");if(active)setOptions(t)}}catch(e){if(active)setError((e as ApiError)?.message??"Unable to load the workspace session.")}})();return()=>{active=false}},[config.kind]);
 function set(key:string,value:string){setForm(v=>({...v,[key]:value}))}
 async function submit(e:FormEvent){e.preventDefault();if(!session)return;setBusy(true);setError("");
  try{
   let path="/api/v1/tenants",body:Record<string,unknown>={organization_id:session.organization_id};
   if(config.kind==="tenant"){path="/api/v1/tenants";body={...body,name:form.name,slug:form.slug||form.name?.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""),isolation_mode:form.isolation_mode||"enforced-proxy"}}
   if(config.kind==="policy"){path="/api/v1/policies";body={...body,name:form.name,version:Number(form.version||1),document:JSON.parse(form.document||"{}")}}
   if(config.kind==="node"){path="/api/v1/nodes";body={...body,name:form.name,environment:form.environment||"production",region:form.region||"auto"}}
   if(config.kind==="deployment"){path="/api/v1/deployments";body={...body,node_id:form.node_id,version:form.version,desired_state:form.desired_state||"running"}}
   if(config.kind==="verification"){path="/api/v1/verifications";body={...body,tenant_id:form.tenant_id||null,kind:form.kind||"tenant-isolation",status:form.status||"pass",evidence:JSON.parse(form.evidence||'{"checks":[]}')}}
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
 const verificationEvidenceExample=JSON.stringify({environment:"staging",test_run_id:"replace-with-your-test-run-id",checks:[{name:"tenant_a_reads_own_record",expected:"allow",observed:"allowed",passed:true},{name:"tenant_a_reads_tenant_b_record",expected:"deny",observed:"denied",passed:true}]},null,2);
 async function copyVerificationEvidence(){try{await navigator.clipboard.writeText(verificationEvidenceExample);setGuideCopied(true)}catch{setGuideCopied(false)}}
 const verificationTestScript=String.raw`const token = process.env.AGATA_TEST_TENANT_A_TOKEN;
const ownUrl = process.env.AGATA_TEST_TENANT_A_OWN_URL;
const otherTenantUrl = process.env.AGATA_TEST_TENANT_B_RECORD_URL;

if (!token || !ownUrl || !otherTenantUrl) {
  throw new Error("Set AGATA_TEST_TENANT_A_TOKEN, AGATA_TEST_TENANT_A_OWN_URL and AGATA_TEST_TENANT_B_RECORD_URL.");
}

async function getStatus(url) {
  const response = await fetch(url, {
    headers: { Authorization: "Bearer " + token, Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
    redirect: "manual"
  });
  return response.status;
}

const ownStatus = await getStatus(ownUrl);
if (ownStatus < 200 || ownStatus >= 300) {
  throw new Error("Tenant A's own-record request should succeed; received HTTP " + ownStatus);
}

const crossStatus = await getStatus(otherTenantUrl);
if (![403, 404].includes(crossStatus)) {
  throw new Error("Cross-tenant request should be denied with HTTP 403 or 404; received HTTP " + crossStatus);
}

console.log(JSON.stringify({
  tenant_a_own_record: { expected: "allow", observed_status: ownStatus, passed: true },
  tenant_a_to_tenant_b: { expected: "deny", observed_status: crossStatus, passed: true }
}, null, 2));`;
 async function copyVerificationTest(){try{await navigator.clipboard.writeText(verificationTestScript);setTestCopied(true)}catch{setTestCopied(false)}}
 if(result) return <div className="resource-page"><Link className="back-link" to="/app"><ArrowLeft size={16}/> Command Center</Link><div className="page-heading"><div><span className="eyebrow">{config.eyebrow}</span><h1>{config.kind==="api-key"?"API key created":config.kind==="webhook"?"Webhook created":config.kind==="support"?"Support request sent":config.kind==="verification"?"Verification record saved":"Operation completed"}</h1><p>{config.kind==="verification"?"The control plane saved the status and evidence you submitted. It did not execute the isolation test.":"The control plane accepted the request and returned the created resource."}</p></div></div><section className="surface success-panel"><CheckCircle2 size={28}/><h2>{config.kind==="support"?"Support request sent successfully.":config.kind==="verification"?"Verification record saved.":"Created successfully."}</h2><p>{String(result.message??(config.kind==="verification"?"Open Verification evidence to review the saved record.":"The resource is now available in the workspace."))}</p>{secret&&<div className="secret-reveal"><span>{secretConfirmed?"Secret hidden after confirmation":"Save this secret now. It cannot be retrieved again after you confirm."}</span><code>{secretConfirmed?maskedSecret:secret}</code>{!secretConfirmed&&<><button type="button" className={secretCopied?"is-copied":""} onClick={()=>void copySecret()} aria-label={secretCopied?`${secretLabel} copied to clipboard`:`Copy ${secretLabel}`}>{secretCopied?<CheckCircle2 size={15}/>:<Copy size={15} />}{secretCopied?"Copied!":"Copy"}</button>{config.kind==="api-key"&&<button type="button" className="secondary-action" disabled={!secretCopied&&!copyError} onClick={()=>setSecretConfirmed(true)}>I have copied it</button>}</>}{secretCopied&&!secretConfirmed&&<div className="secret-copy-confirmation" role="status" aria-live="polite"><CheckCircle2 size={15}/> {secretLabel} copied to clipboard successfully.</div>}{copyError&&!secretConfirmed&&<span role="alert">{copyError}</span>}</div>}{secretConfirmed&&config.kind==="api-key"&&<p role="status">The full API key is now hidden. This page will not reveal it again.</p>}<div className="context-next"><button className="primary-action" disabled={config.kind==="api-key"&&!!secret&&!secretConfirmed} onClick={()=>navigate(config.kind==="api-key"?"/app/developer/api-keys":config.kind==="webhook"?"/app/developer/webhooks":pathname.replace("/new",""))}>Open resource</button><button className="secondary-action" disabled={config.kind==="api-key"&&!!secret&&!secretConfirmed} onClick={createAnother}>Create another</button></div></section></div>;
 const field=(label:string,key:string,placeholder:string,opts?:{type?:string})=><label className="action-field"><span>{label}</span><input type={opts?.type??"text"} value={form[key]??""} onChange={e=>set(key,e.target.value)} placeholder={placeholder} required /></label>;
 return <div className="resource-page"><Link className="back-link" to="/app"><ArrowLeft size={16}/> Command Center</Link><div className="page-heading"><div><span className="eyebrow">{config.eyebrow}</span><h1>{config.title}</h1><p>{config.description}</p></div></div>
 {config.kind==="verification"&&<section className="surface verification-guide">
  <div className="surface-heading"><div><span className="eyebrow">VERIFICATION RUNBOOK</span><h2>How to test tenant isolation</h2><p>Follow these steps before recording a passing result. This form records evidence; it does not send test queries to your application or database.</p></div></div>
  <ol className="verification-guide-steps">
   <li><strong>Prepare two test tenants.</strong><span>Create Tenant A and Tenant B in the same active organization. Use synthetic data only. A meaningful cross-tenant test needs at least two tenants.</span></li>
   <li><strong>Run the test through your protected application path.</strong><span>Authenticate as a test user belonging to Tenant A. Read a record owned by A and confirm the request succeeds. Then request a known Tenant B record using the same Tenant A identity and confirm the protected path rejects it.</span></li>
   <li><strong>Capture actual outcomes.</strong><span>Record the test-run ID, environment, timestamps, request IDs, expected result and observed result. Do not mark a check passed merely because the dashboard accepted the form.</span></li>
   <li><strong>Submit the evidence below.</strong><span>Select Tenant A in the dropdown to associate this record with that tenant. Choose Pass only when the required checks actually passed; use Review when you have not run them yet.</span></li>
  </ol>
  <div className="verification-guide-code"><div className="context-code-toolbar"><span>Example evidence JSON — replace with your real test results</span><button type="button" className="console-refresh-button" onClick={()=>void copyVerificationEvidence()}><Copy size={14}/>{guideCopied?"Copied":"Copy JSON"}</button></div><pre className="context-code">{verificationEvidenceExample}</pre><p>This JSON is a record of results, not executable test code. The names and outcomes above are examples; replace them with checks you actually performed.</p></div>
  <div className="verification-guide-code"><div className="context-code-toolbar"><span>Runnable Node.js HTTP test template (Node.js 22+)</span><button type="button" className="console-refresh-button" onClick={()=>void copyVerificationTest()}><Copy size={14}/>{testCopied?"Copied":"Copy test script"}</button></div><pre className="context-code">{verificationTestScript}</pre><p>Save this as verify-tenant-isolation.mjs in your application project. It assumes the token belongs to a Tenant A test user and that the two URLs identify an A-owned record and a B-owned record. Set the URLs to your real protected application endpoints; if your app uses a tenant-context header, add its documented header to the script. This template does not call the Agata verification-record endpoint.</p><div className="context-code-toolbar"><span>PowerShell — set your test values, then run the script</span></div><pre className="context-code">{String.raw`$env:AGATA_TEST_TENANT_A_TOKEN = "<tenant-A-test-token>"
$env:AGATA_TEST_TENANT_A_OWN_URL = "https://your-app.example/api/records/<tenant-A-record-id>"
$env:AGATA_TEST_TENANT_B_RECORD_URL = "https://your-app.example/api/records/<tenant-B-record-id>"
node .\verify-tenant-isolation.mjs`}</pre></div>
  <div className="verification-guide-next"><Link to="/app/tenants">Open tenant registry <ArrowUpRight size={14}/></Link><Link to="/app/verification">Review verification records <ArrowUpRight size={14}/></Link><Link to="/app/audit">Inspect audit events <ArrowUpRight size={14}/></Link></div>
 </section>}
 <section className="surface action-card">{error&&<div className="console-inline-error">{error}</div>}<form onSubmit={submit} className="action-form">
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
 {config.kind==="verification"&&<><label className="action-field"><span>Tenant</span><select value={form.tenant_id??""} onChange={e=>set("tenant_id",e.target.value)}><option value="">Organization-wide (no tenant selected)</option>{options.map(o=><option value={o.id} key={o.id}>{o.name}</option>)}</select><small>Choose a specific tenant to associate this record with that tenant. The tenant must belong to the active organization. For a cross-tenant isolation test, prepare at least two test tenants.</small></label>{field("Verification kind","kind","tenant-isolation")}<label className="action-field"><span>Status</span><select value={form.status??"review"} onChange={e=>set("status",e.target.value)}><option value="pass">Pass — checks passed</option><option value="fail">Fail — a check failed</option><option value="review">Review — not yet verified</option><option value="running">Running — test in progress</option></select><small>Choose Pass only after running the test against the real protected application/database path. This form stores the submitted result; it does not run the test.</small></label><label className="action-field"><span>Evidence (JSON)</span><textarea value={form.evidence??'{"checks":[]}'} onChange={e=>set("evidence",e.target.value)} rows={10} required/><small>The default <code>{"{\"checks\":[]}"}</code> is valid JSON and can be left as-is while testing the form. Add evidence details only when you have them.</small></label></>}
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
 <div className="action-actions"><button className="primary-action" disabled={busy} type="submit">{busy?"Saving…":config.kind==="verification"?"Save verification record":"Create "+config.title.replace("Create ","").replace("Add ","").replace("Register ","")}</button><Link className="secondary-action" to={pathname.replace("/new","")}>Cancel</Link></div>
 </form></section></div>;
}
