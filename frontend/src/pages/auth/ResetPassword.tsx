import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { resetPassword } from "../../api/auth";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!token) {
      setError("This reset link is missing its token. Request a new password reset link.");
      return;
    }
    if (password.length < 12) {
      setError("Use a password with at least 12 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const result = await resetPassword(token, password);
      setMessage(result.message || "Password reset successfully. Sign in with your new password.");
      setPassword("");
      setConfirmation("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset the password. Request a new link and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="agata-auth-form agata-auth-form-recovery">
      <div className="auth-form-heading">
        <div className="auth-form-mark"><KeyRound size={19} /></div>
        <span className="auth-kicker auth-kicker-dark">ACCOUNT SECURITY</span>
        <h2>Choose a new password.</h2>
        <p>Use at least 12 characters. A successful reset signs out existing sessions.</p>
      </div>

      {error && <div className="auth-error" role="alert">{error}</div>}
      {message && <div className="auth-security-callout" role="status"><CheckCircle2 size={18}/><div><strong>Password updated</strong><span>{message}</span></div></div>}

      {!message && <form className="agata-form" onSubmit={submit}>
        <div className="agata-field">
          <label htmlFor="reset-password">New password</label>
          <input id="reset-password" name="password" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={event => setPassword(event.target.value)} />
        </div>
        <div className="agata-field">
          <label htmlFor="reset-password-confirm">Confirm new password</label>
          <input id="reset-password-confirm" name="password_confirmation" type="password" autoComplete="new-password" minLength={12} required value={confirmation} onChange={event => setConfirmation(event.target.value)} />
        </div>
        <button className="auth-submit" type="submit" disabled={busy || !token || !password || !confirmation}>
          <span>{busy ? "Updating password…" : "Update password"}</span>
          <ArrowRight size={17} />
        </button>
      </form>}

      {!token && <div className="auth-error" role="alert">This reset link is missing its token. Request a new password reset link.</div>}
      <Link className="auth-back-link" to="/login"><ArrowLeft size={15} /> Back to sign in</Link>
    </div>
  );
}
