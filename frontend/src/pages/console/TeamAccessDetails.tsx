import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, MailPlus, RefreshCw, RotateCw, ShieldCheck, UserPlus, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { api, type ApiError } from "../../api/client";

type Invitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
  accepted_at?: string | null;
};

const roleDefinitions = [
  {
    role: "Owner",
    key: "owner",
    summary: "Full organization authority, including the ability to manage administrators and organization-level configuration.",
    permissions: [
      "Manage the organization and workspace configuration",
      "Manage members and invitations",
      "Manage operational resources and security controls",
      "Retain ownership of the organization boundary",
    ],
  },
  {
    role: "Admin",
    key: "admin",
    summary: "Administrative access for membership, invitations, settings and operational control.",
    permissions: [
      "Invite, resend and revoke organization invitations",
      "Change member roles and remove non-owner members",
      "Manage organization settings and operational resources",
      "Cannot demote or remove the organization owner",
    ],
  },
  {
    role: "Operator",
    key: "operator",
    summary: "Operational write access without organization membership administration.",
    permissions: [
      "Create and change operational resources",
      "Work with tenants, policies, nodes and deployments",
      "Run operational verification workflows",
      "Cannot manage organization membership or administrative roles",
    ],
  },
  {
    role: "Viewer",
    key: "viewer",
    summary: "Read-oriented access for people who need visibility without operational write authority.",
    permissions: [
      "Inspect organization-scoped resources",
      "Review security, verification and audit evidence",
      "Read developer and operational documentation",
      "Cannot change resources, roles or organization membership",
    ],
  },
];

function invitationState(invitation: Invitation) {
  if (invitation.status === "accepted" || invitation.accepted_at) {
    return { label: "Accepted", icon: CheckCircle2, className: "console-status--active" };
  }
  if (new Date(invitation.expires_at).getTime() <= Date.now()) {
    return { label: "Expired", icon: XCircle, className: "console-status--failed" };
  }
  return { label: "Pending", icon: Clock3, className: "console-status--pending" };
}

export function TeamRoles() {
  return (
    <div className="resource-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">TEAM · ACCESS MODEL</span>
          <h1>Role responsibilities</h1>
          <p>These responsibilities describe the access boundary enforced by the control plane for each organization role.</p>
        </div>
        <Link className="secondary-action" to="/app/team"><ShieldCheck size={15}/> Back to team</Link>
      </div>

      <section className="surface">
        <div className="panel-heading">
          <div>
            <strong>Organization access model</strong>
            <span>Four explicit roles keep administrative authority separate from operational access.</span>
          </div>
        </div>
        <div className="detail-grid">
          {roleDefinitions.map((role) => (
            <article className="surface detail-field" key={role.key}>
              <span>{role.role}</span>
              <strong>{role.summary}</strong>
              <ul className="resource-detail-list">
                {role.permissions.map((permission) => <li key={permission}>{permission}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="surface">
        <div className="panel-heading">
          <div>
            <strong>Authorization boundary</strong>
            <span>Role checks are enforced by the authenticated control-plane API, not only by the dashboard.</span>
          </div>
        </div>
        <div className="resource-section-grid">
          <div className="surface resource-info-card">
            <span className="eyebrow">ADMINISTRATIVE WRITES</span>
            <h2>Owner + Admin</h2>
            <p>Administrative membership workflows require an owner or admin role. This includes invitations, member role changes and member removal.</p>
          </div>
          <div className="surface resource-info-card">
            <span className="eyebrow">OPERATIONAL WRITES</span>
            <h2>Owner + Admin + Operator</h2>
            <p>Operational write workflows accept owner, admin and operator access while keeping organization membership administration separate.</p>
          </div>
          <div className="surface resource-info-card">
            <span className="eyebrow">READ ACCESS</span>
            <h2>All organization members</h2>
            <p>Authenticated members can inspect the resources permitted to their organization context. The backend remains the final authorization boundary.</p>
          </div>
        </div>
      </section>

      <div className="context-next">
        <Link to="/app/team">Manage members</Link>
        <Link to="/app/team/invitations">Open invitation lifecycle</Link>
        <Link to="/app/audit">Review access audit events</Link>
      </div>
    </div>
  );
}

export function TeamInvitations() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setInvitations(await api.get<Invitation[]>("/api/v1/organization/invitations"));
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError?.message ?? (err instanceof Error ? err.message : "Unable to load organization invitations."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const counts = useMemo(() => {
    let pending = 0;
    let accepted = 0;
    let expired = 0;
    invitations.forEach((invitation) => {
      const state = invitationState(invitation).label;
      if (state === "Pending") pending += 1;
      else if (state === "Accepted") accepted += 1;
      else expired += 1;
    });
    return { pending, accepted, expired };
  }, [invitations]);

  async function action(id: string, path: string, success: string) {
    setBusyId(id);
    setError("");
    setMessage("");
    try {
      await api.post(path, {});
      setMessage(success);
      await load();
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError?.message ?? (err instanceof Error ? err.message : "The invitation action failed."));
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="resource-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">TEAM · INVITATIONS</span>
          <h1>Organization invitations</h1>
          <p>Track invitations sent to this organization, see their current lifecycle state and manage pending invitations.</p>
        </div>
        <div className="heading-actions">
          <Link className="primary-action" to="/app/team"><UserPlus size={15}/> Invite a member</Link>
          <button className="console-refresh-button" type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={15}/> Refresh</button>
        </div>
      </div>

      {message && <div className="settings-banner settings-banner--success">{message}</div>}
      {error && <div className="settings-banner settings-banner--error">{error}</div>}

      <div className="resource-section-grid">
        <div className="surface resource-info-card">
          <span className="eyebrow">PENDING</span>
          <h2>{counts.pending}</h2>
          <p>Invitations that are still within their seven-day validity window and have not been accepted.</p>
        </div>
        <div className="surface resource-info-card">
          <span className="eyebrow">ACCEPTED</span>
          <h2>{counts.accepted}</h2>
          <p>Invitations that have completed the acceptance step and established organization membership.</p>
        </div>
        <div className="surface resource-info-card">
          <span className="eyebrow">EXPIRED</span>
          <h2>{counts.expired}</h2>
          <p>Invitations whose validity window has elapsed without acceptance.</p>
        </div>
      </div>

      <section className="surface">
        <div className="panel-heading">
          <div>
            <strong>Invitation ledger</strong>
            <span>Organization-scoped records read directly from the control plane.</span>
          </div>
        </div>

        {loading && <div className="empty-state"><strong>Loading invitations…</strong><span>Reading the current organization invitation ledger.</span></div>}
        {!loading && !error && invitations.length === 0 && (
          <div className="empty-state">
            <MailPlus size={22}/>
            <strong>No invitations have been sent yet.</strong>
            <span>When someone needs access, use Team → Invite a member. New invitations are valid for seven days.</span>
            <Link className="primary-action" to="/app/team">Invite the first member</Link>
          </div>
        )}
        {!loading && !error && invitations.length > 0 && (
          <div className="resource-table-wrap">
            <table className="resource-table">
              <thead>
                <tr><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th>Expires</th><th>Action</th></tr>
              </thead>
              <tbody>
                {invitations.map((invitation) => {
                  const state = invitationState(invitation);
                  const Icon = state.icon;
                  const canResend = state.label === "Pending";
                  return (
                    <tr key={invitation.id}>
                      <td>{invitation.email}</td>
                      <td>{invitation.role}</td>
                      <td><span className={`console-status ${state.className}`}><Icon size={13}/> {state.label}</span></td>
                      <td>{new Date(invitation.created_at).toLocaleString()}</td>
                      <td>{new Date(invitation.expires_at).toLocaleString()}</td>
                      <td>
                        {canResend && (
                          <>
                            <button className="console-secondary-button" type="button" disabled={busyId===invitation.id} onClick={() => void action(invitation.id, `/api/v1/organization/invitations/${invitation.id}/resend`, "Invitation resent for another seven days.")}>
                              <RotateCw size={14}/> Resend
                            </button>
                            <button className="console-secondary-button" type="button" disabled={busyId===invitation.id} onClick={() => {
                              if (window.confirm("Revoke this pending invitation? The invitation link will no longer be valid.")) {
                                void action(invitation.id, `/api/v1/organization/invitations/${invitation.id}`, "Invitation revoked.");
                              }
                            }}>Revoke</button>
                          </>
                        )}
                        {!canResend && <span>Lifecycle complete</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="surface">
        <div className="panel-heading">
          <div>
            <strong>Invitation lifecycle</strong>
            <span>What happens after an invitation is created.</span>
          </div>
        </div>
        <div className="resource-section-grid">
          <div className="surface resource-info-card">
            <span className="eyebrow">1 · SEND</span>
            <h2>Create</h2>
            <p>The control plane creates an organization-scoped invitation with the selected role and a seven-day expiry.</p>
          </div>
          <div className="surface resource-info-card">
            <span className="eyebrow">2 · ACCEPT</span>
            <h2>Join</h2>
            <p>The recipient uses the invitation flow to establish membership in the organization with the invited role.</p>
          </div>
          <div className="surface resource-info-card">
            <span className="eyebrow">3 · MANAGE</span>
            <h2>Control</h2>
            <p>Owners and admins can resend or revoke pending invitations. All membership changes remain organization-scoped and auditable.</p>
          </div>
        </div>
      </section>

      <div className="context-next">
        <Link to="/app/team">Manage team members</Link>
        <Link to="/app/team/roles">Review role responsibilities</Link>
        <Link to="/app/audit">Review invitation audit events</Link>
      </div>
    </div>
  );
}
