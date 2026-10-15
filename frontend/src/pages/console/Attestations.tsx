import { useQuery } from "@tanstack/react-query";
import { Download, RefreshCw, ShieldCheck, ShieldAlert } from "lucide-react";
import { api } from "../../api/client";

type Attestation = {
  id: string;
  node_id: string;
  epoch_timestamp_start: number;
  epoch_timestamp_end: number;
  total_processed_queries: number;
  authenticated_tenant_sessions: number;
  blocked_unauthorized_violations: number;
  p99_latency_overhead_ms: number | null;
  force_rls_active: boolean | null;
  tls_termination_enforced: boolean | null;
  circuit_breaker_tripped: boolean | null;
  previous_block_hash: string;
  block_hash_signature: string;
  signature_algorithm: string;
  signing_key_id: string;
  signature_hex: string;
  organization_id: string;
  signature_valid: boolean;
  chain_link_valid: boolean | null;
};

function formatEpoch(value: number) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 8_640_000_000_000) {
    return "INVALID EPOCH";
  }
  const date = new Date(value * 1000);
  return Number.isNaN(date.getTime()) ? "INVALID EPOCH" : date.toISOString();
}

function pdfEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[^\x20-\x7E]/g, "?");
}

function buildPdf(lines: string[]) {
  const wrappedLines = lines.flatMap((line) => {
    if (!line) return [""];
    const chunks: string[] = [];
    let remaining = line;
    while (remaining.length > 96) {
      let splitAt = remaining.lastIndexOf(" ", 96);
      if (splitAt < 1) splitAt = 96;
      chunks.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt).trimStart();
    }
    chunks.push(remaining);
    return chunks;
  });
  const pages: string[][] = [];
  for (let index = 0; index < wrappedLines.length; index += 42) {
    pages.push(wrappedLines.slice(index, index + 42));
  }
  if (!pages.length) pages.push(["No attestation evidence available."]);
  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  const pageIds = pages.map((_, index) => 4 + index * 2);
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  pages.forEach((pageLines, index) => {
    const pageId = 4 + index * 2;
    const contentId = pageId + 1;
    const stream = [
      "BT",
      "/F1 9 Tf",
      "48 754 Td",
      ...pageLines.flatMap((line, lineIndex) => lineIndex ? ["0 -16 Td", `(${pdfEscape(line)}) Tj`] : [`(${pdfEscape(line)}) Tj`]),
      "ET",
    ].join("\n");
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`;
  });
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = new TextEncoder().encode(pdf).length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
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
  const downloadJson = () => {
    const payload = {
      status: data?.status ?? "unknown",
      exported_at: new Date().toISOString(),
      attestations,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `agata-proxima-attestations-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadPdf = () => {
    const lines = [
      "AGATA PROXIMA - SECURITY ATTESTATION REPORT",
      `Generated: ${new Date().toISOString()}`,
      `Workspace attestation records: ${attestations.length}`,
      "Integrity note: a record is fully verified only when both its signature and available chain link validate.",
      "",
      ...(attestations.length
        ? attestations.flatMap((item, index) => [
            `${index + 1}. Node: ${item.node_id} | Period: ${formatEpoch(item.epoch_timestamp_start)} - ${formatEpoch(item.epoch_timestamp_end)}`,
            `   Signature verified: ${item.signature_valid ? "YES" : "NO"} | Chain link: ${item.chain_link_valid === null ? "UNKNOWN (truncated history)" : item.chain_link_valid ? "VALID" : "INVALID"} | RLS: ${item.force_rls_active === null ? "UNKNOWN" : item.force_rls_active ? "ACTIVE" : "INACTIVE"} | TLS: ${item.tls_termination_enforced === null ? "UNKNOWN" : item.tls_termination_enforced ? "ENFORCED" : "NOT ENFORCED"}`,
            `   Query/Execute messages forwarded: ${item.total_processed_queries} | Tenant sessions: ${item.authenticated_tenant_sessions} | Blocked violations: ${item.blocked_unauthorized_violations} | P99 overhead ms: ${item.p99_latency_overhead_ms === null ? "UNKNOWN" : item.p99_latency_overhead_ms}`,
            `   Previous hash: ${item.previous_block_hash || "GENESIS"}`,
            `   Block hash: ${item.block_hash_signature}`,
            `   Signature: ${item.signature_algorithm} | Key ID: ${item.signing_key_id}`,
            `   HMAC signature: ${item.signature_hex}`,
            "",
          ])
        : ["No attestation evidence has been submitted. This report contains no verified security evidence."]),
    ];
    const url = URL.createObjectURL(buildPdf(lines));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `agata-proxima-attestation-${new Date().toISOString().slice(0, 10)}.pdf`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
          <button className="secondary-button" type="button" onClick={downloadJson} disabled={isLoading || isError}><Download size={16} /> Download JSON</button>
          <button className="primary-button" type="button" onClick={downloadPdf} disabled={isLoading || isError}><Download size={16} /> Download PDF</button>
        </div>
      </div>
      <section className="resource-panel">
        {isLoading ? <p>Loading signed evidence…</p> : isError ? <div role="alert"><ShieldAlert size={20} /><p>Attestation service is unavailable. No evidence has been assumed or fabricated.</p></div> : attestations.length === 0 ? (
          <div className="empty-state"><ShieldCheck size={28} /><h2>No attestation blocks yet</h2><p>Verified reports appear after an engine node has submitted a signed telemetry epoch. This page does not manufacture security evidence when telemetry is missing.</p></div>
        ) : (
          <div className="resource-list">{attestations.map((item) => <article className="resource-list-item" key={item.id}>
            <div><strong>{item.node_id}</strong><p>{formatEpoch(item.epoch_timestamp_start)} — {formatEpoch(item.epoch_timestamp_end)}</p><small>Hash: {item.block_hash_signature}</small></div>
            <span className={item.signature_valid && item.chain_link_valid === true ? "status-pill status-pill--healthy" : "status-pill status-pill--danger"}>{!item.signature_valid || item.chain_link_valid === false ? "Integrity issue" : item.chain_link_valid === null ? "Chain history unknown" : "Verified"}</span>
          </article>)}</div>
        )}
      </section>
    </div>
  );
}
