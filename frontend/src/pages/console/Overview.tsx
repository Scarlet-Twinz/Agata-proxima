import { Link } from "react-router-dom";
import { ArrowUpRight, ChevronRight, ShieldCheck } from "lucide-react";
import { ActivityChart } from "../../components/console/charts/ActivityChart";
import { ActivityStream } from "../../components/console/activity/ActivityStream";
import { InfrastructureTopology } from "../../components/console/topology/InfrastructureTopology";
import { useOverview } from "../../hooks/useOverview";

export function Overview() {
  const { data, isLoading, isError, isFetching, dataUpdatedAt } = useOverview();

  const protection = data?.protection;

  return (
    <div className="command-center">
      <div className="page-heading">
        <div>
          <span className="eyebrow">CONTROL PLANE</span>
          <h1>Command Center</h1>
          <p>
            Observe, verify, and operate the tenant-isolation boundary.
          </p>
        </div>

        <div className="live-overview-status"><span className={isFetching ? "live-dot live-dot--syncing" : "live-dot"} />{isFetching ? "Syncing live data" : dataUpdatedAt ? `Live · updated ${new Date(dataUpdatedAt).toLocaleTimeString()}` : "Live telemetry"}</div>

        <div className="heading-actions">
          <Link className="primary-action" to="/app/verification">
            <ShieldCheck size={17} />
            Verification
          </Link>

          <Link className="secondary-action" to="/app/deployments">
            Deployment history
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>

      {isError && (
        <div className="system-notice system-notice--warning">
          <strong>Control-plane telemetry unavailable.</strong>
          <span>
            The interface is connected, but the overview endpoint did not
            return operational data.
          </span>
        </div>
      )}

      <section className="protection-strip">
        <div className="protection-intro">
          <span className="protection-icon">
            <ShieldCheck size={22} />
          </span>

          <div>
            <span>Protection boundary</span>
            <strong>Tenant isolation</strong>
          </div>
        </div>

        {[
          ["Isolation", protection?.tenantIsolation],
          ["Policies", protection?.policyEnforcement],
          ["Verification", protection?.verification],
          ["Database", protection?.databaseProtection],
        ].map(([label, value]) => (
          <div className="protection-state" key={label}>
            <span>{label}</span>
            <strong>{isLoading ? "Loading…" : value ?? "NO DATA"}</strong>
          </div>
        ))}
      </section>

      <div className="command-grid">
        <section className="surface surface--wide">
          <div className="surface-heading">
            <div>
              <span className="eyebrow">VERIFICATION</span>
              <h2>Activity</h2>
            </div>

            <Link to="/app/verification">
              View verification
              <ChevronRight size={16} />
            </Link>
          </div>

          <ActivityChart points={data?.verificationTrend ?? []} />
        </section>

        <section className="surface">
          <div className="surface-heading">
            <div>
              <span className="eyebrow">TENANTS</span>
              <h2>Protection matrix</h2>
            </div>

            <Link to="/app/tenants">
              All tenants
              <ChevronRight size={16} />
            </Link>
          </div>

          <div className="matrix">
            {(data?.tenants ?? []).slice(0, 6).map((tenant) => (
              <Link
                to={`/app/tenants/${tenant.id}`}
                className="matrix-row"
                key={tenant.id}
              >
                <span>{tenant.name}</span>
                <span>{tenant.status}</span>
                <ChevronRight size={15} />
              </Link>
            ))}

            {!data?.tenants?.length && (
              <div className="empty-state">
                <strong>No tenant records available.</strong>
                <span>
                  Tenant protection will appear here after the control plane
                  reports tenant state.
                </span>
              </div>
            )}
          </div>
        </section>

        <section className="surface surface--wide">
          <div className="surface-heading">
            <div>
              <span className="eyebrow">INFRASTRUCTURE</span>
              <h2>Proxima topology</h2>
            </div>

            <Link to="/app/nodes">
              Infrastructure
              <ChevronRight size={16} />
            </Link>
          </div>

          <InfrastructureTopology nodes={data?.nodes ?? []} />
        </section>

        <section className="surface">
          <div className="surface-heading">
            <div>
              <span className="eyebrow">AUDIT</span>
              <h2>Activity stream</h2>
            </div>

            <Link to="/app/audit">
              Open audit
              <ChevronRight size={16} />
            </Link>
          </div>

          <ActivityStream items={data?.recentActivity ?? []} />
        </section>
      </div>
    </div>
  );
}
