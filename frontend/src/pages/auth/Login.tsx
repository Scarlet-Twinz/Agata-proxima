import { ArrowRight, Eye, EyeOff, ShieldCheck, KeyRound } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import type { FormEvent } from "react";
import { login } from "../../api/auth";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/app";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(returnTo.startsWith("/app") ? returnTo : "/app", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in.");
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

      <form className="agata-form" onSubmit={submit}>
        <div className="agata-field">
          <label htmlFor="login-email">Work email</label>
          <input id="login-email" name="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" required />
        </div>
        <div className="agata-field">
          <div className="agata-field-label-row"><label htmlFor="login-password">Password</label><Link to="/recovery">Forgot password?</Link></div>
          <div className="auth-password-field">
            <input id="login-password" name="password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" required />
            <button type="button" className="auth-password-toggle" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
          </div>
        </div>
        <button className="auth-submit" type="submit" disabled={submitting}>
          <span>{submitting ? "Signing in…" : "Sign in to Proxima"}</span><ArrowRight size={17} />
        </button>
        {error && <p role="alert" className="customer-error">{error}</p>}
      </form>

      <div className="auth-separator"><span>OR</span></div>
      <button className="auth-sso" type="button" disabled title="SSO must be configured for an organization first"><KeyRound size={17} /><span>Continue with SSO</span></button>

      <div className="auth-switch"><span>New to Agata?</span><Link to="/signup">Create a workspace</Link></div>
      <p className="auth-note">By signing in, you access your organization’s Proxima control plane.</p>
    </div>
  );
}
