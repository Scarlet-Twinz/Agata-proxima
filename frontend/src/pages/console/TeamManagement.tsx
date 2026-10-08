import { useEffect, useState, type FormEvent } from "react";
import { MailPlus, RefreshCw, ShieldCheck, UserPlus, UserMinus, RotateCw } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";

type Member = { id:string; email:string; display_name:string; role:string; current:boolean; created_at:string };
type Invitation = { id:string; email:string; role:string; status:string; expires_at:string; created_at:string };

export function TeamManagement() {
  const [members,setMembers]=useState<Member[]>([]);
  const [invitations,setInvitations]=useState<Invitation[]>([]);
  const [email,setEmail]=useState(""); const [role,setRole]=useState("viewer");
  const [busy,setBusy]=useState(false); const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState(""); const [error,setError]=useState("");

  async function load(){setLoading(true);setError("");try{const [m,i]=await Promise.all([api.get<Member[]>("/api/v1/organization/team"),api.get<Invitation[]>("/api/v1/organization/invitations")]);setMembers(m);setInvitations(i)}catch(e){setError(e instanceof Error?e.message:"Unable to load organization access.")}finally{setLoading(false)}}
  useEffect(()=>{void load()},[]);

  async function invite(event:FormEvent){event.preventDefault();setBusy(true);setError("");setMessage("");try{await api.post("/api/v1/organization/invitations",{email,role});setEmail("");setRole("viewer");setMessage("Invitation sent.");await load()}catch(e){setError(e instanceof Error?e.message:"Unable to send invitation.")}finally{setBusy(false)}}
  async function action(path:string,success:string){setError("");setMessage("");try{await api.post(path,{});setMessage(success);await load()}catch(e){setError(e instanceof Error?e.message:"The requested access change failed.")}}
  async function changeRole(id:string,next:string){setError("");setMessage("");try{await api.patch("/api/v1/organization/team/"+id+"/role",{role:next});setMessage("Member role updated.");await load()}catch(e){setError(e instanceof Error?e.message:"Unable to change member role.")}}
  async function remove(id:string){setError("");setMessage("");try{await api.delete("/api/v1/organization/team/"+id);setMessage("Member removed from this organization.");await load()}catch(e){setError(e instanceof Error?e.message:"Unable to remove member.")}}

  return <div className="resource-page">
    <div className="page-heading"><div><span className="eyebrow">TEAM</span><h1>Team and access</h1><p>Manage organization members, invitations and access roles inside the active organization.</p></div><button className="console-refresh-button" type="button" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> Refresh</button></div>
    {message&&<div className="settings-banner">{message}</div>}{error&&<div className="settings-banner settings-banner--error">{error}</div>}
    <div className="resource-section-grid">
      <section className="surface"><span className="eyebrow">INVITE MEMBER</span><h2>Add someone to this organization</h2><p>Invitations are organization-scoped, expire after seven days and can be resent without changing the assigned role.</p>
        <form onSubmit={invite} className="settings-form"><label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="person@company.com"/></label><label>Role<select value={role} onChange={e=>setRole(e.target.value)}><option value="viewer">Viewer</option><option value="operator">Operator</option><option value="admin">Admin</option></select></label><button className="primary-action" type="submit" disabled={busy||!email}><UserPlus size={16}/>{busy?"Sending…":"Send invitation"}</button></form>
      </section>
      <section className="surface"><span className="eyebrow">ACCESS MODEL</span><h2>Organization roles</h2><p><strong>Owner</strong> controls the organization. <strong>Admin</strong> manages access and settings. <strong>Operator</strong> manages operational resources. <strong>Viewer</strong> has read-oriented access.</p><Link className="public-inline-link" to="/app/team/roles">Review role responsibilities</Link></section>
    </div>
    <section className="surface"><div className="panel-heading"><div><strong>Members</strong><span>{members.length} member{members.length===1?"":"s"} in this organization</span></div></div>
      {loading?<div className="empty-state"><strong>Loading members…</strong></div>:<div className="resource-table-wrap"><table className="resource-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Access</th></tr></thead><tbody>
        {members.map(m=><tr key={m.id}><td>{m.display_name||"Unnamed member"}{m.current?" (you)":""}</td><td>{m.email}</td><td><select aria-label={"Role for "+m.email} value={m.role} disabled={m.role==="owner"||m.current} onChange={e=>void changeRole(m.id,e.target.value)}><option value="owner">Owner</option><option value="admin">Admin</option><option value="operator">Operator</option><option value="viewer">Viewer</option></select></td><td><ShieldCheck size={14}/> Active</td><td>{!m.current&&m.role!=="owner"&&<button className="console-secondary-button" type="button" onClick={()=>void remove(m.id)}><UserMinus size={14}/> Remove</button>}</td></tr>)}
      </tbody></table></div>}
    </section>
    <section className="surface"><div className="panel-heading"><div><strong>Invitations</strong><span>Pending, accepted and expired organization invitations</span></div></div>
      {!invitations.length?<div className="empty-state"><MailPlus size={22}/><strong>No invitations</strong><span>Send an invitation above when another person needs access.</span></div>:<div className="resource-table-wrap"><table className="resource-table"><thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Expires</th><th>Action</th></tr></thead><tbody>
        {invitations.map(i=><tr key={i.id}><td>{i.email}</td><td>{i.role}</td><td>{i.status}</td><td>{new Date(i.expires_at).toLocaleDateString()}</td><td>{i.status==="pending"&&<button className="console-secondary-button" type="button" onClick={()=>void action("/api/v1/organization/invitations/"+i.id+"/resend","Invitation resent.")}><RotateCw size={14}/> Resend</button>} {i.status==="pending"&&<button className="console-secondary-button" type="button" onClick={()=>void action("/api/v1/organization/invitations/"+i.id,"Invitation revoked.")}>Revoke</button>}</td></tr>)}
      </tbody></table></div>}
    </section>
  </div>;
}
