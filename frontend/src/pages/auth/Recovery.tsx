import { ArrowLeft, ArrowRight, KeyRound } from "lucide-react";
import { Link } from "react-router-dom";
import { FormEvent, useState } from "react";
import { requestPasswordReset } from "../../api/auth";

export default function Recovery() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      setMessage("If that address exists, a reset email has been sent.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to request password recovery.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="agata-auth-form agata-auth-form-recovery">
      <div className="auth-form-heading">
        <div className="auth-form-mark"><KeyRound size={19} /></div>
        <span className="auth-kicker auth-kicker-dark">ACCOUNT RECOVERY</span>
        <h2>Reset your password.</h2>
        <p>Enter the email associated with your Proxima workspace. We’ll send the next recovery step there.</p>
      </div>
      <form className="agata-form" onSubmit={submit}>
        <div className="agata-field">
          <label htmlFor="recovery-email">Work email</label>
          <input id="recovery-email" name="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" required />
        </div>
        <button className="auth-submit" type="submit" disabled={submitting}><span>{submitting ? "Sending…" : "Send recovery link"}</span><ArrowRight size={17} /></button>
        {message && <p role="status">{message}</p>}
        {error && <p role="alert" className="customer-error">{error}</p>}
      </form>
      <div className="auth-recovery-note"><strong>Need another way in?</strong><span>If your organization uses enterprise identity, your administrator may have configured SSO for your workspace.</span></div>
      <Link className="auth-back-link" to="/login"><ArrowLeft size={15} />Back to sign in</Link>
    </div>
  );
}
