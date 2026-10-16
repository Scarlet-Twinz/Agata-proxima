import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, Copy, RefreshCw, Server, ShieldCheck } from "lucide-react";
import { api } from "../../api/client";
import { getSession } from "../../api/auth";

type NodeRecord = {
  id: string;
  name: string;
  environment?: string;
  region?: string;
  status: string;
  version?: string;
  last_seen_at?: string | null;
};

type CreatedNode = {
  id: string;
  name: string;
  status: string;
  enrollment_token: string;
  warning: string;
};

const enrollmentUrl =
  `${(import.meta.env.VITE_API_BASE_URL ?? window.location.origin).replace(/\/$/, "")}/api/v1/nodes/enroll`;

export function Nodes() {
  const [nodes, setNodes] = useState<NodeRecord[]>([]);
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState("production");
  const [region, setRegion] = useState("auto");
  const [organizationId, setOrganizationId] = useState("");
  const [created, setCreated] = useState<CreatedNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<"token" | "configuration" | "">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const session = await getSession();
      if (!session?.authenticated) throw new Error("Your session has expired. Sign in again.");
      setOrganizationId(session.organization_id);
      setNodes(await api.get<NodeRecord[]>("/api/v1/nodes"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load nodes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createNode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    setCopied("");
    setCreated(null);
    try {
      const result = await api.post<CreatedNode>("/api/v1/nodes", {
        organization_id: organizationId,
        name: name.trim(),
        environment,
        region: region.trim() || "auto",
      });
      setCreated(result);
      setName("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Node creation failed.");
    } finally {
      setSaving(false);
    }
  }

  const configuration = created
    ? [
        `$env:PROXIMA_NODE_ID = "${created.id}"`,
        `$env:PROXIMA_NODE_ENROLLMENT_URL = "${enrollmentUrl}"`,
        `$env:PROXIMA_NODE_ENROLLMENT_TOKEN = "${created.enrollment_token}"`,
      ].join("\n")
    : "";

  async function copyText(value: string, kind: "token" | "configuration") {
    setNotice("");
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        const field = document.createElement("textarea");
        field.value = value;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();
        const successful = document.execCommand("copy");
        field.remove();
        if (!successful) throw new Error("Clipboard copy failed");
      }
      setCopied(kind);
      setNotice(kind === "token" ? "Enrollment token copied. Store it securely." : "Enrollment configuration copied. Store it securely.");
    } catch {
      setNotice("Clipboard access is unavailable here. Select the text and copy it manually.");
    }
  }

  function hideSecret() {
    setCreated(null);
    setCopied("");
    setNotice("Enrollment secret hidden from this screen.");
  }

  return (
    <div className="resource-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">INFRASTRUCTURE</span>
          <h1>Node Management</h1>
          <p>Register infrastructure nodes and securely enroll them into your organization.</p>
        </div>
        <div className="heading-actions">
          <button className="console-refresh-button" type="button" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={15} className={loading ? "is-spinning" : ""} />
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {error && <div className="settings-banner settings-banner--error" role="alert">{error}</div>}
      {notice && <div className="settings-banner settings-banner--success" role="status">{notice}</div>}

      <section className="surface settings-section">
        <div className="settings-section-heading">
          <div>
            <h2>Register a node</h2>
            <p>Add an engine to the active organization and select its operating environment.</p>
          </div>
          <Server size={20} aria-hidden="true" />
        </div>
        <form onSubmit={createNode} className="settings-form">
          <div className="settings-grid">
            <label className="settings-field">
              <span>Node name</span>
              <input required minLength={2} maxLength={100} value={name}
                onChange={e => setName(e.target.value)} placeholder="e.g. production-node-01" />
            </label>
            <label className="settings-field">
              <span>Environment</span>
              <select value={environment} onChange={e => setEnvironment(e.target.value)}>
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="development">Development</option>
              </select>
            </label>
            <label className="settings-field">
              <span>Region</span>
              <input value={region} onChange={e => setRegion(e.target.value)} placeholder="auto" />
            </label>
          </div>
          <div className="action-actions">
            <button className="primary-action" type="submit" disabled={saving || loading || !organizationId || !name.trim()}>
              <Server size={15} /> {saving ? "Registering…" : "Register node"}
            </button>
          </div>
        </form>
      </section>

      {created && (
        <section className="surface settings-section" aria-labelledby="node-created-heading">
          <div className="settings-section-heading">
            <div>
              <span className="eyebrow">ONE-TIME CREDENTIAL</span>
              <h2 id="node-created-heading">Node registered</h2>
              <p>Copy the token or complete enrollment configuration now. The secret is only shown once.</p>
            </div>
            <ShieldCheck size={21} aria-hidden="true" />
          </div>
          <div className="settings-grid">
            <div className="settings-field">
              <span>Node ID</span>
              <div className="settings-readonly"><code>{created.id}</code></div>
            </div>
            <div className="settings-field">
              <span>Status</span>
              <div className="settings-readonly"><span className={`console-status console-status--${created.status.toLowerCase()}`}>{created.status}</span></div>
            </div>
          </div>
          <label className="action-field node-secret-field">
            Enrollment token — keep it private
            <textarea readOnly rows={2} value={created.enrollment_token} onFocus={e => e.currentTarget.select()} />
          </label>
          <div className="action-actions">
            <button className="secondary-action" type="button" onClick={() => void copyText(created.enrollment_token, "token")}>
              {copied === "token" ? <Check size={15} /> : <Copy size={15} />}
              {copied === "token" ? "Token copied" : "Copy token only"}
            </button>
            <button className="primary-action" type="button" onClick={() => void copyText(configuration, "configuration")}>
              {copied === "configuration" ? <Check size={15} /> : <Copy size={15} />}
              {copied === "configuration" ? "Configuration copied" : "Copy enrollment configuration"}
            </button>
          </div>
          <label className="action-field node-secret-field">
            Enrollment configuration
            <textarea readOnly rows={4} value={configuration} onFocus={e => e.currentTarget.select()} />
          </label>
          <div className="action-note">
            <ShieldCheck size={16} />
            Set these variables in the node process environment. Never commit the token or paste it into logs.
          </div>
          <div className="action-actions">
            <button className="secondary-action" type="button" onClick={hideSecret}>
              <Check size={15} /> I have saved the credentials — hide secret
            </button>
          </div>
        </section>
      )}

      <section className="surface resource-data-surface">
        <div className="resource-data-heading">
          <div>
            <span className="eyebrow">LIVE CONTROL-PLANE DATA</span>
            <h2>{loading ? "Loading nodes…" : `Registered nodes (${nodes.length})`}</h2>
          </div>
        </div>
        {loading ? (
          <div className="empty-state"><strong>Loading live data…</strong><span>Reading nodes from the authenticated control plane.</span></div>
        ) : nodes.length === 0 ? (
          <div className="empty-state"><strong>No nodes registered yet.</strong><span>Register a node above to begin enrollment.</span></div>
        ) : (
          <div className="resource-table-wrap">
            <table className="resource-table">
              <thead><tr>{["Name", "Environment", "Region", "Status", "Last seen", "Node ID"].map(label => <th key={label}>{label}</th>)}</tr></thead>
              <tbody>
                {nodes.map(node => (
                  <tr key={node.id}>
                    <td>{node.name}</td>
                    <td>{node.environment ?? "—"}</td>
                    <td>{node.region ?? "—"}</td>
                    <td><span className={`console-status console-status--${node.status.toLowerCase()}`}>{node.status}</span></td>
                    <td>{node.last_seen_at ? new Date(node.last_seen_at).toLocaleString() : "Never"}</td>
                    <td><code>{node.id}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
