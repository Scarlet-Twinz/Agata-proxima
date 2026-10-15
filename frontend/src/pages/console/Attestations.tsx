import { useEffect, useState } from "react";
import { Download, FileCheck2, RefreshCw, ShieldCheck } from "lucide-react";
import { api } from "../../api/client";

type Attestation = {
  id: string;
  node_id: string;
  attestation_version: number;
  epoch_timestamp_start: number;
  epoch_timestamp_end: number;
  telemetry_summary: Record<string, number>;
  security_state: Record<string, boolean>;
  previous_block_hash: string;
  block_hash: string;
  block_hash_signature: string;
  verified: boolean;
  created_at: string;
};

function safePdfText(value: unknown): string {
  return String(value ?? "unknown").replace(/[^\x20-\x7E]/g, "?").replace(/([\\()])/g, "\\$1").slice(0, 110);
}

function downloadAttestationPdf(record: Attestation) {
  const lines = [
    "AGATA PROXIMA - SECURITY ATTESTATION",
    "Evidence record. This document is a representation of the signed ledger entry.",
    "",
    `Record ID: ${record.id}`,
    `Node: ${record.node_id}`,
    `Version: ${record.attestation_version}`,
    `Window start (epoch): ${record.epoch_timestamp_start}`,
    `Window end (epoch): ${record.epoch_timestamp_end}`,
    "",
    "TELEMETRY SUMMARY",
    ...Object.entries(record.telemetry_summary ?? {}).map(([key, value]) => `${key}: ${value}`),
    "",
    "SECURITY STATE",
    ...Object.entries(record.security_state ?? {}).map(([key, value]) => `${key}: ${value}`),
    "",
    `Previous block hash: ${record.previous_block_hash}`,
    `Block hash: ${record.block_hash}`,
    `HMAC-SHA256 signature: ${record.block_hash_signature}`,
    "",
    "Verification note: verify this hash and signature against the configured signing key and",
    "the original ledger. This PDF is not, by itself, a compliance certification.",
    `Created at: ${record.created_at}`,
  ].map(safePdfText);

  const commands = ["BT", "/F1 10 Tf", "48 754 Td"];
  lines.forEach((line, index) => {
    if (index > 0) commands.push("0 -16 Td");
    commands.push(`(${line}) Tj`);
  });
  commands.push("ET");
  const stream = commands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `agata-proxima-attestation-${record.node_id.replace(/[^a-zA-Z0-9_-]/g, "_")}-${record.epoch_timestamp_end}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function Attestations() {
  const [records, setRecords] = useState<Attestation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [chainVerified, setChainVerified] = useState(false);

  async function load() {
    setRefreshing(true);
    setError("");
    try {
      const result = await api.get<{ attestations: Attestation[]; chain_verified?: boolean }>("/api/v1/attestations");
      setRecords(result.attestations ?? []);
      setChainVerified(result.chain_verified === true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load attestation evidence.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const latest = records[0];
  return (
    <div className="command-center">
      <div className="page-heading">
        <div>
          <span className="eyebrow">PROXIMA ATTEST</span>
          <h1>Security attestations</h1>
          <p>Review signed security-state records and download a portable PDF evidence report for each ledger entry.</p>
        </div>
        <div className="heading-actions">
          <button className="secondary-action" type="button" onClick={() => void load()} disabled={refreshing}>
            <RefreshCw size={15} /> {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          {latest?.verified && <button className="primary-action" type="button" onClick={() => downloadAttestationPdf(latest)}><Download size={15} /> Latest PDF</button>}
        </div>
      </div>

      {error && <div className="system-notice system-notice--warning"><strong>Evidence service unavailable.</strong><span>{error}</span></div>}

      <section className="overview-metrics" aria-label="Attestation summary">
        <div className="overview-metric"><span className="overview-metric-icon"><FileCheck2 size={18} /></span><span className="overview-metric-copy"><span className="overview-metric-label">Ledger records</span><strong>{loading ? "—" : records.length}</strong><small>Organization-scoped evidence</small></span></div>
        <div className="overview-metric"><span className="overview-metric-icon"><ShieldCheck size={18} /></span><span className="overview-metric-copy"><span className="overview-metric-label">Latest node</span><strong>{loading ? "—" : latest?.node_id ?? "No records"}</strong><small>Most recent attestation</small></span></div>
        <div className="overview-metric"><span className="overview-metric-icon"><FileCheck2 size={18} /></span><span className="overview-metric-copy"><span className="overview-metric-label">Chain verification</span><strong>{loading ? "—" : records.length === 0 ? "No evidence" : chainVerified ? "Verified" : "Needs review"}</strong><small>SHA-256 chain + HMAC signature</small></span></div>
      </section>

      <section className="surface">
        <div className="surface-heading"><div><span className="eyebrow">EVIDENCE LEDGER</span><h2>Attestation history</h2></div><span>{records.length} record(s)</span></div>
        {loading ? <div className="empty-state"><strong>Loading signed evidence…</strong><span>Retrieving attestation records for the active organization.</span></div>
          : records.length === 0 ? <div className="empty-state"><strong>No attestation records yet.</strong><span>Records appear after an engine attestation is signed and ingested by the control plane. Configure the same signing key on the trusted producer and control plane.</span></div>
          : <div className="attestation-list">{records.map((record) => (
            <article className="attestation-row" key={record.id}>
              <div className="attestation-row-main">
                <span className={record.verified ? "attestation-status" : "attestation-status attestation-status--warning"}><ShieldCheck size={15} /> {record.verified ? "Signature verified" : "Verification failed"}</span>
                <h3>{record.node_id}</h3>
                <p>Window {record.epoch_timestamp_start}–{record.epoch_timestamp_end} · {new Date(record.created_at).toLocaleString()}</p>
                <code>{record.block_hash}</code>
              </div>
              <button className="secondary-action" type="button" disabled={!record.verified} onClick={() => downloadAttestationPdf(record)}><Download size={15} /> {record.verified ? "Download PDF" : "PDF disabled: verify first"}</button>
            </article>
          ))}</div>}
      </section>
    </div>
  );
}
