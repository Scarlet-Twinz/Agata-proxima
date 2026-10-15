import { useEffect, useState } from "react";
import { Check, Copy, Cpu, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import { api } from "../../api/client";

type NodeRecord = {
  id: string;
  name: string;
  environment: string;
  region: string;
  status: "pending" | "enrolling" | "healthy" | "degraded" | "offline" | "revoked" | string;
  version: string;
  last_seen_at: string | null;
};

type CreatedNode = {
  id: string;
  name: string;
  status: string;
  enrollment_token: string;
  warning: string;
};

const statusLabel: Record<string, string> = {
  pending: "Pending enrollment",
  enrolling: "Enrolling",
  healthy: "Healthy",
  degraded: "Degraded",
  offline: "Offline",
  revoked: "Revoked",
};

export function Nodes() {
  const [nodes, setNodes] = useState<NodeRecord[]>([]);
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState("production");
  const [region, setRegion] = useState("auto");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedNode | null>(null);
  const [copied, setCopied] = useState(false);

  async function loadNodes() {
    setRefreshing(true);
    setError("");
    try {
      const result = await api.get<NodeRecord[]>("/api/v1/nodes");
      setNodes(Array.isArray(result) ? result : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load nodes.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void loadNodes(); }, []);

  async function createNode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError("Enter a name for this node.");
      return;
    }
    setSaving(true);
    setError("");
    setCreated(null);
    setCopied(false);
    try {
      const session = await api.get<{ organization_id: string }>("/api/v1/session");
      const result = await api.post<CreatedNode>("/api/v1/nodes", {
        organization_id: session.organization_id,
        name: cleanName,
        environment,
        region: region.trim() || "auto",
      });
      setCreated(result);
      setName("");
      await loadNodes();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to register the node.");
    } finally {
      setSaving(false);
    }
  }

  async function copyEnrollmentToken() {
    if (!created?.enrollment_token) return;
    try {
      await navigator.clipboard.writeText(created.enrollment_token);
      setCopied(true);
    } catch {
      setError("Clipboard access was blocked. Select and copy the enrollment token manually.");
    }
  }

  return (
    <div className="command-center">
      <div className="page-heading">
        <div>
          <span className="eyebrow">PROXIMA FLEET</span>
          <h1>Nodes</h1>
          <p>Register the Proxima Engine instances that will sit between your application and PostgreSQL.</p>
        </div>
        <div className="heading-actions">
          <button className="secondary-action" type="button" onClick={() => void loadNodes()} disabled={refreshing}>
            <RefreshCw size={15} /> {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {error && <div className="system-notice system-notice--warning" role="alert"><strong>Node operation failed.</strong><span>{error}</span></div>}

      {created && (
        <section className="surface" aria-live="polite">
          <div className="surface-heading">
            <div><span className="eyebrow">ONE-TIME SECRET</span><h2>Node registered</h2></div>
            <ShieldCheck size={20} />
          </div>
          <p>Save this enrollment token now. The control plane will not return it again.</p>
          <label htmlFor="enrollment-token">Enrollment token</label>
          <div className="token-copy-row">
            <input id="enrollment-token" className="field-input" readOnly value={created.enrollment_token} onFocus={(event) => event.currentTarget.select()} />
            <button className="secondary-action" type="button" onClick={() => void copyEnrollmentToken()}>
              {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy token"}
            </button>
          </div>
          <p className="muted-copy">Node ID: <code>{created.id}</code></p>
          <div className="system-notice system-notice--warning">
            <strong>Registration is not the same as successful enrollment.</strong>
            <span>The node is currently pending. Do not send this token to a public service or mark the node production-ready until the engine's authenticated enrollment handshake and readiness checks have succeeded.</span>
          </div>
        </section>
      )}

      <section className="surface">
        <div className="surface-heading">
          <div><span className="eyebrow">REGISTER A RUNTIME</span><h2>Add a node</h2></div>
          <Cpu size={20} />
        </div>
        <form className="node-create-form" onSubmit={(event) => void createNode(event)}>
          <label>
            Node name
            <input className="field-input" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="e.g. production-eu-01" required />
          </label>
          <label>
            Environment
            <select className="field-input" value={environment} onChange={(event) => setEnvironment(event.target.value)}>
              <option value="development">Development</option>
              <option value="staging">Staging</option>
              <option value="production">Production</option>
              <option value="private">Private</option>
            </select>
          </label>
          <label>
            Region
            <input className="field-input" value={region} onChange={(event) => setRegion(event.target.value)} maxLength={80} placeholder="auto" />
          </label>
          <button className="primary-action" type="submit" disabled={saving}>
            <Plus size={15} /> {saving ? "Registering…" : "Register node"}
          </button>
        </form>
      </section>

      <section className="surface">
        <div className="surface-heading">
          <div><span className="eyebrow">FLEET INVENTORY</span><h2>Registered nodes</h2></div>
          <span>{nodes.length} node(s)</span>
        </div>
        {loading ? <div className="empty-state"><strong>Loading nodes…</strong><span>Retrieving your organization-scoped fleet.</span></div>
          : nodes.length === 0 ? <div className="empty-state"><strong>No nodes registered yet.</strong><span>Register a node above to begin the onboarding workflow.</span></div>
          : <div className="table-scroll"><table className="data-table">
            <thead><tr><th>Name</th><th>Environment</th><th>Region</th><th>Status</th><th>Version</th><th>Last seen</th></tr></thead>
            <tbody>{nodes.map((node) => <tr key={node.id}>
              <td><strong>{node.name}</strong><small className="muted-copy">{node.id}</small></td>
              <td>{node.environment}</td><td>{node.region}</td>
              <td><span className={`status-pill status-pill--${node.status}`}>{statusLabel[node.status] ?? node.status}</span></td>
              <td>{node.version || "unknown"}</td>
              <td>{node.last_seen_at ? new Date(node.last_seen_at).toLocaleString() : "Never"}</td>
            </tr>)}</tbody>
          </table></div>}
      </section>
    </div>
  );
}
