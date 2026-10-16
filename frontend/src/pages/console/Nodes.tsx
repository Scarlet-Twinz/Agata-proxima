import { useCallback, useEffect, useState, type FormEvent } from "react";
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
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const session = await getSession();
      if (!session?.authenticated) {
        throw new Error("Your session has expired. Sign in again.");
      }
      setOrganizationId(session.organization_id);
      setNodes(await api.get<NodeRecord[]>("/api/v1/nodes"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load nodes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createNode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
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

  async function copyConfiguration() {
    if (!configuration) return;
    try {
      await navigator.clipboard.writeText(configuration);
      setNotice("Enrollment configuration copied. Treat it as a secret.");
    } catch {
      setNotice("Clipboard unavailable. Copy the configuration manually.");
    }
  }

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: 24, color: "var(--text-primary, inherit)" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1>Node Management</h1>
          <p>Register infrastructure nodes and securely enroll them into your organization.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh nodes"}
        </button>
      </header>

      {error && <p role="alert" style={{ color: "#dc2626" }}>{error}</p>}
      {notice && <p role="status">{notice}</p>}

      <section style={{ border: "1px solid #64748b55", borderRadius: 12, padding: 20, marginTop: 20 }}>
        <h2>Register a node</h2>
        <form onSubmit={createNode} style={{ display: "grid", gap: 12, maxWidth: 520 }}>
          <label>
            Node name
            <input required minLength={2} maxLength={100} value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. production-node-01"
              style={{ display: "block", width: "100%", padding: 10, marginTop: 5 }} />
          </label>
          <label>
            Environment
            <select value={environment} onChange={e => setEnvironment(e.target.value)}
              style={{ display: "block", width: "100%", padding: 10, marginTop: 5 }}>
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="development">Development</option>
            </select>
          </label>
          <label>
            Region
            <input value={region} onChange={e => setRegion(e.target.value)}
              placeholder="auto"
              style={{ display: "block", width: "100%", padding: 10, marginTop: 5 }} />
          </label>
          <button type="submit" disabled={saving || loading || !organizationId || !name.trim()}>
            {saving ? "Registering…" : "Register node"}
          </button>
        </form>
      </section>

      {created && (
        <section style={{ border: "1px solid #0d948855", borderRadius: 12, padding: 20, marginTop: 20 }}>
          <h2>Node registered</h2>
          <p>Node ID: <code>{created.id}</code></p>
          <p>Status: {created.status}</p>
          <p><strong>One-time enrollment token</strong> — keep it private. It cannot be retrieved again after leaving this screen.</p>
          <label>
            Enrollment configuration
            <textarea readOnly rows={4} value={configuration}
              style={{ display: "block", width: "100%", padding: 10, marginTop: 8, fontFamily: "monospace" }} />
          </label>
          <button type="button" onClick={() => void copyConfiguration()}>
            Copy enrollment configuration
          </button>
          <p>Use these variables in the node process environment, then start the node engine. Do not commit the token or paste it into logs.</p>
        </section>
      )}

      <section style={{ marginTop: 28 }}>
        <h2>Registered nodes ({nodes.length})</h2>
        {loading ? <p>Loading nodes…</p> : nodes.length === 0 ? (
          <p>No nodes registered yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Name", "Environment", "Region", "Status", "Last seen", "Node ID"].map(label => (
                    <th key={label} style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #64748b55" }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nodes.map(node => (
                  <tr key={node.id}>
                    <td style={{ padding: 10 }}>{node.name}</td>
                    <td style={{ padding: 10 }}>{node.environment ?? "—"}</td>
                    <td style={{ padding: 10 }}>{node.region ?? "—"}</td>
                    <td style={{ padding: 10 }}>{node.status}</td>
                    <td style={{ padding: 10 }}>{node.last_seen_at ?? "Never"}</td>
                    <td style={{ padding: 10 }}><code>{node.id}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
