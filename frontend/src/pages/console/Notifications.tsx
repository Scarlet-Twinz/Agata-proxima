import { Bell, Check, CheckCheck, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";

type Notification = {
  id:string; type:string; title:string; message:string; href?:string|null;
  read:boolean; created_at:string;
};
type AuditEvent = {
  id:string; action:string; resource_type:string; resource_id:string|null;
  metadata:Record<string,unknown>; created_at:string;
};

export function Notifications(){
  const [items,setItems]=useState<Notification[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [activity,setActivity]=useState<AuditEvent[]>([]);
  const [activityLoading,setActivityLoading]=useState(true);
  const [activityError,setActivityError]=useState("");
  function publishUnreadCount(unread:number){
    window.dispatchEvent(new CustomEvent("agata:notifications-unread-change",{detail:{unread}}));
  }
  const load=useCallback(async (showLoading=true)=>{
    if(showLoading){setLoading(true);setError("");}
    try{
      const result=await api.get<{notifications:Notification[]}>("/api/v1/notifications");
      const notifications=result.notifications;
      setItems(notifications);
      // Opening the notifications page is read-only. Only an explicit user
      // action may mark an individual notification or all notifications read.
      publishUnreadCount(notifications.filter(n=>!n.read).length);
    }catch(err){setError(err instanceof Error?err.message:"Unable to load notifications.");}
    finally{setLoading(false);}
  },[]);
  const loadActivity=useCallback(async()=>{
    setActivityLoading(true);setActivityError("");
    try{setActivity(await api.get<AuditEvent[]>("/api/v1/audit"));}
    catch(err){setActivityError(err instanceof Error?err.message:"Unable to load organization activity.");}
    finally{setActivityLoading(false);}
  },[]);
  useEffect(()=>{void load(false);void loadActivity();},[load,loadActivity]);
  async function mark(id:string){
    try{
      await api.post("/api/v1/notifications/"+id+"/read",{});
      setItems(v=>v.map(n=>n.id===id?{...n,read:true}:n));
      publishUnreadCount(Math.max(0,unread-1));
    }catch(err){setError(err instanceof Error?err.message:"Unable to update notification.");}
  }
  async function markAll(){
    try{
      await api.post("/api/v1/notifications/read-all",{});
      setItems(v=>v.map(n=>({...n,read:true})));
      publishUnreadCount(0);
    }catch(err){setError(err instanceof Error?err.message:"Unable to update notifications.");}
  }
  const unread=items.filter(n=>!n.read).length;
  return <div className="notifications-page">
    <div className="page-heading">
      <div><span className="eyebrow">NOTIFICATIONS</span><h1>Activity & notifications</h1><p>Important account, security, workspace and support events appear here so you do not have to hunt through Settings.</p></div>
      {unread>0&&<button className="secondary-action" type="button" onClick={markAll}><CheckCheck size={15}/>Mark all read</button>}
    </div>
    {error&&<div className="settings-banner settings-banner--error">{error}</div>}
    <div className="notifications-summary"><span><Bell size={16}/>{unread} unread</span><span>{items.length} recent events</span></div>
    {loading ? <div className="surface empty-state"><strong>Loading notifications…</strong><span>Reading recent activity for this account.</span></div> :
      items.length===0 ? <div className="surface empty-state"><Bell size={24}/><strong>No notifications yet</strong><span>Security events, organization activity, support updates and other important events will appear here.</span></div> :
      <div className="notification-list">{items.map(item=>{
        const content=<div className={item.read?"notification-item":"notification-item is-unread"} onClick={()=>{if(!item.read)void mark(item.id);}}>
          <div className={"notification-icon notification-icon--"+item.type}><Bell size={17}/></div>
          <div className="notification-copy"><div className="notification-title-row"><strong>{item.title}</strong>{!item.read&&<span className="notification-unread">NEW</span>}</div><p>{item.message}</p><small>{new Date(item.created_at).toLocaleString()}</small></div>
          {item.href?<ChevronRight size={17}/>:item.read?<Check size={17}/>:null}
        </div>;
        return item.href ? <Link to={item.href} key={item.id} className="notification-link">{content}</Link> : <div key={item.id}>{content}</div>;
      })}</div>}
    <section className="surface notifications-activity-section">
      <div className="surface-heading">
        <div><span className="eyebrow">ORGANIZATION ACTIVITY</span><h2>Recent security and workspace events</h2><p>Authentication, tenant, policy, verification and administrative actions recorded in the audit log.</p></div>
        <Link className="table-detail-link" to="/app/audit">Open audit explorer <ChevronRight size={15}/></Link>
      </div>
      {activityLoading ? <div className="empty-state"><strong>Loading organization activity…</strong><span>Reading recent events from the audit log.</span></div> :
        activityError ? <div className="empty-state resource-error"><strong>{activityError}</strong><span>Check access to the Audit explorer and refresh this page.</span></div> :
        activity.length===0 ? <div className="empty-state"><Bell size={22}/><strong>No organization activity recorded yet</strong><span>Once an authentication, tenant, policy, verification or administrative action is recorded, it will appear here.</span></div> :
        <div className="notification-list">{activity.slice(0,50).map(event=><Link to="/app/audit" className="notification-link" key={event.id}>
          <div className="notification-item">
            <div className="notification-icon"><Bell size={17}/></div>
            <div className="notification-copy">
              <div className="notification-title-row"><strong>{event.action.replaceAll("_"," ").replaceAll("."," · ")}</strong><span className="notification-unread">{event.resource_type}</span></div>
              <p>{event.resource_id ? `Resource ID: ${event.resource_id}` : "Workspace-level event"}{Object.keys(event.metadata??{}).length ? ` · ${Object.entries(event.metadata).slice(0,3).map(([key,value])=>`${key.replaceAll("_"," ")}: ${String(value)}`).join(" · ")}` : ""}</p>
              <small>{new Date(event.created_at).toLocaleString()}</small>
            </div>
            <ChevronRight size={17}/>
          </div>
        </Link>)}</div>}
    </section>
  </div>;
}
