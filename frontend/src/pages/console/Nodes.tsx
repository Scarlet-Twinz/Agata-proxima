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

async function copyText(text: string): Promise<void> {
  if (!text) throw new Error("There is nothing to copy.");

  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Fall through to the compatibility path for browsers that block Clipboard API.
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!copied) throw new Error("Your browser blocked clipboard access. Select and copy the text manually.");
}

export function Nodes() {
  const [nodes, setNodes] = useState<NodeRecord[]>([]);
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState("production");
  const [region, setRegion] = useState("auto");
  const [organizationId, setOrganizationId] = useState("");
  const [created, setCreated] = useState<CreatedNode | null>(null);
  const [secretAcknowledged, setSecretAcknowledged] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState<"token" | "configuration" | null>(null);
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
    setSecretAcknowledged(false);

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

  async function copySecret(kind: "token" | "configuration") {
    if (!created || secretAcknowledged) return;
    setCopying(kind);
    setError("");
    setNotice("");
    try {
      await copyText(kind === "token" ? created.enrollment_token : configuration);
      setNotice(kind === "token"
        ? "Enrollment token copied. Keep it secret."
        : "Enrollment configuration copied. Keep it secret.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Clipboard unavailable. Select and copy the text manually.");
    } finally {
      setCopying(null);
    }
  }

  function acknowledgeSecretCopied() {
    setCreated(current => current ? { ...current, enrollment_token: "" } : current);
    setSecretAcknowledged(true);
    setNotice("Secret hidden. It cannot be displayed again from this screen.");
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
          {secretAcknowledged ? (
            <p role="status">Enrollment secret hidden after confirmation. Save the credentials securely before leaving this screen; they cannot be retrieved again.</p>
          ) : (
            <>
              <p><strong>One-time enrollment token</strong> — copy it now and keep it private. It cannot be retrieved again after leaving this screen.</p>
              <label>
                Enrollment token
                <textarea
                  readOnly
                  rows={2}
                  value={created.enrollment_token}
                  onFocus={event => event.currentTarget.select()}
                  style={{ display: "block", width: "100%", padding: 10, marginTop: 8, fontFamily: "monospace", overflowWrap: "anywhere" }}
                  aria-label="One-time enrollment token"
                />
              </label>
              <button type="button" onClick={() => void copySecret("token")} disabled={copying !== null}>
                {copying === "token" ? "Copying token…" : "Copy token only"}
              </button>
              <label style={{ display: "block", marginTop: 12 }}>
                Enrollment configuration
                <textarea readOnly rows={4} value={configuration}
                  onFocus={event => event.currentTarget.select()}
                  style={{ display: "block", width: "100%", padding: 10, marginTop: 8, fontFamily: "monospace" }} />
              </label>
              <button type="button" onClick={() => void copySecret("configuration")} disabled={copying !== null}>
                {copying === "configuration" ? "Copying configuration…" : "Copy enrollment configuration"}
              </button>
              <p>Use these variables in the node process environment, then start the node engine. Do not commit the token or paste it into logs.</p>
              <button type="button" onClick={acknowledgeSecretCopied}>
                I have copied and saved the credentials — hide secret
              </button>
              <p><small>After confirming, the token and configuration will be removed from this screen and cannot be shown again.</small></p>
            </>
          )}
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
