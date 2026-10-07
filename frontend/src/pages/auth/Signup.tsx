import { ArrowRight, Building2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { FormEvent, useState } from "react";
import { signup } from "../../api/auth";

export default function Signup() {
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!accepted) {
      setError("Accept the terms and privacy policy before creating a workspace.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await signup({ name: name.trim(), organization: organization.trim(), email: email.trim(), password });
      navigate("/app", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create the workspace.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="agata-auth-form">
      <div className="auth-form-heading">
        <div className="auth-form-mark"><Building2 size={19} /></div>
        <span className="auth-kicker auth-kicker-dark">CREATE WORKSPACE</span>
        <h2>Start with a secure boundary.</h2>
        <p>Create your organization workspace and bring your tenant isolation infrastructure under one control plane.</p>
      </div>

      <form className="agata-form" onSubmit={submit}>
        <div className="agata-form-split">
          <div className="agata-field"><label htmlFor="signup-name">Full name</label><input id="signup-name" name="name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" autoComplete="name" required /></div>
          <div className="agata-field"><label htmlFor="signup-org">Organization</label><input id="signup-org" name="organization" type="text" value={organization} onChange={e => setOrganization(e.target.value)} placeholder="Company name" autoComplete="organization" required /></div>
        </div>
        <div className="agata-field"><label htmlFor="signup-email">Work email</label><input id="signup-email" name="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" required /></div>
        <div className="agata-field">
          <label htmlFor="signup-password">Password</label>
          <div className="auth-password-field">
            <input id="signup-password" name="password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Create a strong password" autoComplete="new-password" minLength={12} required />
            <button type="button" className="auth-password-toggle" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
          </div>
        </div>
        <label className="auth-check"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} required /><span>I agree to the Agata Proxima terms and acknowledge the privacy policy.</span></label>
        <button className="auth-submit" type="submit" disabled={submitting}><span>{submitting ? "Creating workspace…" : "Create Proxima workspace"}</span><ArrowRight size={17} /></button>
        {error && <p role="alert" className="customer-error">{error}</p>}
      </form>

      <div className="auth-security-callout"><ShieldCheck size={18} /><div><strong>Built around verification</strong><span>Your workspace is the starting point for tenant-aware enforcement, verification, and audit evidence.</span></div></div>
      <div className="auth-switch"><span>Already have a workspace?</span><Link to="/login">Sign in</Link></div>
    </div>
  );
}
