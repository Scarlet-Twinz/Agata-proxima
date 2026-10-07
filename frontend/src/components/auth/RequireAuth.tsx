import { useEffect,useState } from "react";
import { Navigate,Outlet,useLocation } from "react-router-dom";
import { getSession,type Session } from "../../api/auth";

export default function RequireAuth() {
  const location=useLocation();
  const [session,setSession]=useState<Session|null>(null);
  const [checking,setChecking]=useState(true);
  useEffect(()=>{let mounted=true; getSession().then(s=>{if(mounted)setSession(s)}).catch(()=>{if(mounted)setSession(null)}).finally(()=>{if(mounted)setChecking(false)}); return()=>{mounted=false}},[]);
  if(checking) return <div style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#F7F8FA"}}>Checking secure session…</div>;
  if(!session) return <Navigate to="/login" replace state={{from:location.pathname}}/>;
  return <Outlet/>;
}
