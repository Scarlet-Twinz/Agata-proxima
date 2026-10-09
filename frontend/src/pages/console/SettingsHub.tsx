import { useEffect, useState } from "react";
import {
  Bell, Building2, Check, LogOut, Mail, Monitor, Moon, Plus, Save,
  ShieldCheck, Sun, Trash2, UserRound
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { logout } from "../../api/auth";

type Organization = { id:string; name:string; slug:string; role:string };
type SettingsData = {
  user:{id:string;email:string;display_name:string;pending_email?:string|null};
  organization:{id:string;name:string;slug:string;role:string};
  organizations:Organization[];
  preferences:{theme:"light"|"dark";notifications:{security:boolean;product:boolean;billing:boolean}};
};

const defaults:SettingsData["preferences"]={theme:"light",notifications:{security:true,product:true,billing:true}};

export function SettingsHub(){
  const navigate=useNavigate();
  const [data,setData]=useState<SettingsData|null>(null);
  const [name,setName]=useState("");
  const [organizationName,setOrganizationName]=useState("");
  const [theme,setTheme]=useState<"light"|"dark">("light");
  const [notifications,setNotifications]=useState(defaults.notifications);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(true);
  const [saving,setSaving]=useState(false);
  const [switching,setSwitching]=useState(false);
  const [currentPassword,setCurrentPassword]=useState("");
  const [newPassword,setNewPassword]=useState("");
  const [passwordBusy,setPasswordBusy]=useState(false);
  const [newEmail,setNewEmail]=useState("");
  const [emailPassword,setEmailPassword]=useState("");
  const [emailCode,setEmailCode]=useState("");
  const [emailPending,setEmailPending]=useState(false);
  const [emailBusy,setEmailBusy]=useState(false);
  const [orgName,setOrgName]=useState("");
  const [orgBusy,setOrgBusy]=useState(false);

  async function load(){
    setBusy(true); setError("");
    try{
      const result=await api.get<SettingsData>("/api/v1/settings");
      setData(result); setName(result.user.display_name); setOrganizationName(result.organization.name);
      setTheme(result.preferences?.theme==="dark"?"dark":"light");
      setNotifications({...defaults.notifications,...result.preferences?.notifications});
      setEmailPending(Boolean(result.user.pending_email));
    }catch(err){setError(err instanceof Error?err.message:"Unable to load workspace settings.");}
    finally{setBusy(false);}
  }
  useEffect(()=>{void load();},[]);

  function applyTheme(next:"light"|"dark"){
    setTheme(next);
    document.documentElement.dataset.theme=next;
    localStorage.setItem("agata.theme",next);
  }

  async function save(){
    setSaving(true); setError(""); setMessage("");
    try{
      const result=await api.patch<{message:string;settings:SettingsData}>("/api/v1/settings",{
        display_name:name.trim(),
        organization_name:organizationName.trim(),
        preferences:{theme,notifications},
      });
      setData(result.settings); setMessage(result.message||"Settings saved.");
      applyTheme(theme);
    }catch(err){setError(err instanceof Error?err.message:"Unable to save settings.");}
    finally{setSaving(false);}
  }

  async function switchOrganization(id:string){
    if(id===data?.organization.id)return;
    setSwitching(true); setError(""); setMessage("");
    try{
      await api.post("/api/v1/auth/switch-organization",{organization_id:id});
      await load(); setMessage("Organization switched. The workspace data is now scoped to the selected organization.");
    }catch(err){setError(err instanceof Error?err.message:"Unable to switch organization.");}
    finally{setSwitching(false);}
  }

  async function createOrganization(){
    const value=orgName.trim();
    if(!value)return;
    setOrgBusy(true); setError(""); setMessage("");
    try{
      const created=await api.post<{id:string;name:string;slug:string}>("/api/v1/organizations",{name:value});
      await api.post("/api/v1/auth/switch-organization",{organization_id:created.id});
      setOrgName("");
      await load();
      setMessage(`Created “${created.name}” and switched to it.`);
    }catch(err){setError(err instanceof Error?err.message:"Unable to create the organization.");}
    finally{setOrgBusy(false);}
  }

  async function changePassword(){
    setPasswordBusy(true); setError(""); setMessage("");
    try{const result=await api.post<{ok:boolean;message:string}>("/api/v1/auth/password/change",{current_password:currentPassword,new_password:newPassword});setCurrentPassword("");setNewPassword("");setMessage(result.message);}
    catch(err){setError(err instanceof Error?err.message:"Unable to change the password.");}
    finally{setPasswordBusy(false);}
  }

  async function requestEmailChange(){
    setEmailBusy(true); setError(""); setMessage("");
    try{
      const result=await api.post<{message:string}>("/api/v1/settings/email/change",{current_password:emailPassword,new_email:newEmail});
      setEmailPending(true); setEmailPassword(""); setMessage(result.message);
    }catch(err){setError(err instanceof Error?err.message:"Unable to start the email change.");}
    finally{setEmailBusy(false);}
  }

  async function confirmEmailChange(){
    setEmailBusy(true); setError(""); setMessage("");
    try{
      const result=await api.post<{email:string;message:string}>("/api/v1/settings/email/confirm",{code:emailCode});
      setEmailCode(""); setNewEmail(""); setEmailPending(false); await load(); setMessage(result.message);
    }catch(err){setError(err instanceof Error?err.message:"Unable to verify the new email address.");}
    finally{setEmailBusy(false);}
  }

  async function signOut(){ await logout(); navigate("/login",{replace:true}); }

  async function deleteOrganization(org: Organization) {
    const confirmation = window.prompt(
      `To permanently delete the organization “${org.name}”, type its exact name below. Other organizations will not be deleted.`,
    );
    if (confirmation !== org.name) {
      if (confirmation !== null) setError("Organization deletion cancelled because the name did not match.");
      return;
    }
    setError(""); setMessage("");
    try {
      await api.delete<{ok:boolean;message:string}>(`/api/v1/organizations/${encodeURIComponent(org.id)}`);
      await load();
      setMessage(`Organization “${org.name}” was deleted. Your other organizations and account were kept.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete this organization.");
    }
  }

  async function deleteAccount(){
    const confirmation = window.prompt(
      "This permanently deletes your account and every organization you own. To continue, type DELETE MY ACCOUNT exactly.",
    );
    if (confirmation !== "DELETE MY ACCOUNT") {
      if (confirmation !== null) setError("Account deletion cancelled because the confirmation text did not match.");
      return;
    }
    try{await api.delete("/api/v1/account");sessionStorage.removeItem("proxima_csrf");navigate("/",{replace:true});}
    catch(err){setError(err instanceof Error?err.message:"Unable to delete the account.");}
  }

  if(busy)return <div className="settings-page"><div className="surface empty-state"><strong>Loading settings…</strong><span>Reading your account and workspace configuration.</span></div></div>;

  return <div className="settings-page">
    <div className="page-heading">
      <div><span className="eyebrow">SETTINGS</span><h1>Account & workspace</h1><p>Manage your identity, organization, access, notifications and security controls from one place.</p></div>
      <div className="heading-actions">
        <button className="secondary-action" type="button" onClick={()=>navigate("/app/notifications")}><Bell size={15}/>Notifications</button>
        <button className="primary-action" type="button" disabled={saving} onClick={save}><Save size={15}/>{saving?"Saving…":"Save changes"}</button>
      </div>
    </div>
    {message&&<div className="settings-banner settings-banner--success"><Check size={16}/>{message}</div>}
    {error&&<div className="settings-banner settings-banner--error">{error}</div>}

    <section className="settings-section">
      <div className="settings-section-heading"><div><h2>Account</h2><p>Your personal identity and sign-in address.</p></div><UserRound size={19}/></div>
      <div className="settings-grid">
        <label className="settings-field"><span>Display name</span><input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></label>
        <div className="settings-field"><span>Current email address</span><div className="settings-readonly">{data?.user.email}<small>Verified account email</small></div></div>
      </div>
      <div className="settings-subsection">
        <div className="settings-subheading"><strong>Change email address</strong><span>Changing email requires your current password and a fresh verification code.</span></div>
        <div className="settings-grid">
          <label className="settings-field"><span>New email</span><input type="email" value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="new@example.com" disabled={emailPending}/></label>
          <label className="settings-field"><span>Current password</span><input type="password" autoComplete="current-password" value={emailPassword} onChange={e=>setEmailPassword(e.target.value)} placeholder="Required to change email" disabled={emailPending}/></label>
        </div>
        {!emailPending ? <button className="secondary-action" type="button" disabled={emailBusy||!newEmail||!emailPassword} onClick={requestEmailChange}><Mail size={15}/>{emailBusy?"Sending…":"Send verification code"}</button> :
          <div className="email-confirm-row"><label className="settings-field"><span>Verification code sent to {data?.user.pending_email||newEmail}</span><input inputMode="numeric" maxLength={6} value={emailCode} onChange={e=>setEmailCode(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="000000"/></label><button className="primary-action" type="button" disabled={emailBusy||emailCode.length!==6} onClick={confirmEmailChange}>{emailBusy?"Verifying…":"Verify new email"}</button></div>}
      </div>
    </section>

    <section className="settings-section">
      <div className="settings-section-heading"><div><h2>Organizations</h2><p>Organizations are isolated workspaces. Your account can belong to multiple organizations, and switching changes the active organization context.</p></div><Building2 size={19}/></div>
      <div className="organization-list">{data?.organizations.map(org=><div key={org.id} style={{display:"flex",alignItems:"stretch",gap:8}}><button type="button" style={{flex:1,minWidth:0}} className={org.id===data.organization.id?"organization-option is-current":"organization-option"} disabled={switching} onClick={()=>switchOrganization(org.id)}><span><strong>{org.name}</strong><small>{org.role} · {org.slug}{org.id===data.organization.id?" · Active":""}</small></span>{org.id===data.organization.id&&<Check size={17}/>}</button><button type="button" className="secondary-action" onClick={()=>void deleteOrganization(org)} title={`Delete ${org.name} only`} aria-label={`Delete organization ${org.name}`}><Trash2 size={15}/><span>Delete</span></button></div>)}</div>
      <div className="create-organization">
        <div><strong>Create another organization</strong><small>Creates a separate organization with its own Production project and isolated resources.</small></div>
        <div className="create-organization-form"><input value={orgName} onChange={e=>setOrgName(e.target.value)} placeholder="Organization name" onKeyDown={e=>{if(e.key==="Enter")void createOrganization()}}/><button className="secondary-action" type="button" disabled={orgBusy||!orgName.trim()} onClick={createOrganization}><Plus size={15}/>{orgBusy?"Creating…":"Create organization"}</button></div>
      </div>
    </section>

    <section className="settings-section">
      <div className="settings-section-heading"><div><h2>Active workspace</h2><p>This is the organization currently used by the control plane and its resource APIs.</p></div><Building2 size={19}/></div>
      <div className="settings-grid">
        <label className="settings-field"><span>Organization name</span><input value={organizationName} onChange={e=>setOrganizationName(e.target.value)} disabled={!["owner","admin"].includes(data?.organization.role||"")}/></label>
        <div className="settings-field"><span>Organization identifier</span><div className="settings-readonly"><strong>{data?.organization.slug}</strong><small>{data?.organization.id}</small></div></div>
        <div className="settings-field"><span>Current role</span><div className="settings-readonly">{data?.organization.role}<small>{data?.organization.name}</small></div></div>
      </div>
    </section>

    <section className="settings-section">
      <div className="settings-section-heading"><div><h2>Appearance</h2><p>Choose how the control plane looks on this device.</p></div><Monitor size={19}/></div>
      <div className="settings-choice-row">
        <button className={theme==="light"?"settings-choice is-selected":"settings-choice"} onClick={()=>applyTheme("light")}><Sun size={17}/><span><strong>Light</strong><small>Bright control-plane workspace</small></span></button>
        <button className={theme==="dark"?"settings-choice is-selected":"settings-choice"} onClick={()=>applyTheme("dark")}><Moon size={17}/><span><strong>Dark</strong><small>Low-light control-plane workspace</small></span></button>
      </div>
    </section>

    <section className="settings-section">
      <div className="settings-section-heading"><div><h2>Notification preferences</h2><p>These preferences control the categories you want delivered. Your in-app notification center remains available from the top navigation.</p></div><Bell size={19}/></div>
      <div className="settings-toggle-list">
        {([["security","Security alerts","Sign-in, verification and security events."],["product","Product updates","Important product and platform updates."],["billing","Billing notifications","Billing, plan and entitlement changes."]] as const).map(([key,label,description])=><label className="settings-toggle" key={key}><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" checked={notifications[key]} onChange={e=>setNotifications(v=>({...v,[key]:e.target.checked}))}/></label>)}
      </div>
    </section>

    <section className="settings-section">
      <div className="settings-section-heading"><div><h2>Password</h2><p>Change your password while keeping the current browser session active.</p></div><ShieldCheck size={19}/></div>
      <div className="settings-grid">
        <label className="settings-field"><span>Current password</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} placeholder="Current password"/></label>
        <label className="settings-field"><span>New password</span><input type="password" autoComplete="new-password" minLength={12} value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="At least 12 characters"/></label>
      </div>
      <div style={{marginTop:14}}><button className="secondary-action" type="button" disabled={passwordBusy||currentPassword.length===0||newPassword.length<12} onClick={changePassword}>{passwordBusy?"Changing password…":"Change password"}</button></div>
    </section>

    <section className="settings-section">
      <div className="settings-section-heading"><div><h2>Advanced configuration</h2><p>Detailed security and enterprise configuration remains available without making the main Settings page feel fragmented.</p></div><ShieldCheck size={19}/></div>
      <div className="settings-action-list">
        <button className="settings-action" onClick={()=>navigate("/app/settings/authentication")}><span><strong>Authentication</strong><small>Email verification, password recovery and session behavior.</small></span></button>
        <button className="settings-action" onClick={()=>navigate("/app/settings/identity")}><span><strong>Enterprise identity</strong><small>Microsoft Entra/OIDC configuration and readiness.</small></span></button>
        <button className="settings-action" onClick={()=>navigate("/app/settings/security")}><span><strong>Security controls</strong><small>CSRF, enforcement authority and protection boundaries.</small></span></button>
        <button className="settings-action" onClick={()=>navigate("/app/settings/environments")}><span><strong>Environments</strong><small>Production and future environment boundaries.</small></span></button>
        <button className="settings-action" onClick={signOut}><span><strong>Sign out</strong><small>End this browser session immediately.</small></span><LogOut size={17}/></button>
        <button className="settings-action settings-action--danger" onClick={deleteAccount}><span><strong>Delete account</strong><small>Permanently remove the account when ownership constraints allow it.</small></span><Trash2 size={17}/></button>
      </div>
    </section>
  </div>;
}
