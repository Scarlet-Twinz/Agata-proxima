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

  async function submit(event:React.FormEvent) {
    event.preventDefault(); setError(""); setMessage(""); setBusy(true);
    try {
      const result=await signup({name,organization,email,password});
      if(result.verification_required){
        setVerificationMode(true);
        setMessage(result.message || "A 6-digit verification code has been sent to your email.");
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
        <p>We sent a 6-digit code to <strong>{email}</strong>. Keep this page open and enter the code here.</p>
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
    <div className="auth-switch"><span>Already have a workspace?</span><Link to="/login">Sign in</Link></div>
  </div>;
}
