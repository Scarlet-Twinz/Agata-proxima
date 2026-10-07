import { useEffect, useState } from "react";
import { Building2, Check, LogOut, Monitor, Moon, Save, ShieldCheck, Sun, Trash2, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { logout } from "../../api/auth";

type Organization = { id:string; name:string; slug:string; role:string };
type SettingsData = {
  user:{id:string;email:string;display_name:string};
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

  async function load(){
    setBusy(true); setError("");
    try{
      const result=await api.get<SettingsData>("/api/v1/settings");
      setData(result); setName(result.user.display_name); setOrganizationName(result.organization.name);
      setTheme(result.preferences?.theme==="dark"?"dark":"light");
      setNotifications({...defaults.notifications,...result.preferences?.notifications});
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
      await load(); setMessage("Organization switched.");
    }catch(err){setError(err instanceof Error?err.message:"Unable to switch organization.");}
    finally{setSwitching(false);}
  }

  async function signOut(){
    await logout(); navigate("/login",{replace:true});
  }

  async function deleteAccount(){
    const confirmed=window.confirm("Delete your Agata Proxima account? This is permanent. Your account can only be deleted when you are the sole member of every organization you own.");
    if(!confirmed)return;
    try{
      await api.delete("/api/v1/account");
      sessionStorage.removeItem("proxima_csrf");
      navigate("/",{replace:true});
    }catch(err){setError(err instanceof Error?err.message:"Unable to delete the account.");}
  }

  if(busy)return <div className="settings-page"><div className="surface empty-state"><strong>Loading settings…</strong><span>Reading your account and workspace configuration.</span></div></div>;

  return <div className="settings-page">
    <div className="page-heading">
      <div><span className="eyebrow">SETTINGS</span><h1>Workspace settings</h1><p>Manage your account, workspace, organization access, appearance and operational preferences from one place.</p></div>
      <button className="primary-action" type="button" disabled={saving} onClick={save}><Save size={15}/>{saving?"Saving…":"Save changes"}</button>
    </div>
    {message&&<div className="settings-banner settings-banner--success"><Check size={16}/>{message}</div>}
    {error&&<div className="settings-banner settings-banner--error">{error}</div>}

    <section className="settings-section">
      <div className="settings-section-heading"><div><h2>Account</h2><p>Your personal identity and sign-in address.</p></div><UserRound size={19}/></div>
      <div className="settings-grid">
        <label className="settings-field"><span>Display name</span><input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></label>
        <div className="settings-field"><span>Email address</span><div className="settings-readonly">{data?.user.email}<small>Verified account email</small></div></div>
      </div>
    </section>

    <section className="settings-section">
      <div className="settings-section-heading"><div><h2>Workspace</h2><p>Administrative identity for the active organization.</p></div><Building2 size={19}/></div>
      <div className="settings-grid">
        <label className="settings-field"><span>Organization name</span><input value={organizationName} onChange={e=>setOrganizationName(e.target.value)} disabled={!["owner","admin"].includes(data?.organization.role||"")}/></label>
        <div className="settings-field"><span>Current role</span><div className="settings-readonly">{data?.organization.role}<small>{data?.organization.name}</small></div></div>
      </div>
    </section>

    <section className="settings-section">
      <div className="settings-section-heading"><div><h2>Organizations</h2><p>Switch between organizations where your account has membership.</p></div><Building2 size={19}/></div>
      <div className="organization-list">{data?.organizations.map(org=><button key={org.id} className={org.id===data.organization.id?"organization-option is-current":"organization-option"} disabled={switching} onClick={()=>switchOrganization(org.id)}><span><strong>{org.name}</strong><small>{org.role} · {org.slug}</small></span>{org.id===data.organization.id&&<Check size={17}/>}</button>)}</div>
    </section>

    <section className="settings-section">
      <div className="settings-section-heading"><div><h2>Appearance</h2><p>Choose how the control plane looks on this device.</p></div><Monitor size={19}/></div>
      <div className="settings-choice-row">
        <button className={theme==="light"?"settings-choice is-selected":"settings-choice"} onClick={()=>applyTheme("light")}><Sun size={17}/><span><strong>Light</strong><small>Bright control-plane workspace</small></span></button>
        <button className={theme==="dark"?"settings-choice is-selected":"settings-choice"} onClick={()=>applyTheme("dark")}><Moon size={17}/><span><strong>Dark</strong><small>Low-light control-plane workspace</small></span></button>
      </div>
    </section>

    <section className="settings-section">
      <div className="settings-section-heading"><div><h2>Notifications</h2><p>Choose which operational messages Agata Proxima should deliver.</p></div><ShieldCheck size={19}/></div>
      <div className="settings-toggle-list">
        {([["security","Security alerts","Sign-in, verification and security events."],["product","Product updates","Important product and platform updates."],["billing","Billing notifications","Billing, plan and entitlement changes."]] as const).map(([key,label,description])=><label className="settings-toggle" key={key}><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" checked={notifications[key]} onChange={e=>setNotifications(v=>({...v,[key]:e.target.checked}))}/></label>)}
      </div>
    </section>

    <section className="settings-section">
      <div className="settings-section-heading"><div><h2>Security & account actions</h2><p>High-impact controls are kept together and require deliberate actions.</p></div><ShieldCheck size={19}/></div>
      <div className="settings-action-list">
        <button className="settings-action" onClick={()=>navigate("/app/settings/authentication")}><span><strong>Authentication</strong><small>Email verification, password recovery and session behavior.</small></span></button>
        <button className="settings-action" onClick={()=>navigate("/app/settings/identity")}><span><strong>Enterprise identity</strong><small>Microsoft Entra/OIDC configuration and readiness.</small></span></button>
        <button className="settings-action" onClick={()=>navigate("/app/settings/security")}><span><strong>Security controls</strong><small>CSRF, enforcement authority and protection boundaries.</small></span></button>
        <button className="settings-action" onClick={signOut}><span><strong>Sign out</strong><small>End this browser session immediately.</small></span><LogOut size={17}/></button>
        <button className="settings-action settings-action--danger" onClick={deleteAccount}><span><strong>Delete account</strong><small>Permanently remove the account when ownership constraints allow it.</small></span><Trash2 size={17}/></button>
      </div>
    </section>
  </div>;
}
