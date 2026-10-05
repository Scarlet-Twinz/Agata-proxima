import { ArrowRight, Eye, EyeOff, ShieldCheck, KeyRound } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import type { FormEvent } from "react";
import { login as loginRequest } from "../../api/auth";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await loginRequest(email.trim(), password);
      const destination = (location.state as { from?: string } | null)?.from ?? "/app";
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="agata-auth-form">
      <div className="auth-form-heading">
        <div className="auth-form-mark"><ShieldCheck size={19} /></div>
        <span className="auth-kicker auth-kicker-dark">SIGN IN</span>
        <h2>Welcome back.</h2>
        <p>Sign in to your Proxima workspace and manage your tenant security boundary.</p>
      </div>

      <form className="agata-form" onSubmit={handleSubmit}>
        <div className="agata-field">
          <label htmlFor="login-email">Work email</label>
          <input id="login-email" name="email" type="email" placeholder="you@company.com" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>

        <div className="agata-field">
          <div className="agata-field-label-row">
            <label htmlFor="login-password">Password</label>
            <Link to="/recovery">Forgot password?</Link>
          </div>
          <div className="auth-password-field">
            <input id="login-password" name="password" type={showPassword ? "text" : "password"} placeholder="Enter your password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
            <button type="button" className="auth-password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>

        <label className="auth-check">
          <input type="checkbox" checked={keepSignedIn} onChange={(event) => setKeepSignedIn(event.target.checked)} />
          <span>Keep me signed in on this device</span>
        </label>

        {error && <div className="auth-form-error" role="alert">{error}</div>}

        <button className="auth-submit" type="submit" disabled={submitting}>
          <span>{submitting ? "Signing in…" : "Sign in to Proxima"}</span>
          <ArrowRight size={17} />
        </button>
      </form>

      <div className="auth-separator"><span>OR</span></div>
      <button className="auth-sso" type="button" disabled><KeyRound size={17} /><span>Continue with SSO</span></button>

      <div className="auth-switch">
        <span>New to Agata?</span>
        <Link to="/signup">Create a workspace</Link>
      </div>
      <p className="auth-note">By signing in, you access your organization's Proxima control plane.</p>
    </div>
  );
}
