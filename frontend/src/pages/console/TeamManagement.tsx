import { useCallback, useEffect, useState } from "react";
import { MailPlus, RefreshCw, ShieldCheck, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import { api, type ApiError } from "../../api/client";

type Member = { id:string; email:string; display_name:string; role:string; current:boolean; created_at:string };
type Invitation = { id:string; email:string; role:string; status:string; expires_at:string; created_at:string };
type Session = { organization_id:string };
type TeamEntitlements = { plan:string; limits:{ team_seats:number }; usage:{ active_team_members:number; pending_team_invites:number } };

export function TeamManagement() {
  const [members,setMembers]=useState<Member[]>([]);
  const [invitations,setInvitations]=useState<Invitation[]>([]);
  const [email,setEmail]=useState("");
  const [role,setRole]=useState("viewer");
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [organizationId,setOrganizationId]=useState("");
  const [entitlements,setEntitlements]=useState<TeamEntitlements|null>(null);
  const [upgradeRequired,setUpgradeRequired]=useState(false);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) { setLoading(true); setError(""); }
    try {
      const [session, memberResult, invitationResult] = await Promise.all([
        api.get<Session>("/api/v1/session"),
        api.get<Member[]>("/api/v1/organization/team"),
        api.get<Invitation[]>("/api/v1/organization/invitations"),
      ]);
      setOrganizationId(session.organization_id);
      setMembers(memberResult);
      setInvitations(invitationResult);
      try {
        setEntitlements(await api.get<TeamEntitlements>("/api/v1/billing/entitlements"));
      } catch {
        setEntitlements(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load organization access.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(false); }, [load]);

  async function invite(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage(""); setUpgradeRequired(false);
    if (!organizationId) {
      setError("The active organization could not be identified. Refresh the page and try again.");
      setBusy(false);
      return;
    }
    try {
      await api.post("/api/v1/organization/invitations", { organization_id: organizationId, email, role });
      setEmail(""); setRole("viewer");
      setMessage("Invitation email submitted successfully. The recipient can accept it after signing in with the invited email address.");
      await load();
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError?.status === 402 && apiError.code === "plan_limit_reached") {
        setUpgradeRequired(true);
        setError(apiError.message || "Your current plan has reached its team-seat limit. Upgrade your plan to invite another member.");
      } else if (apiError?.status === 422) {
        setError("The invitation request was rejected because required information was missing or invalid. Refresh the page and try again.");
      } else {
        setError(err instanceof Error ? err.message : "Unable to send invitation.");
      }
    } finally { setBusy(false); }
  }

  async function revoke(id:string) {
    setError(""); setMessage("");
    try { await api.delete("/api/v1/organization/invitations/"+id); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to revoke invitation."); }
  }

  const seatLimit = entitlements?.limits.team_seats;
  const seatsUsed = entitlements
    ? entitlements.usage.active_team_members + entitlements.usage.pending_team_invites
    : 0;

  return <div className="resource-page">
    <div className="page-heading">
      <div><span className="eyebrow">TEAM</span><h1>Team and access</h1><p>Manage organization members, invitations and access roles inside the active organization.</p></div>
      <button className="console-refresh-button" type="button" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> Refresh</button>
    </div>

    {message && <div className="settings-banner">{message}</div>}
    {error && <div className="settings-banner settings-banner--error"><span>{error}</span>{upgradeRequired && <Link className="public-inline-link" to="/app/billing/plans">Compare plans and upgrade</Link>}</div>}

    <div className="resource-section-grid">
      <section className="surface">
        <span className="eyebrow">INVITE MEMBER</span>
        <h2>Add someone to this organization</h2>
        <p>Invitations are organization-scoped and expire after seven days. Owners and admins can invite members.</p>
        {entitlements && seatLimit !== undefined && (
          <div className="settings-readonly">
            <strong>{entitlements.plan.replace(/\b\w/g, letter => letter.toUpperCase())} plan · Team seats</strong>
            <small>{seatsUsed} of {seatLimit} seats used. {seatsUsed >= seatLimit ? "Your current plan is at its team-seat limit; upgrade to invite another member." : `${seatLimit - seatsUsed} seat(s) available.`}</small>
          </div>
        )}
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
