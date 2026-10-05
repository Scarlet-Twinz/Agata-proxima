import {
  ArrowRight,
  CheckCircle2,
  Database,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";

export default function ConsoleOverview() {
  return (
    <>
      <div className="console-page-heading">
        <div>
          <h1>Command Center</h1>
          <p>
            Monitor tenant isolation, enforcement boundaries, and verification
            across your infrastructure.
          </p>
        </div>

        <div className="console-env">
          <span className="console-env-dot" />
          Production
        </div>
      </div>

      <div className="console-command-bar">
        <ShieldCheck size={16} />
        <span>Search tenants, policies, nodes, or verification events...</span>
        <span className="console-command-key">? K</span>
      </div>

      <section className="console-panel" style={{ marginBottom: 20 }}>
        <div className="console-metric-row">
          <div className="console-metric">
            <div className="console-metric-label">Tenants protected</div>
            <div className="console-metric-value">24</div>
            <div className="console-metric-note">Across production</div>
          </div>

          <div className="console-metric">
            <div className="console-metric-label">Proxima nodes</div>
            <div className="console-metric-value">12</div>
            <div className="console-metric-note">All registered nodes</div>
          </div>

          <div className="console-metric">
            <div className="console-metric-label">Active policies</div>
            <div className="console-metric-value">18</div>
            <div className="console-metric-note">Current policy set</div>
          </div>

          <div className="console-metric">
            <div className="console-metric-label">Verification</div>
            <div className="console-metric-value">99.98%</div>
            <div className="console-metric-note">Last 30 days</div>
          </div>
        </div>
      </section>

      <div className="console-overview-grid">
        <section className="console-panel">
          <div className="console-panel-header">
            <h2>Tenant protection</h2>
            <span>Production</span>
          </div>

          <table className="console-table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Environment</th>
                <th>Protection</th>
                <th>Node</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td className="console-table-primary">Acme Commerce</td>
                <td>Production</td>
                <td>
                  <span className="console-pill console-pill-success">
                    Protected
                  </span>
                </td>
                <td>eu-west-1</td>
              </tr>

              <tr>
                <td className="console-table-primary">Northstar</td>
                <td>Production</td>
                <td>
                  <span className="console-pill console-pill-success">
                    Protected
                  </span>
                </td>
                <td>us-east-1</td>
              </tr>

              <tr>
                <td className="console-table-primary">Atlas Cloud</td>
                <td>Staging</td>
                <td>
                  <span className="console-pill console-pill-warning">
                    Review
                  </span>
                </td>
                <td>us-east-2</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="console-panel">
          <div className="console-panel-header">
            <h2>Recent security activity</h2>
            <Link
              to="/app/audit"
              style={{
                color: "#176bff",
                textDecoration: "none",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              View audit
            </Link>
          </div>

          <div className="console-panel-body">
            <div className="console-activity">
              <div className="console-activity-row">
                <span className="console-activity-dot" />
                <div className="console-activity-main">
                  <strong>Verification passed</strong>
                  <span>Tenant context matched policy</span>
                </div>
                <span className="console-activity-time">2m</span>
              </div>

              <div className="console-activity-row">
                <span className="console-activity-dot" />
                <div className="console-activity-main">
                  <strong>Policy deployed</strong>
                  <span>Production policy v18</span>
                </div>
                <span className="console-activity-time">8m</span>
              </div>

              <div className="console-activity-row">
                <span className="console-activity-dot" />
                <div className="console-activity-main">
                  <strong>Node enrolled</strong>
                  <span>eu-west-1 / proxima-07</span>
                </div>
                <span className="console-activity-time">21m</span>
              </div>

              <div className="console-activity-row">
                <span className="console-activity-dot" />
                <div className="console-activity-main">
                  <strong>Tenant enrolled</strong>
                  <span>Acme Commerce</span>
                </div>
                <span className="console-activity-time">34m</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="console-panel" style={{ marginTop: 20 }}>
        <div className="console-panel-header">
          <h2>Protection topology</h2>
          <span>Conceptual control path</span>
        </div>

        <div className="console-panel-body">
          <div className="console-topology">
            <div className="console-topology-node">
              <strong>Customer Application</strong>
              <span>
                Tenant-aware workloads generate authenticated requests.
              </span>
            </div>

            <div className="console-topology-arrow">
              <ArrowRight size={22} />
            </div>

            <div className="console-topology-node">
              <strong>Proxima Boundary</strong>
              <span>
                Tenant context is enforced before database access.
              </span>
            </div>

            <div className="console-topology-arrow">
              <ArrowRight size={22} />
            </div>

            <div className="console-topology-node">
              <strong>PostgreSQL</strong>
              <span>
                Database roles and RLS provide the final isolation layer.
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="console-panel" style={{ marginTop: 20 }}>
        <div className="console-panel-header">
          <h2>Verification posture</h2>
          <span>Current workspace</span>
        </div>

        <div className="console-panel-body">
          <div className="console-status-line">
            <div className="console-status-left">
              <CheckCircle2 size={16} color="#12b76a" />
              <strong>Tenant isolation enforcement</strong>
            </div>
            <span className="console-status-right">Enabled</span>
          </div>

          <div className="console-status-line">
            <div className="console-status-left">
              <CheckCircle2 size={16} color="#12b76a" />
              <strong>Cross-tenant verification</strong>
            </div>
            <span className="console-status-right">Enforced</span>
          </div>

          <div className="console-status-line">
            <div className="console-status-left">
              <Database size={16} color="#176bff" />
              <strong>Database isolation</strong>
            </div>
            <span className="console-status-right">PostgreSQL / RLS</span>
          </div>
        </div>
      </section>
    </>
  );
}
