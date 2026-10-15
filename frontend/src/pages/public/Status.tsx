import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, CircleAlert, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { PublicPage } from "../../components/layout/PublicPage";

type HealthResponse = {
  status?: string;
  control_plane?: string;
  data_plane_authority?: string;
  control_plane_coupling?: string;
};

export function Status() {
  const health = useQuery({
    queryKey: ["public-service-status"],
    queryFn: () => api.get<HealthResponse>("/api/v1/health"),
    refetchInterval: 60_000,
    retry: 1,
  });
  const healthy = health.data?.status === "ok" && health.data?.control_plane === "healthy";
  const state = health.isPending ? "Checking" : healthy ? "Operational" : "Attention required";
  return <PublicPage eyebrow="Service status" title="Agata Proxima service status." description="Check the live control-plane health signal and open the relevant operational view for the rest of the platform.">
    <section className="public-content"><div className="agata-container"><div className="public-prose">
      <div className="public-callout" role="status" aria-live="polite">
        {healthy ? <CheckCircle2 size={22} aria-hidden="true"/> : <CircleAlert size={22} aria-hidden="true"/>}
        <div><strong>{health.isError ? "Status check unavailable" : state}</strong><p>{health.isPending ? "Checking the control-plane API and its database connection." : healthy ? "The control-plane health endpoint reports that the API and its database connection are healthy." : "The latest health check did not confirm a healthy control plane. Use the service links below to investigate."}</p></div>
        <button type="button" className="agata-button agata-button-secondary" onClick={() => void health.refetch()} disabled={health.isFetching}><RefreshCw size={15}/>{health.isFetching ? "Refreshing" : "Refresh"}</button>
      </div>
      <div className="public-status-row"><div className="public-status-name">Control plane API</div><div className={healthy ? "public-status-good" : "public-status-pending"}>{health.isPending ? "Checking" : healthy ? "Operational" : "Check required"}</div><div className="public-status-detail">Live result from `GET /api/v1/health`, refreshed every 60 seconds.</div></div>
      <div className="public-status-row"><div className="public-status-name">Control-plane database</div><div className={healthy ? "public-status-good" : "public-status-pending"}>{health.isPending ? "Checking" : healthy ? "Operational" : "Check required"}</div><div className="public-status-detail">The health endpoint executes a database query and reports whether the control-plane database is reachable.</div></div>
      <div className="public-status-row"><div className="public-status-name">Proxima Engine</div><div className="public-status-pending">Check fleet health</div><div className="public-status-detail">Engine and node health are environment-specific runtime signals. Review the authenticated fleet and deployment views for the target environment.</div></div>
      <div className="public-status-row"><div className="public-status-name">Webhook delivery</div><div className="public-status-pending">Review deliveries</div><div className="public-status-detail">Use endpoint delivery history to inspect attempts, responses, retries and dead-letter outcomes.</div></div>
      <h2>Investigate an issue</h2><ol><li>Refresh the public health signal.</li><li>Check the target environment's hosting and database logs.</li><li>Review recent deployments and audit events.</li><li>For a webhook, inspect the endpoint's delivery history and receiver response.</li><li>For sign-in or email, reproduce the relevant workflow and capture the timestamp and sanitized request details.</li></ol>
      <div className="public-detail-links"><Link to="/docs/operations" className="agata-button agata-button-secondary">Operations guide <ArrowRight size={15}/></Link><Link to="/docs/troubleshooting" className="agata-button agata-button-secondary">Troubleshooting <ArrowRight size={15}/></Link><Link to="/app" className="agata-button agata-button-secondary">Open dashboard <ArrowRight size={15}/></Link><Link to="/support/request" className="agata-button agata-button-primary">Get support <ArrowRight size={15}/></Link></div>
    </div></div></section>
  </PublicPage>;
}
