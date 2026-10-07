import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, Plus, RefreshCw, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { api, type ApiError } from "../../api/client";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type Props = {
  title: string;
  eyebrow: string;
  description: string;
  endpoint?: string;
  detailBase?: string;
  createHref?: string;
  createLabel?: string;
  links?: { label: string; href: string }[];
  sections?: { title: string; text: string; href?: string }[];
};

function rowsFrom(value: JsonValue | null): Record<string, JsonValue>[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((item): item is Record<string, JsonValue> =>
      !!item && typeof item === "object" && !Array.isArray(item),
    );
  }
  if (typeof value !== "object") return [];
  const record = value as Record<string, JsonValue>;
  const arrayEntry = Object.values(record).find(Array.isArray);
  if (Array.isArray(arrayEntry)) {
    return arrayEntry.filter((item): item is Record<string, JsonValue> =>
      !!item && typeof item === "object" && !Array.isArray(item),
    );
  }
  return [record];
}

function labelFor(key: string) {
  return key.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function valueFor(value: JsonValue) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") {
    if (Array.isArray(value)) return value.length ? value.map(String).join(", ") : "None";
    return "Structured data";
  }
  if (typeof value === "string" && /_at$|created|updated/i.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString();
  }
  return String(value);
}

function isStatus(value: JsonValue) {
  return typeof value === "string" && /^(active|healthy|degraded|offline|pending|queued|applying|failed|rolled_back|pass|fail|review|running|paid|open|in_progress|resolved|closed|revoked|enabled|disabled)$/i.test(value);
}

export function ResourceSurface({
  title, eyebrow, description, endpoint, detailBase, createHref, createLabel = "Create",
  links = [], sections = [],
}: Props) {
  const [data, setData] = useState<JsonValue | null>(null);
  const [loading, setLoading] = useState(Boolean(endpoint));
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  async function load() {
    if (!endpoint) return;
    setLoading(true);
    setError("");
    try {
      setData(await api.get<JsonValue>(endpoint));
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError?.status === 401) {
        setError("Your secure session is no longer valid. Sign in again to continue.");
      } else if (apiError?.status === 403) {
        setError("Your current role does not have access to this resource.");
      } else {
        setError(err instanceof Error ? err.message : apiError?.message ?? "Unable to load this resource.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [endpoint]);

  const rows = useMemo(() => {
    const normalized = rowsFrom(data);
    const q = query.trim().toLowerCase();
    if (!q) return normalized;
    return normalized.filter((row) => Object.values(row).some((value) => valueFor(value).toLowerCase().includes(q)));
  }, [data, query]);

  const columns = useMemo(() => {
    const keys = new Set<string>();
    rows.slice(0, 20).forEach((row) => Object.keys(row).forEach((key) => keys.add(key)));
    const preferred = ["name","email","status","plan_key","role","environment","region","version","desired_state","observed_state","created_at","updated_at"];
    return [...preferred.filter((key) => keys.has(key)), ...Array.from(keys).filter((key) => !preferred.includes(key))].slice(0, 8);
  }, [rows]);

  return (
    <div className="resource-page">
      <Link className="back-link" to="/app"><ArrowLeft size={16}/> Command Center</Link>

      <div className="page-heading">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="heading-actions">
          {endpoint && <button className="console-refresh-button" type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={15} className={loading ? "is-spinning" : ""}/> {loading ? "Refreshing" : "Refresh"}</button>}
          {createHref && <Link className="primary-action" to={createHref}><Plus size={16}/> {createLabel}</Link>}
        </div>
      </div>

      {sections.length > 0 && (
        <div className="resource-section-grid">
          {sections.map((section) => (
            <Link className="surface resource-info-card resource-info-card--link" key={section.title} to={section.href ?? "#"}>
              <span className="eyebrow">EXPLORE</span>
              <h2>{section.title}<ArrowUpRight size={15}/></h2>
              <p>{section.text}</p>
            </Link>
          ))}
        </div>
      )}

      {endpoint && (
        <section className="surface resource-data-surface">
          <div className="resource-data-heading">
            <div>
              <span className="eyebrow">LIVE CONTROL-PLANE DATA</span>
              <h2>{loading ? "Reading current state…" : error ? "Current state unavailable" : rows.length ? `${rows.length} record${rows.length === 1 ? "" : "s"}` : "No records yet"}</h2>
            </div>
            {!loading && !error && rows.length > 0 && (
              <label className="resource-search"><Search size={15}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter current records" aria-label="Filter records"/></label>
            )}
          </div>

          {loading && <div className="empty-state"><strong>Loading live data…</strong><span>Reading the authenticated control-plane endpoint.</span></div>}
          {!loading && error && <div className="empty-state resource-error"><strong>{error}</strong><span>Refresh after confirming the control plane and secure session are healthy.</span></div>}
          {!loading && !error && rows.length === 0 && <div className="empty-state"><strong>No records have been created yet.</strong><span>This is a real empty state. Use the action above to create the first resource.</span>{createHref && <Link className="primary-action" to={createHref}>Create the first {title.toLowerCase().replace(" registry","")}</Link>}</div>}

          {!loading && !error && rows.length > 0 && (
            <div className="resource-table-wrap">
              <table className="resource-table">
                <thead><tr>{columns.map((column) => <th key={column}>{labelFor(column)}</th>)}{detailBase && <th>Details</th>}</tr></thead>
                <tbody>
                  {rows.map((row, index) => {
                    const id = String(row.id ?? row.key ?? index);
                    return <tr key={id}>
                      {columns.map((column) => {
                        const value = row[column];
                        return <td key={column}>{isStatus(value) ? <span className={`console-status console-status--${String(value).toLowerCase().replaceAll("_","-")}`}>{valueFor(value)}</span> : valueFor(value)}</td>;
                      })}
                      {detailBase && <td><Link className="table-detail-link" to={`${detailBase}/${id}`}>Open <ArrowUpRight size={14}/></Link></td>}
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {links.length > 0 && <aside className="surface resource-links"><span className="eyebrow">RELATED WORKFLOWS</span>{links.map((link) => <Link key={link.href} to={link.href}>{link.label}<ArrowUpRight size={16}/></Link>)}</aside>}
    </div>
  );
}
