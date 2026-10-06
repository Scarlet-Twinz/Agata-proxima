import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import logoUrl from "../../assets/agata-proxima-logo.svg";

const groups = [
  { label:"Product", items:[["Overview","/product"],["Operating Model","/product/operating-model"],["Enforcement","/product/enforcement"],["Verification","/product/verification"],["Evidence","/product/evidence"]] },
  { label:"Solutions", items:[["Overview","/solutions"],["B2B SaaS","/solutions/b2b-saas"],["Enterprise SaaS","/solutions/enterprise-saas"],["Developer Platforms","/solutions/developer-platforms"],["Security-Sensitive Systems","/solutions/security-sensitive-systems"],["Startups","/solutions/startups"],["Platform Engineering","/solutions/platform-engineering"]] },
  { label:"Developers", items:[["Developer Platform","/developers"],["Quickstart","/developers/quickstart"],["Authentication","/developers/authentication"],["Tenant Context","/developers/tenant-context"],["Verification","/developers/verification"],["API Reference","/developers/api-reference"],["Webhooks","/developers/webhooks"],["SDKs","/developers/sdks"],["CLI","/developers/cli"],["Terraform","/developers/terraform"]] },
  { label:"Documentation", items:[["Documentation","/docs"],["Getting Started","/docs/getting-started"],["Core Concepts","/docs/core-concepts"],["API Reference","/docs/api-reference"],["Security","/docs/security"],["Operations","/docs/operations"],["Troubleshooting","/docs/troubleshooting"]] },
  { label:"Company", items:[["Company","/company"],["Trust","/trust"],["Status","/status"],["Changelog","/changelog"],["Contact","/contact"],["Support","/support"],["FAQ","/faq"]] },
];

export default function PublicNavigation(){
  const [open,setOpen]=useState<string|null>(null); const location=useLocation();
  return <header className="agata-public-nav"><div className="agata-public-nav-inner">
    <Link className="agata-public-brand" to="/" onClick={()=>setOpen(null)}><img src={logoUrl} alt="Agata Proxima"/></Link>
    <nav className="agata-public-links" aria-label="Public navigation">
      {groups.map(group=>{const active=group.items.some(([,href])=>location.pathname===href||location.pathname.startsWith(`${href}/`));return <div className="agata-public-group" key={group.label}>
        <button type="button" className={active?"active":""} onClick={()=>setOpen(open===group.label?null:group.label)}>{group.label} <span aria-hidden="true">⌄</span></button>
        {open===group.label&&<div className="agata-public-menu">{group.items.map(([label,href])=><Link key={href} to={href} onClick={()=>setOpen(null)}><strong>{label}</strong></Link>)}</div>}
      </div>})}
    </nav>
    <div className="agata-public-actions"><Link className="agata-public-signin" to="/login">Sign in</Link><Link className="agata-public-start" to="/signup">Start building</Link></div>
  </div></header>;
}
