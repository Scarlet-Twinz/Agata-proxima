import { useEffect, useState } from "react";
import { MailPlus, RefreshCw, ShieldCheck, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";

type Member = { id:string; email:string; display_name:string; role:string; current:boolean; created_at:string };
type Invitation = { id:string; email:string; role:string; status:string; expires_at:string; created_at:string };

export function TeamManagement() {
  const [members,setMembers]=useState<Member[]>([]);
  const [invitations,setInvitations]=useState<Invitation[]>([]);
  const [email,setEmail]=useState("");
  const [role,setRole]=useState("viewer");
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const [memberResult, invitationResult] = await Promise.all([
        api.get<Member[]>("/api/v1/organization/team"),
        api.get<Invitation[]>("/api/v1/organization/invitations"),
      ]);
      setMembers(memberResult); setInvitations(invitationResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load organization access.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function invite(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      await api.post("/api/v1/organization/invitations", { email, role });
      setEmail(""); setRole("viewer");
      setMessage("Invitation sent. The recipient can accept it after signing in with the invited email address.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send invitation.");
    } finally { setBusy(false); }
  }

  async function revoke(id:string) {
    setError(""); setMessage("");
    try { await api.delete("/api/v1/organization/invitations/"+id); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to revoke invitation."); }
  }

  return <div className="resource-page">
    <div className="page-heading">
      <div><span className="eyebrow">TEAM</span><h1>Team and access</h1><p>Manage organization members, invitations and access roles inside the active organization.</p></div>
      <button className="console-refresh-button" type="button" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> Refresh</button>
    </div>

    {message && <div className="settings-banner">{message}</div>}
    {error && <div className="settings-banner settings-banner--error">{error}</div>}

    <div className="resource-section-grid">
      <section className="surface">
        <span className="eyebrow">INVITE MEMBER</span>
        <h2>Add someone to this organization</h2>
        <p>Invitations are organization-scoped and expire after seven days. Owners and admins can invite members.</p>
        <form onSubmit={invite} className="settings-form">
          <label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="person@company.com"/></label>
          <label>Role<select value={role} onChange={e=>setRole(e.target.value)}><option value="viewer">Viewer</option><option value="operator">Operator</option><option value="admin">Admin</option></select></label>
          <button className="primary-action" type="submit" disabled={busy || !email}><UserPlus size={16}/>{busy ? "Sending…" : "Send invitation"}</button>
        </form>
      </section>

      <section className="surface">
        <span className="eyebrow">ACCESS MODEL</span>
        <h2>Organization roles</h2>
        <p><strong>Owner</strong> controls the organization. <strong>Admin</strong> manages access and settings. <strong>Operator</strong> manages operational resources. <strong>Viewer</strong> has read-oriented access.</p>
        <Link className="public-inline-link" to="/app/team/roles">Review role responsibilities</Link>
      </section>
    </div>

    <section className="surface">
      <div className="panel-heading"><div><strong>Members</strong><span>{members.length} member{members.length===1?"":"s"} in this organization</span></div></div>
      {loading ? <div className="empty-state"><strong>Loading members…</strong></div> :
        <div className="resource-table-wrap"><table className="resource-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead><tbody>
          {members.map(m=><tr key={m.id}><td>{m.display_name || "Unnamed member"}{m.current ? " (you)" : ""}</td><td>{m.email}</td><td>{m.role}</td><td><ShieldCheck size={14}/> Active</td></tr>)}
        </tbody></table></div>}
    </section>

    <section className="surface">
      <div className="panel-heading"><div><strong>Invitations</strong><span>Pending and accepted organization invitations</span></div></div>
      {!invitations.length ? <div className="empty-state"><MailPlus size={22}/><strong>No invitations</strong><span>Send an invitation above when you want another person to join.</span></div> :
        <div className="resource-table-wrap"><table className="resource-table"><thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Expires</th><th></th></tr></thead><tbody>
          {invitations.map(i=><tr key={i.id}><td>{i.email}</td><td>{i.role}</td><td>{i.status}</td><td>{new Date(i.expires_at).toLocaleDateString()}</td><td>{i.status==="pending"&&<button className="console-secondary-button" type="button" onClick={()=>void revoke(i.id)}>Revoke</button>}</td></tr>)}
        </tbody></table></div>}
    </section>
  </div>;
}
