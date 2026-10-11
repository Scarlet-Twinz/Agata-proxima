import { ArrowRight, Building2, CheckCircle2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { signup, verifyEmailCode, resendVerification } from "../../api/auth";

export default function Signup() {
  const navigate=useNavigate();
  const [showPassword,setShowPassword]=useState(false);
  const [name,setName]=useState("");
  const [organization,setOrganization]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [code,setCode]=useState("");
  const [verificationMode,setVerificationMode]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [resendBusy,setResendBusy]=useState(false);
  const [ssoOrganizationSlug,setSsoOrganizationSlug]=useState("");
  const [ssoBusy,setSsoBusy]=useState(false);

  async function continueWithSso(event:React.FormEvent) {
    event.preventDefault();
    setError(""); setMessage("");
    const slug=ssoOrganizationSlug.trim();
    if(!slug){setError("Enter the organization slug shown in workspace settings.");return;}
    setSsoBusy(true);
    const controller=new AbortController();
    const timeout=window.setTimeout(()=>controller.abort(),12_000);
    try{
      const response=await fetch(`/api/v1/auth/oidc/start?organization_slug=${encodeURIComponent(slug)}`,{
        method:"GET",credentials:"include",cache:"no-store",headers:{Accept:"application/json"},signal:controller.signal
      });
      const body=await response.json().catch(()=>({})) as {authorization_url?:unknown;message?:unknown};
      if(!response.ok||typeof body.authorization_url!=="string"){
        throw new Error(typeof body.message==="string"?body.message:`Microsoft Entra SSO could not start (HTTP ${response.status}). Check the organization SSO configuration.`);
      }
      const authorizationUrl=new URL(body.authorization_url);
      if(authorizationUrl.origin!=="https://login.microsoftonline.com")throw new Error("The SSO authorization endpoint was not trusted.");
      window.location.assign(authorizationUrl.toString());
    }catch(err){
      if(err instanceof DOMException&&err.name==="AbortError")setError("The Control Plane did not respond to the SSO request within 12 seconds. Check the backend terminal.");
      else setError(err instanceof Error?err.message:"Unable to start Microsoft Entra SSO.");
      setSsoBusy(false);
    }finally{window.clearTimeout(timeout);}
  }

  async function submit(event:React.FormEvent) {
    event.preventDefault(); setError(""); setMessage(""); setBusy(true);
    try {
      const result=await signup({name,organization,email,password});
      if(result.verification_required){
        setVerificationMode(true);
        setMessage(result.message || (result.email_sent === false ? "Your workspace was kept. Email delivery failed; fix the email configuration and use Send a new code to retry." : "A 6-digit verification code has been sent to your email."));
      }
    } catch(err) {
      setError(err instanceof Error ? err.message : "Unable to create workspace.");
    } finally { setBusy(false); }
  }

  async function verify(){
    setError(""); setMessage(""); setBusy(true);
    try{
      const result=await verifyEmailCode(email,code);
      setMessage(result.message);
      navigate("/login",{replace:true,state:{verified:true}});
    }catch(err){setError(err instanceof Error ? err.message : "Unable to verify the email address.");}
    finally{setBusy(false);}
  }

  async function resend(){
    setResendBusy(true); setError(""); setMessage("");
    try{const result=await resendVerification(email);setMessage(result.message);}
    catch(err){setError(err instanceof Error ? err.message : "Unable to send a new verification code.");}
    finally{setResendBusy(false);}
  }

  if(verificationMode){
    return <div className="agata-auth-form">
      <div className="auth-form-heading">
        <div className="auth-form-mark"><CheckCircle2 size={19}/></div>
        <span className="auth-kicker auth-kicker-dark">EMAIL VERIFICATION</span>
        <h2>Enter your verification code.</h2>
        <p>Verification is required for <strong>{email}</strong>. If the email did not arrive, use Send a new code after checking the email configuration.</p>
      </div>
      {error && <div className="auth-error" role="alert">{error}</div>}
      {message && <div className="auth-security-callout"><ShieldCheck size={18}/><div><strong>Check your inbox</strong><span>{message}</span></div></div>}
      <div className="agata-form">
        <div className="agata-field"><label htmlFor="signup-code">6-digit verification code</label><input id="signup-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="000000" /></div>
        <button className="auth-submit" type="button" disabled={busy || code.length!==6} onClick={verify}><span>{busy?"Verifying…":"Verify email"}</span><ArrowRight size={17}/></button>
        <button className="auth-inline-action" type="button" disabled={resendBusy} onClick={resend}>{resendBusy?"Sending new code…":"Send a new code"}</button>
      </div>
      <div className="auth-switch"><span>Already verified?</span><Link to="/login">Sign in</Link></div>
    </div>;
  }

  return <div className="agata-auth-form">
    <div className="auth-form-heading">
      <div className="auth-form-mark"><Building2 size={19}/></div>
      <span className="auth-kicker auth-kicker-dark">CREATE WORKSPACE</span>
      <h2>Start with a secure boundary.</h2>
      <p>Create your organization workspace and bring your tenant isolation infrastructure under one control plane.</p>
    </div>
    {error && <div className="auth-error" role="alert">{error}</div>}
    <form className="agata-form" onSubmit={submit}>
      <div className="agata-form-split">
        <div className="agata-field"><label htmlFor="signup-name">Full name</label><input id="signup-name" name="name" required type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" autoComplete="name"/></div>
        <div className="agata-field"><label htmlFor="signup-org">Organization</label><input id="signup-org" name="organization" required type="text" value={organization} onChange={e=>setOrganization(e.target.value)} placeholder="Company name" autoComplete="organization"/></div>
      </div>
      <div className="agata-field"><label htmlFor="signup-email">Work email</label><input id="signup-email" name="email" required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email"/></div>
      <div className="agata-field"><label htmlFor="signup-password">Password</label><div className="auth-password-field"><input id="signup-password" name="password" required minLength={12} type={showPassword?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Create a strong password" autoComplete="new-password"/><button type="button" className="auth-password-toggle" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?"Hide password":"Show password"}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></div>
      <label className="auth-check"><input type="checkbox" required/><span>I agree to the Agata Proxima terms and acknowledge the privacy policy.</span></label>
      <button className="auth-submit" type="submit" disabled={busy}><span>{busy?"Creating workspace…":"Create Proxima workspace"}</span><ArrowRight size={17}/></button>
    </form>
    <div className="auth-sso-divider"><span>OR</span></div>
    <form className="agata-form" onSubmit={continueWithSso}>
      <div className="auth-form-heading">
        <span className="auth-kicker auth-kicker-dark">EXISTING ORGANIZATION</span>
        <p>Already belong to an organization that uses Microsoft Entra? Continue with your organization's SSO.</p>
      </div>
      <div className="agata-field"><label htmlFor="signup-sso-slug">Organization slug</label><input id="signup-sso-slug" value={ssoOrganizationSlug} onChange={e=>setSsoOrganizationSlug(e.target.value)} placeholder="your-organization-slug" autoComplete="organization" /></div>
      <button className="auth-submit" type="submit" disabled={ssoBusy}><span>{ssoBusy?"Connecting to Microsoft…":"Continue with Microsoft Entra"}</span><ArrowRight size={17}/></button>
    </form>
    <div className="auth-switch"><span>Already have a workspace?</span><Link to="/login">Sign in</Link></div>
  </div>;
}
