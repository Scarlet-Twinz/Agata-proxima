import { ArrowLeft, ArrowRight, KeyRound } from "lucide-react";
import { Link } from "react-router-dom";

export default function Recovery() {
  return (
    <div className="agata-auth-form agata-auth-form-recovery">
      <div className="auth-form-heading">
        <div className="auth-form-mark">
          <KeyRound size={19} />
        </div>

        <span className="auth-kicker auth-kicker-dark">ACCOUNT RECOVERY</span>

        <h2>Reset your password.</h2>

        <p>
          Enter the email associated with your Proxima workspace. We�ll send
          the next recovery step there.
        </p>
      </div>

      <form
        className="agata-form"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="agata-field">
          <label htmlFor="recovery-email">Work email</label>
          <input
            id="recovery-email"
            name="email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
          />
        </div>

        <button className="auth-submit" type="submit">
          <span>Send recovery link</span>
          <ArrowRight size={17} />
        </button>
      </form>

      <div className="auth-recovery-note">
        <strong>Need another way in?</strong>
        <span>
          If your organization uses enterprise identity, your administrator
          may have configured SSO for your workspace.
        </span>
      </div>

      <Link className="auth-back-link" to="/login">
        <ArrowLeft size={15} />
        Back to sign in
      </Link>
    </div>
  );
}
