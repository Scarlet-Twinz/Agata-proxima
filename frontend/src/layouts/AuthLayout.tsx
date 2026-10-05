import { Outlet } from "react-router-dom";
import { AgataLogo } from "../components/brand/AgataLogo";

export default function AuthLayout() {
  return (
    <div className="auth-shell">
      <section className="auth-visual">
        <div className="auth-visual-content">
          <a href="/" className="auth-logo-link" aria-label="Agata Proxima home">
            <AgataLogo />
          </a>

          <h1>Security boundaries you can verify.</h1>

          <p>
            Agata Proxima gives infrastructure teams an independently
            verifiable boundary for tenant isolation, enforcement,
            verification, and audit evidence.
          </p>

          <div className="auth-boundary">
            <div className="auth-boundary-row">
              <div className="auth-boundary-node">
                <strong>Application</strong>
                <span>Tenant-aware workload</span>
              </div>

              <div className="auth-boundary-arrow">?</div>

              <div className="auth-boundary-node">
                <strong>Proxima</strong>
                <span>Enforcement boundary</span>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-visual-footer">
          Agata Proxima � Tenant isolation infrastructure
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-form-wrap">
          <Outlet />
        </div>
      </section>
    </div>
  );
}

