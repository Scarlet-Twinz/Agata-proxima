import { ArrowRight, Eye, EyeOff, ShieldCheck, KeyRound } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="agata-auth-form">
      <div className="auth-form-heading">
        <div className="auth-form-mark">
          <ShieldCheck size={19} />
        </div>

        <span className="auth-kicker auth-kicker-dark">SIGN IN</span>

        <h2>Welcome back.</h2>

        <p>
          Sign in to your Proxima workspace and manage your tenant security
          boundary.
        </p>
      </div>

      <form
        className="agata-form"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="agata-field">
          <label htmlFor="login-email">Work email</label>
          <input
            id="login-email"
            name="email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
          />
        </div>

        <div className="agata-field">
          <div className="agata-field-label-row">
            <label htmlFor="login-password">Password</label>
            <Link to="/recovery">Forgot password?</Link>
          </div>

          <div className="auth-password-field">
            <input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              autoComplete="current-password"
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
          <span>Keep me signed in on this device</span>
        </label>

        <button className="auth-submit" type="submit">
          <span>Sign in to Proxima</span>
          <ArrowRight size={17} />
        </button>
      </form>

      <div className="auth-separator">
        <span>OR</span>
      </div>

      <button className="auth-sso" type="button">
        <KeyRound size={17} />
        <span>Continue with SSO</span>
      </button>

      <div className="auth-switch">
        <span>New to Agata?</span>
        <Link to="/signup">Create a workspace</Link>
      </div>

      <p className="auth-note">
        By signing in, you access your organization's Proxima control plane.
      </p>
    </div>
  );
}
