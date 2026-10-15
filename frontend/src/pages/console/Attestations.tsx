import { useQuery } from "@tanstack/react-query";
import { Download, RefreshCw, ShieldCheck, ShieldAlert } from "lucide-react";
import { api } from "../../api/client";

type Attestation = {
  id: string;
  node_id: string;
  epoch_timestamp_start: string;
  epoch_timestamp_end: string;
  total_processed_queries: number;
  authenticated_tenant_sessions: number;
  blocked_unauthorized_violations: number;
  p99_latency_overhead_ms: number;
  force_rls_active: boolean | null;
  tls_termination_enforced: boolean | null;
  circuit_breaker_tripped: boolean | null;
  previous_block_hash: string;
  block_hash_signature: string;
  signature_valid: boolean;
};

function pdfEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[^\x20-\x7E]/g, "?");
}

function buildPdf(lines: string[]) {
  const visible = lines.slice(0, 42);
  const stream = ["BT", "/F1 10 Tf", "48 754 Td", ...visible.flatMap((line, index) => index ? ["0 -16 Td", `(${pdfEscape(line)}) Tj`] : [`(${pdfEscape(line)}) Tj`]), "ET"].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(new TextEncoder().encode(pdf).length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

export function Attestations() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["attestations"],
    queryFn: () => api.get<{ attestations: Attestation[]; status: string }>("/api/v1/attestations"),
    staleTime: 15_000,
    refetchInterval: 60_000,
    retry: false,
  });
  const attestations = data?.attestations ?? [];
  const downloadPdf = () => {
    const lines = [
      "AGATA PROXIMA - SECURITY ATTESTATION REPORT",
      `Generated: ${new Date().toISOString()}`,
      `Workspace attestation records: ${attestations.length}`,
      "Integrity note: a record is verified only when its signature_valid value is true.",
      "",
      ...attestations.flatMap((item, index) => [
        `${index + 1}. Node: ${item.node_id} | Period: ${item.epoch_timestamp_start} - ${item.epoch_timestamp_end}`,
        `   Signature verified: ${item.signature_valid ? "YES" : "NO"} | RLS: ${item.force_rls_active === null ? "UNKNOWN" : item.force_rls_active ? "ACTIVE" : "INACTIVE"} | TLS: ${item.tls_termination_enforced === null ? "UNKNOWN" : item.tls_termination_enforced ? "ENFORCED" : "NOT ENFORCED"}`,
        `   Queries: ${item.total_processed_queries} | Tenant sessions: ${item.authenticated_tenant_sessions} | Blocked violations: ${item.blocked_unauthorized_violations} | P99 overhead ms: ${item.p99_latency_overhead_ms}`,
        `   Previous hash: ${item.previous_block_hash || "GENESIS"}`,
        `   Block hash: ${item.block_hash_signature}`,
        "",
      ]),
    ];
    const url = URL.createObjectURL(buildPdf(lines));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `agata-proxima-attestation-${new Date().toISOString().slice(0, 10)}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="resource-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">PROXIMA ATTEST</span>
          <h1>Security attestations</h1>
          <p>Time-bounded security evidence, linked hashes, and verifiable export for your workspace.</p>
        </div>
        <div className="page-actions">
          <button className="secondary-button" type="button" onClick={() => void refetch()} disabled={isFetching}><RefreshCw size={16} /> Refresh</button>
          <button className="primary-button" type="button" onClick={downloadPdf} disabled={!attestations.length}><Download size={16} /> Download PDF</button>
        </div>
      </div>
      <section className="resource-panel">
        {isLoading ? <p>Loading signed evidence…</p> : isError ? <div role="alert"><ShieldAlert size={20} /><p>Attestation service is unavailable. No evidence has been assumed or fabricated.</p></div> : attestations.length === 0 ? (
          <div className="empty-state"><ShieldCheck size={28} /><h2>No attestation blocks yet</h2><p>Verified reports appear after an engine node has submitted a signed telemetry epoch. This page does not manufacture security evidence when telemetry is missing.</p></div>
        ) : (
          <div className="resource-list">{attestations.map((item) => <article className="resource-list-item" key={item.id}>
            <div><strong>{item.node_id}</strong><p>{item.epoch_timestamp_start} — {item.epoch_timestamp_end}</p><small>Hash: {item.block_hash_signature}</small></div>
            <span className={item.signature_valid ? "status-pill status-pill--healthy" : "status-pill status-pill--danger"}>{item.signature_valid ? "Verified" : "Invalid signature"}</span>
          </article>)}</div>
        )}
      </section>
    </div>
  );
}
