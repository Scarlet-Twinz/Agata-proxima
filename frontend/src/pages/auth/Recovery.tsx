import { ArrowRight, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

export default function Recovery() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/v1/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.message === "string" ? data.message : "Unable to request a reset.");
      setMessage(typeof data.message === "string" ? data.message : "If that address exists, a reset email has been sent.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to request a reset.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="agata-auth-form">
      <div className="auth-form-heading">
        <div className="auth-form-mark"><Mail size={19} /></div>
        <span className="auth-kicker auth-kicker-dark">ACCOUNT RECOVERY</span>
        <h2>Reset your password.</h2>
        <p>Request a password reset link for your Proxima workspace.</p>
      </div>

      <form className="agata-form" onSubmit={handleSubmit}>
        <div className="agata-field">
          <label htmlFor="recovery-email">Work email</label>
          <input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" />
        </div>
        {message && <div className="auth-form-success" role="status">{message}</div>}
        <button className="auth-submit" type="submit" disabled={submitting}>
          <span>{submitting ? "Sending…" : "Send recovery link"}</span>
          <ArrowRight size={17} />
        </button>
      </form>

      <div className="auth-recovery-note">
        <ShieldCheck size={17} />
        <div><strong>Security note</strong><span>Reset links are time-limited. If you did not request one, ignore the message.</span></div>
      </div>
      <Link to="/login" className="auth-back-link">← Back to sign in</Link>
    </div>
  );
}
