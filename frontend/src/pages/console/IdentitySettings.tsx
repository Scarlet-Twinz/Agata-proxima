import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { api, type ApiError } from "../../api/client";

type EntraStatus = {
  ok: boolean;
  provider: "microsoft-entra";
  configured: boolean;
  tenant_id: string | null;
  jit_provisioning: boolean;
};

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "Unable to load Microsoft Entra settings.";
}

export function IdentitySettings() {
  const [status, setStatus] = useState<EntraStatus | null>(null);
  const [tenantId, setTenantId] = useState("");
  const [jit, setJit] = useState(false);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setBusy(true);
    setError("");
    try {
      const result = await api.get<EntraStatus>("/api/v1/organization/oidc/entra");
      setStatus(result);
      setTenantId(result.tenant_id ?? "");
      setJit(result.jit_provisioning);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await api.post<{ ok: boolean; tenant_id: string; issuer: string }>(
        "/api/v1/organization/oidc/entra",
        { tenant_id: tenantId.trim(), jit_provisioning: jit },
      );
      setStatus({
        ok: result.ok,
        provider: "microsoft-entra",
        configured: true,
        tenant_id: result.tenant_id,
        jit_provisioning: jit,
      });
      setTenantId(result.tenant_id);
      setMessage("Microsoft Entra connection saved and enabled for this organization.");
    } catch (cause) {
      const err = cause as ApiError;
      setError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <Link className="settings-back-link" to="/app/settings"><ArrowLeft size={16} /> Settings</Link>
        <div className="settings-page-title">
          <span className="settings-eyebrow">ADVANCED CONFIGURATION</span>
          <h1>Enterprise identity</h1>
          <p>Configure Microsoft Entra ID single sign-on for the active organization.</p>
        </div>
      </div>

      <section className="settings-section">
        <div className="settings-section-heading">
          <div><h2>Microsoft Entra ID (OIDC)</h2><p>Connect this Agata organization to its Microsoft Entra tenant. The tenant ID is a UUID from the Entra tenant overview.</p></div>
          <ShieldCheck size={19}/>
        </div>

        {error && <div className="settings-error" role="alert">{error}</div>}
        {message && <div className="settings-success" role="status"><CheckCircle2 size={16}/>{message}</div>}

        {busy ? <p>Loading identity configuration…</p> : <>
          <div className="settings-readonly" style={{marginBottom:16}}>
            <strong>{status?.configured ? "Connection enabled" : "Connection not configured"}</strong>
            <small>{status?.configured ? "SSO start requests can now resolve this organization's Entra connection, subject to plan entitlement and server credentials." : "The organization does not currently have an enabled Entra connection."}</small>
          </div>
          <div className="settings-grid">
            <label className="settings-field">
              <span>Microsoft Entra tenant ID</span>
              <input value={tenantId} onChange={event => setTenantId(event.target.value)} placeholder="00000000-0000-0000-0000-000000000000" autoComplete="off" spellCheck={false}/>
            </label>
            <div className="settings-field">
              <span>Identity provisioning</span>
              <label className="settings-toggle">
                <span><strong>Allow just-in-time provisioning</strong><small>New Microsoft identities may be added as viewer members when they do not already have an Agata account.</small></span>
                <input type="checkbox" checked={jit} onChange={event => setJit(event.target.checked)}/>
              </label>
            </div>
          </div>
          <div style={{display:"flex",gap:10,marginTop:16,flexWrap:"wrap"}}>
            <button className="primary-action" type="button" onClick={() => void save()} disabled={saving || !tenantId.trim()}><Save size={15}/>{saving ? "Saving…" : "Save and enable Entra SSO"}</button>
            <button className="secondary-action" type="button" onClick={() => void load()} disabled={busy || saving}><RefreshCw size={15}/>Refresh status</button>
          </div>
          <div className="settings-readonly" style={{marginTop:16}}>
            <strong>Before testing sign-in</strong>
            <small>The server must have PROXIMA_OIDC_CLIENT_ID and PROXIMA_OIDC_CLIENT_SECRET configured, and the Entra app registration must include the exact callback URL. Entra SSO requires an organization plan with the entra_oidc entitlement.</small>
            <small>Existing Agata accounts are not automatically linked to Microsoft identities. JIT provisioning only creates a new account when the email is not already registered; use an identity-linking flow for an existing account.</small>
          </div>
        </>}
      </section>
    </div>
  );
}
