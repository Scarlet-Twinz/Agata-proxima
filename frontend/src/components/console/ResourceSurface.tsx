import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, BookOpen } from "lucide-react";
import { api } from "../../api/client";

type Field = { key: string; label: string; placeholder?: string; type?: "text" | "select" | "textarea"; options?: { label: string; value: string }[] };

type Props = {
  title: string;
  eyebrow: string;
  description: string;
  docsHref?: string;
  docsLabel?: string;
  links?: { label: string; href: string }[];
  endpoint?: string;
  createEndpoint?: string;
  createFields?: Field[];
  createDefaults?: Record<string, string>;
  transformCreate?: (values: Record<string, string>, organizationId: string) => unknown;
};

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function ResourceSurface({
  title,
  eyebrow,
  description,
  docsHref,
  docsLabel = "Read full documentation",
  links = [],
  endpoint,
  createEndpoint,
  createFields = [],
  createDefaults = {},
  transformCreate,
}: Props) {
  const { tenantId, policyId, nodeId, deploymentId, runId, eventId } = useParams();
  const resourceId = tenantId ?? policyId ?? nodeId ?? deploymentId ?? runId ?? eventId;
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [values, setValues] = useState<Record<string, string>>(createDefaults);
  const [loading, setLoading] = useState(Boolean(endpoint));
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!endpoint) return;
    setLoading(true);
    api.get<Record<string, unknown>[]>(endpoint)
      .then((data) => setRecords(Array.isArray(data) ? data : [data]))
      .catch((e) => setError(e instanceof Error ? e.message : "Unable to load resource state."))
      .finally(() => setLoading(false));
  }, [endpoint]);

  useEffect(() => {
    if (!createEndpoint) return;
    api.get<{ organization_id: string }>("/api/v1/session")
      .then((session) => setOrganizationId(session.organization_id))
      .catch(() => setOrganizationId(""));
  }, [createEndpoint]);

  const columns = useMemo(() => {
    const preferred = ["name", "status", "role", "project", "environment", "version", "kind", "mode", "verification_status", "priority", "action", "created_at"];
    const keys = new Set<string>();
    records.forEach((record) => Object.keys(record).forEach((key) => keys.add(key)));
    return [...preferred.filter((key) => keys.has(key)), ...[...keys].filter((key) => !preferred.includes(key))].slice(0, 8);
  }, [records]);

  function setValue(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!createEndpoint) return;
    setError("");
    setCreating(true);
    try {
      const payload = transformCreate
        ? transformCreate(values, organizationId)
        : { ...values, organization_id: organizationId };
      const created = await api.post<Record<string, unknown>>(createEndpoint, payload);
      setRecords((current) => [created, ...current]);
      setValues(createDefaults);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create resource.");
    } finally {
      setCreating(false);
    }
  }

  return <div className="resource-page">
    <Link className="back-link" to="/app"><ArrowLeft size={16}/> Command Center</Link>
    <div className="page-heading">
      <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
      {docsHref && <Link className="agata-button agata-button-secondary" to={docsHref}><BookOpen size={16}/>{docsLabel}</Link>}
    </div>
    {resourceId && <div className="resource-identity"><span>Resource</span><strong>{resourceId}</strong></div>}

    {createEndpoint && <section className="surface">
      <span className="eyebrow">ACTION</span>
      <h2>Create resource</h2>
      <form className="customer-form" onSubmit={create}>
        {createFields.map((field) => field.type === "select" ? (
          <select key={field.key} aria-label={field.label} value={values[field.key] ?? ""} onChange={(e) => setValue(field.key, e.target.value)}>
            <option value="">{field.label}</option>
            {(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        ) : field.type === "textarea" ? (
          <textarea key={field.key} aria-label={field.label} value={values[field.key] ?? ""} onChange={(e) => setValue(field.key, e.target.value)} placeholder={field.placeholder} rows={4} />
        ) : (
          <input key={field.key} aria-label={field.label} value={values[field.key] ?? ""} onChange={(e) => setValue(field.key, e.target.value)} placeholder={field.placeholder ?? field.label} />
        ))}
        <button type="submit" disabled={creating || !organizationId}>{creating ? "Creating…" : "Create"}</button>
      </form>
      {error && <p role="alert" className="customer-error">{error}</p>}
    </section>}

    <div className="resource-layout">
      <section className="surface">
        <span className="eyebrow">CONTROL PLANE</span>
        <h2>{endpoint ? "Current resource state" : "Operating surface"}</h2>
        {endpoint ? (
          loading ? <div className="empty-state"><strong>Loading resource state…</strong><span>Reading the authenticated organization-scoped API.</span></div> :
          error && !createEndpoint ? <div className="empty-state"><strong>Resource state unavailable.</strong><span>{error}</span></div> :
          records.length ? <div className="resource-records">
            {records.map((record, index) => <div className="customer-row" key={String(record.id ?? index)}>
              {columns.map((column) => <span key={column}><strong>{column.replaceAll("_", " ")}</strong> {displayValue(record[column])}</span>)}
            </div>)}
          </div> :
          <div className="empty-state"><strong>No records yet.</strong><span>The backend returned an empty collection. Create a resource above when this surface supports creation.</span></div>
        ) : (
          <div className="empty-state"><strong>No direct resource feed configured.</strong><span>This page is documentation/navigation only until its backend contract is exposed.</span></div>
        )}
        {docsHref && <Link className="public-inline-link" to={docsHref}>Understand this resource <ArrowUpRight size={15}/></Link>}
      </section>
      <aside className="surface resource-links">
        <span className="eyebrow">RELATED</span>
        {links.map(link => <Link key={link.href} to={link.href}>{link.label}<ArrowUpRight size={16}/></Link>)}
      </aside>
    </div>
  </div>;
}
