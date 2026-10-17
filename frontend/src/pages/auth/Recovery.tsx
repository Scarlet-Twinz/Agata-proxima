import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound } from "lucide-react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "../../api/auth";

export default function Recovery() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await requestPasswordReset(email.trim());
      setMessage(result.message || "If that address exists, a reset email has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to request a password reset. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="agata-auth-form agata-auth-form-recovery">
      <div className="auth-form-heading">
        <div className="auth-form-mark"><KeyRound size={19} /></div>
        <span className="auth-kicker auth-kicker-dark">ACCOUNT RECOVERY</span>
        <h2>Reset your password.</h2>
        <p>Enter your workspace email and we’ll send a secure, time-limited password reset link.</p>
      </div>

      {error && <div className="auth-error" role="alert">{error}</div>}
      {message && <div className="auth-security-callout" role="status"><CheckCircle2 size={18}/><div><strong>Check your inbox</strong><span>{message}</span></div></div>}

      {!message && <form className="agata-form" onSubmit={submit}>
        <div className="agata-field">
          <label htmlFor="recovery-email">Work email</label>
          <input
            id="recovery-email"
            name="email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            required
            value={email}
            onChange={event => setEmail(event.target.value)}
          />
        </div>
        <button className="auth-submit" type="submit" disabled={busy || !email.trim()}>
          <span>{busy ? "Sending recovery link…" : "Send recovery link"}</span>
          <ArrowRight size={17} />
        </button>
      </form>}

      <div className="auth-recovery-note">
        <strong>Keep your account secure</strong>
        <span>Reset links expire after 30 minutes. After a successful reset, existing sessions are revoked.</span>
      </div>

      <Link className="auth-back-link" to="/login"><ArrowLeft size={15} /> Back to sign in</Link>
    </div>
  );
}
