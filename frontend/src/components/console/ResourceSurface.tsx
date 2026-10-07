import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type Props = {
  title: string;
  eyebrow: string;
  description: string;
  endpoint?: string;
  links?: { label: string; href: string }[];
  sections?: { title: string; text: string; href?: string }[];
};

function formatValue(value: JsonValue): string {
  if (value === null) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

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

export function ResourceSurface({
  title,
  eyebrow,
  description,
  endpoint,
  links = [],
  sections = [],
}: Props) {
  const [data, setData] = useState<JsonValue | null>(null);
  const [loading, setLoading] = useState(Boolean(endpoint));
  const [error, setError] = useState("");

  async function load() {
    if (!endpoint) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const body = (await response.json().catch(() => ({}))) as JsonValue & {
        message?: string;
      };
      if (!response.ok) {
        throw new Error(
          typeof body?.message === "string"
            ? body.message
            : "Request failed (" + response.status + ").",
        );
      }
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load this resource.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [endpoint]);

  const rows = useMemo(() => rowsFrom(data), [data]);
  const columns = useMemo(() => {
    const keys = new Set<string>();
    rows.slice(0, 12).forEach((row) =>
      Object.keys(row).forEach((key) => keys.add(key)),
    );
    return Array.from(keys).slice(0, 8);
  }, [rows]);

  return (
    <div className="resource-page">
      <Link className="back-link" to="/app">
        <ArrowLeft size={16} />
        Command Center
      </Link>

      <div className="page-heading">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {endpoint && (
          <button
            className="console-refresh-button"
            type="button"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? "is-spinning" : ""} />
            Refresh
          </button>
        )}
      </div>

      {sections.length > 0 && (
        <div className="resource-section-grid">
          {sections.map((section) => (
            <div className="surface resource-info-card" key={section.title}>
              <span className="eyebrow">CONFIGURATION</span>
              <h2>{section.title}</h2>
              <p>{section.text}</p>
              {section.href && (
                <Link className="public-inline-link" to={section.href}>
                  Open {section.title} <ArrowUpRight size={15} />
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      {endpoint && (
        <section className="surface resource-data-surface">
          <div className="resource-data-heading">
            <div>
              <span className="eyebrow">LIVE CONTROL-PLANE DATA</span>
              <h2>
                {loading
                  ? "Loading current state…"
                  : error
                    ? "Unable to load current state"
                    : rows.length
                      ? rows.length + " record" + (rows.length === 1 ? "" : "s") + " returned"
                      : "No records yet"}
              </h2>
            </div>
          </div>

          {loading && (
            <div className="empty-state">
              <strong>Loading live data…</strong>
              <span>Reading the authenticated control-plane endpoint.</span>
            </div>
          )}

          {!loading && error && (
            <div className="empty-state resource-error">
              <strong>{error}</strong>
              <span>Check the backend, database connection and authenticated session, then refresh.</span>
            </div>
          )}

          {!loading && !error && rows.length === 0 && (
            <div className="empty-state">
              <strong>No records have been created yet.</strong>
              <span>This is a real empty state, not placeholder telemetry. Create the first resource and return here to see it.</span>
            </div>
          )}

          {!loading && !error && rows.length > 0 && (
            <div className="resource-table-wrap">
              <table className="resource-table">
                <thead>
                  <tr>
                    {columns.map((column) => (
                      <th key={column}>{column.replaceAll("_", " ")}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={String(row.id ?? row.key ?? index)}>
                      {columns.map((column) => (
                        <td key={column}>{formatValue(row[column])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {links.length > 0 && (
        <aside className="surface resource-links">
          <span className="eyebrow">RELATED</span>
          {links.map((link) => (
            <Link key={link.href} to={link.href}>
              {link.label}
              <ArrowUpRight size={16} />
            </Link>
          ))}
        </aside>
      )}
    </div>
  );
}
