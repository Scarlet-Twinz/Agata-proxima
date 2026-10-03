const API = new URLSearchParams(location.search).get("api") || "http://127.0.0.1:9090";
const $ = (id) => document.getElementById(id);
function state(el, value){el.textContent=value?"Active":"Disabled";}
async function refresh(){
  try{
    const res=await fetch(API+"/metrics",{cache:"no-store"});
    if(!res.ok) throw new Error("telemetry "+res.status);
    const m=await res.json();
    $("system-status").className="status ok"; $("system-status").innerHTML="<i></i> SYSTEM OPERATIONAL";
    $("engine").textContent="Healthy"; $("postgres").textContent=m.postgresql==="configured"?"Configured":"Unknown";
    state($("tls"),m.tls); state($("upstream-tls"),m.upstream_tls); state($("enforcement"),m.tenant_enforcement);
    $("active").textContent=m.active_connections; $("accepted").textContent=m.accepted_connections+" accepted sessions";
    $("tls-count").textContent=m.tls_sessions; $("rejected").textContent=m.rejected_connections; $("auth-failures").textContent=m.auth_failures;
  }catch(e){
    $("system-status").className="status bad"; $("system-status").innerHTML="<i></i> TELEMETRY OFFLINE";
  }
}
$("verify").addEventListener("click",()=>alert("Run tools/proxima-verify.sh from a configured deployment. The dashboard does not fabricate verification results."));
document.querySelectorAll("nav a").forEach(a=>a.addEventListener("click",()=>{document.querySelectorAll("nav a").forEach(x=>x.classList.remove("active"));a.classList.add("active")}));
refresh(); setInterval(refresh,3000);