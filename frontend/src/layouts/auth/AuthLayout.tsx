import { Outlet } from "react-router-dom";
import { ArrowRight, Check, LockKeyhole } from "lucide-react";
import { AgataLogo } from "../../components/brand/AgataLogo";
import "../../styles/auth.css";

const trustPoints = [
  "Tenant context is explicit",
  "Cross-tenant access is denied",
  "Verification produces evidence",
];

export default function AuthLayout() {
  return (
    <div className="agata-auth">
      <section className="agata-auth-story">
        <div className="agata-auth-story-grid" />

        <div className="agata-auth-story-content">
          <div className="agata-auth-brand">
            <AgataLogo />
          </div>

          <div className="agata-auth-story-main">
            <span className="auth-kicker">PROXIMA CONTROL PLANE</span>

            <h1>
              Your infrastructure.
              <br />
              <span>One verifiable boundary.</span>
            </h1>

            <p className="auth-story-copy">
              Agata Proxima gives your team a clear security boundary between
              tenant identity, application requests, and the database.
            </p>

            <div className="auth-flow">
              <div className="auth-flow-node">
                <span className="auth-flow-index">01</span>
                <strong>Identity</strong>
                <small>Who is making the request</small>
              </div>

              <ArrowRight className="auth-flow-arrow" size={18} />

              <div className="auth-flow-node auth-flow-node-active">
                <span className="auth-flow-index">02</span>
                <strong>Proxima</strong>
                <small>Enforce the tenant boundary</small>
              </div>

              <ArrowRight className="auth-flow-arrow" size={18} />

              <div className="auth-flow-node">
                <span className="auth-flow-index">03</span>
                <strong>Database</strong>
                <small>Reach only what is allowed</small>
              </div>
            </div>
          </div>

          <div className="auth-story-footer">
            <div className="auth-security-line">
              <LockKeyhole size={15} />
              <span>Security boundary designed for infrastructure teams</span>
            </div>

            <div className="auth-trust-list">
              {trustPoints.map((point) => (
                <span key={point}>
                  <Check size={13} />
                  {point}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="agata-auth-panel">
        <div className="agata-auth-panel-inner">
          <div className="auth-mobile-brand">
            <AgataLogo />
          </div>

          <div className="auth-form-frame">
            <Outlet />
          </div>

          <footer className="auth-panel-footer">
            <span>AGATA PROXIMA</span>
            <span>Secure infrastructure control plane</span>
          </footer>
        </div>
      </section>
    </div>
  );
}
