import { ArrowRight, Building2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";

export default function Signup() {
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="agata-auth-form">
      <div className="auth-form-heading">
        <div className="auth-form-mark">
          <Building2 size={19} />
        </div>

        <span className="auth-kicker auth-kicker-dark">CREATE WORKSPACE</span>

        <h2>Start with a secure boundary.</h2>

        <p>
          Create your organization workspace and bring your tenant isolation
          infrastructure under one control plane.
        </p>
      </div>

      <form
        className="agata-form"
        onSubmit={(event) => {
          event.preventDefault();
          navigate("/app");
        }}
      >
        <div className="agata-form-split">
          <div className="agata-field">
            <label htmlFor="signup-name">Full name</label>
            <input
              id="signup-name"
              name="name"
              type="text"
              placeholder="Your name"
              autoComplete="name"
            />
          </div>

          <div className="agata-field">
            <label htmlFor="signup-org">Organization</label>
            <input
              id="signup-org"
              name="organization"
              type="text"
              placeholder="Company name"
              autoComplete="organization"
            />
          </div>
        </div>

        <div className="agata-field">
          <label htmlFor="signup-email">Work email</label>
          <input
            id="signup-email"
            name="email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
          />
        </div>

        <div className="agata-field">
          <label htmlFor="signup-password">Password</label>

          <div className="auth-password-field">
            <input
              id="signup-password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Create a strong password"
              autoComplete="new-password"
            />

            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>

        <label className="auth-check">
          <input type="checkbox" />
          <span>
            I agree to the Agata Proxima terms and acknowledge the privacy
            policy.
          </span>
        </label>

        <button className="auth-submit" type="submit">
          <span>Create Proxima workspace</span>
          <ArrowRight size={17} />
        </button>
      </form>

      <div className="auth-security-callout">
        <ShieldCheck size={18} />
        <div>
          <strong>Built around verification</strong>
          <span>
            Your workspace is the starting point for tenant-aware enforcement,
            verification, and audit evidence.
          </span>
        </div>
      </div>

      <div className="auth-switch">
        <span>Already have a workspace?</span>
        <Link to="/login">Sign in</Link>
      </div>
    </div>
  );
}
