import { ArrowRight, CheckCircle2, Eye, EyeOff, ShieldCheck, KeyRound } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { login, resendVerification, verifyEmailCode } from "../../api/auth";

export default function Login() {
  const navigate=useNavigate();
  const location=useLocation();
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [code,setCode]=useState("");
  const [showPassword,setShowPassword]=useState(false);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [verificationRequired,setVerificationRequired]=useState(false);
  const [resendBusy,setResendBusy]=useState(false);
  const [resendMessage,setResendMessage]=useState("");
  const [showSsoForm,setShowSsoForm]=useState(false);
  const [organizationSlug,setOrganizationSlug]=useState("");
  const [ssoBusy,setSsoBusy]=useState(false);
  const locationState=location.state as {verified?:boolean;sessionExpired?:boolean}|null;
  const verifiedMessage=locationState?.verified ? "Email verified. Sign in to open your workspace." : "";
  const sessionMessage=locationState?.sessionExpired ? "Your previous security session expired. Sign in again to continue." : "";

  async function submit(event:React.FormEvent) {
    event.preventDefault();
    setError(""); setVerificationRequired(false); setResendMessage(""); setBusy(true);
    try {
      await login(email,password);
      const from=(location.state as {from?:string}|null)?.from;
      navigate(from || "/app",{replace:true});
    } catch (err) {
      const message=err instanceof Error ? err.message : "Unable to sign in.";
      setError(message);
      setVerificationRequired(message.toLowerCase().includes("verify your email"));
    } finally { setBusy(false); }
  }

  async function handleVerifyCode(){
    setBusy(true); setError(""); setResendMessage("");
    try{
      await verifyEmailCode(email,code);
      setVerificationRequired(false);
      setResendMessage("Email verified. You can now sign in with your password.");
    }catch(err){setError(err instanceof Error ? err.message : "Unable to verify the email address.");}
    finally{setBusy(false);}
  }

  async function handleResendVerification() {
    setResendBusy(true); setResendMessage("");
    try {
      const result = await resendVerification(email);
      setResendMessage(result.message);
    } catch (err) {
      setResendMessage(err instanceof Error ? err.message : "Unable to resend the verification code.");
    } finally {
      setResendBusy(false);
    }
  }

  async function handleSso(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const slug = organizationSlug.trim();
    if (!slug) {
      setError("Enter your organization slug to continue with Microsoft Entra SSO.");
      return;
    }
    setSsoBusy(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(`/api/v1/auth/oidc/start?organization_slug=${encodeURIComponent(slug)}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      const body = await response.json().catch(() => ({})) as { authorization_url?: unknown; message?: unknown };
      if (!response.ok || typeof body.authorization_url !== "string") {
        throw new Error(typeof body.message === "string" ? body.message : `Microsoft Entra SSO could not start (HTTP ${response.status}). Check this organization's SSO configuration and entitlement.`);
      }
      const authorizationUrl = new URL(body.authorization_url);
      if (authorizationUrl.origin !== "https://login.microsoftonline.com") {
        throw new Error("The SSO authorization endpoint was not trusted.");
      }
      window.location.assign(authorizationUrl.toString());
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("The Control Plane did not respond to the SSO start request within 12 seconds. Check the backend terminal and this organization's Entra configuration.");
      } else {
        setError(err instanceof Error ? err.message : "Unable to start Microsoft Entra SSO.");
      }
      setSsoBusy(false);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  return <div className="agata-auth-form">
    <div className="auth-form-heading">
      <div className="auth-form-mark"><ShieldCheck size={19}/></div>
      <span className="auth-kicker auth-kicker-dark">SIGN IN</span>
      <h2>Welcome back.</h2>
      <p>Sign in to your Proxima workspace and manage your tenant security boundary.</p>
    </div>
    {sessionMessage && <div className="auth-security-callout"><ShieldCheck size={18}/><div><strong>Session expired</strong><span>{sessionMessage}</span></div></div>}{verifiedMessage && <div className="auth-security-callout"><CheckCircle2 size={18}/><div><strong>Email verified</strong><span>{verifiedMessage}</span></div></div>}
    {error && <div className="auth-error" role="alert">{error}</div>}
    <form className="agata-form" onSubmit={submit}>
      <div className="agata-field"><label htmlFor="login-email">Work email</label><input id="login-email" name="email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" placeholder="you@company.com"/></div>
      <div className="agata-field">
        <div className="agata-field-label-row"><label htmlFor="login-password">Password</label><Link to="/recovery">Forgot password?</Link></div>
        <div className="auth-password-field"><input id="login-password" name="password" required type={showPassword?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" placeholder="Enter your password"/><button type="button" className="auth-password-toggle" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?"Hide password":"Show password"}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>
      </div>
      <label className="auth-check"><input type="checkbox"/><span>Keep me signed in on this device</span></label>
      <button className="auth-submit" type="submit" disabled={busy}><span>{busy?"Signing in…":"Sign in to Proxima"}</span><ArrowRight size={17}/></button>
    </form>
    {verificationRequired && <div className="auth-security-callout"><ShieldCheck size={18}/><div><strong>Email verification required</strong><span>Your password is correct, but your email address must be verified. Enter the 6-digit code from your latest email.</span><div className="auth-code-row"><input aria-label="Verification code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="000000"/><button className="auth-inline-action" type="button" disabled={busy || code.length!==6} onClick={handleVerifyCode}>Verify</button></div><button className="auth-inline-action" type="button" disabled={resendBusy || !email} onClick={handleResendVerification}>{resendBusy ? "Sending verification code…" : "Resend verification code"}</button>{resendMessage && <small>{resendMessage}</small>}</div></div>}
    <div className="auth-separator"><span>OR</span></div>
    <button className="auth-sso" type="button" disabled={ssoBusy} aria-expanded={showSsoForm} onClick={()=>{setShowSsoForm(v=>!v);setError("");}}><KeyRound size={17}/><span>{showSsoForm?"Hide SSO sign-in":"Continue with SSO"}</span></button>
    {showSsoForm && <form className="agata-form auth-sso-form" onSubmit={handleSso}>
      <div className="agata-field"><label htmlFor="login-sso-organization">Organization slug</label><input id="login-sso-organization" name="organization_slug" required value={organizationSlug} onChange={e=>setOrganizationSlug(e.target.value)} autoComplete="organization" placeholder="your-workspace"/><small className="auth-note">Enter the workspace slug provided by your organization administrator.</small></div>
      <button className="auth-submit" type="submit" disabled={ssoBusy}><span>{ssoBusy?"Connecting to Microsoft…":"Continue with Microsoft Entra"}</span><ArrowRight size={17}/></button>
    </form>}
    <div className="auth-switch"><span>New to Agata?</span><Link to="/signup">Create a workspace</Link></div>
    <p className="auth-note">By signing in, you access your organization’s Proxima control plane.</p>
  </div>;
}
