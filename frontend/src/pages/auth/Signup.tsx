import { ArrowRight, Building2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { signup } from "../../api/auth";

export default function Signup() {
  const navigate=useNavigate();
  const [showPassword,setShowPassword]=useState(false);
  const [name,setName]=useState("");
  const [organization,setOrganization]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);

  async function submit(event:React.FormEvent) {
    event.preventDefault(); setError(""); setMessage(""); setBusy(true);
    try {
      const result=await signup({name,organization,email,password});
      setMessage(result.message || "Check your inbox to verify your email before signing in.");
    } catch(err) {
      setError(err instanceof Error ? err.message : "Unable to create workspace.");
    } finally { setBusy(false); }
  }

  return <div className="agata-auth-form">
    <div className="auth-form-heading">
      <div className="auth-form-mark"><Building2 size={19}/></div>
      <span className="auth-kicker auth-kicker-dark">CREATE WORKSPACE</span>
      <h2>Start with a secure boundary.</h2>
      <p>Create your organization workspace and bring your tenant isolation infrastructure under one control plane.</p>
    </div>
    {error && <div className="auth-error" role="alert">{error}</div>}
    {message && <div className="auth-security-callout"><ShieldCheck size={18}/><div><strong>Check your inbox</strong><span>{message} After verification, return here and sign in.</span></div></div>}
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
