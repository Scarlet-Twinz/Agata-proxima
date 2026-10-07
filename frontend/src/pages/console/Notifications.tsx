import { Bell, Check, CheckCheck, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";

type Notification = {
  id:string; type:string; title:string; message:string; href?:string|null;
  read:boolean; created_at:string;
};

export function Notifications(){
  const [items,setItems]=useState<Notification[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  async function load(){
    setLoading(true); setError("");
    try{const result=await api.get<{notifications:Notification[]}>("/api/v1/notifications");setItems(result.notifications);}
    catch(err){setError(err instanceof Error?err.message:"Unable to load notifications.");}
    finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[]);
  async function mark(id:string){
    try{await api.post("/api/v1/notifications/"+id+"/read",{});setItems(v=>v.map(n=>n.id===id?{...n,read:true}:n));}
    catch(err){setError(err instanceof Error?err.message:"Unable to update notification.");}
  }
  async function markAll(){
    try{await api.post("/api/v1/notifications/read-all",{});setItems(v=>v.map(n=>({...n,read:true})));}
    catch(err){setError(err instanceof Error?err.message:"Unable to update notifications.");}
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
  </div>;
}
