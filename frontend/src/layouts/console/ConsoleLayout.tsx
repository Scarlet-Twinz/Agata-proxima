import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  CircleHelp,
  CreditCard,
  Database,
  FileSearch,
  Gauge,
  KeyRound,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { AgataLogo } from "../../components/brand/AgataLogo";
import { logout } from "../../api/auth";

const primaryNavigation = [
  { label: "Overview", href: "/app", icon: Gauge },
  { label: "Security", href: "/app/security", icon: ShieldCheck },
  { label: "Tenants", href: "/app/tenants", icon: Users },
  { label: "Policies", href: "/app/policies", icon: SlidersHorizontal },
  { label: "Nodes", href: "/app/nodes", icon: Database },
  { label: "Deployments", href: "/app/deployments", icon: Rocket },
  { label: "Verification", href: "/app/verification", icon: ShieldCheck },
  { label: "Audit", href: "/app/audit", icon: FileSearch },
  { label: "Team", href: "/app/team", icon: Users },
  { label: "Billing", href: "/app/billing", icon: CreditCard },
];

const platformNavigation = [
  { label: "Developer", href: "/app/developer", icon: KeyRound },
  { label: "Settings", href: "/app/settings", icon: Settings },
  { label: "Support", href: "/app/support", icon: CircleHelp },
];

const searchableRoutes = [
  ...primaryNavigation,
  ...platformNavigation,
  { label: "API Keys", href: "/app/developer/api-keys" },
  { label: "Tenant Context", href: "/app/developer/tenant-context" },
  { label: "Webhooks", href: "/app/developer/webhooks" },
  { label: "API Reference", href: "/app/developer/api-reference" },
  { label: "Billing Usage", href: "/app/billing/usage" },
  { label: "Billing Plans", href: "/app/billing/plans" },
  { label: "Billing Invoices", href: "/app/billing/invoices" },
  { label: "Enterprise Identity", href: "/app/settings/identity" },
];

export function ConsoleLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("agata.console.sidebar") === "collapsed",
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [environmentOpen, setEnvironmentOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("agata.console.sidebar", collapsed ? "collapsed" : "expanded");
  }, [collapsed]);

  useEffect(() => {
    setSearchOpen(false);
    setSearch("");
    setEnvironmentOpen(false);
    setAccountOpen(false);
  }, [location.pathname]);

  const results = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return searchableRoutes.slice(0, 8);
    return searchableRoutes.filter((item) => item.label.toLowerCase().includes(query)).slice(0, 8);
  }, [search]);

  async function signOut() {
    try {
      await logout();
    } finally {
      localStorage.removeItem("agata.session");
      navigate("/login", { replace: true });
    }
  }

  return (
    <div className={`console-root ${collapsed ? "console-root--collapsed" : ""}`}>
      {mobileOpen && <button className="console-mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}

      <aside className={`console-sidebar ${mobileOpen ? "console-sidebar--mobile-open" : ""}`}>
        <div className="console-brand">
          <NavLink to="/app" aria-label="Agata Proxima control plane">
            <AgataLogo compact />
          </NavLink>
          {!collapsed && <div className="console-brand-copy"><strong>AGATA PROXIMA</strong><span>Control Plane</span></div>}
          <button className="console-icon-button console-mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>

        <button className="workspace-switcher" onClick={() => setEnvironmentOpen((v) => !v)}>
          <span className="workspace-symbol">A</span>
          {!collapsed && <span className="workspace-copy"><strong>Workspace</strong><small>Environment</small></span>}
          {!collapsed && <ChevronDown size={16} />}
        </button>

        <nav className="console-nav">
          <div className="console-nav-group">
            {!collapsed && <span className="console-nav-label">CONTROL</span>}
            {primaryNavigation.map((item) => {
              const Icon = item.icon;
              return <NavLink key={item.href} to={item.href} end={item.href === "/app"} title={collapsed ? item.label : undefined} onClick={() => setMobileOpen(false)} className={({ isActive }) => `console-nav-link ${isActive ? "is-active" : ""}`}><Icon size={19} strokeWidth={1.8}/>{!collapsed && <span>{item.label}</span>}</NavLink>;
            })}
          </div>
          <div className="console-nav-group">
            {!collapsed && <span className="console-nav-label">PLATFORM</span>}
            {platformNavigation.map((item) => {
              const Icon = item.icon;
              return <NavLink key={item.href} to={item.href} title={collapsed ? item.label : undefined} onClick={() => setMobileOpen(false)} className={({ isActive }) => `console-nav-link ${isActive ? "is-active" : ""}`}><Icon size={19} strokeWidth={1.8}/>{!collapsed && <span>{item.label}</span>}</NavLink>;
            })}
          </div>
        </nav>

        <div className="console-sidebar-footer">
          <button className="sidebar-collapse-button" onClick={() => setCollapsed((v) => !v)} title={collapsed ? "Expand navigation" : "Collapse navigation"}>
            {collapsed ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      <main className="console-main">
        <header className="console-topbar">
          <div className="console-topbar-left">
            <button className="console-icon-button console-mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={20}/></button>
            <div className="console-breadcrumb"><span>Agata Proxima</span><span>/</span><strong>Control Plane</strong></div>
          </div>

          <div className="console-topbar-actions">
            <div className="console-menu-anchor">
              <button className="environment-button" onClick={() => setEnvironmentOpen((v) => !v)}><span className="environment-dot"/><span>Environment</span><ChevronDown size={15}/></button>
              {environmentOpen && <div className="console-popover environment-popover"><strong>No environments connected</strong><span>Environment state will come from workspace configuration.</span><NavLink to="/app/settings/environments">Configure environments →</NavLink></div>}
            </div>

            <div className="console-menu-anchor">
              <button className="command-button" onClick={() => setSearchOpen((v) => !v)}><Search size={17}/><span>Search</span><kbd>⌘K</kbd></button>
              {searchOpen && <div className="console-search-popover"><input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search the control plane…" aria-label="Search the control plane"/><div className="console-search-results">{results.map((item) => <button key={item.href} onClick={() => navigate(item.href)}>{item.label}<span>↗</span></button>)}</div></div>}
            </div>

            <div className="console-menu-anchor">
              <button className="console-account" onClick={() => setAccountOpen((v) => !v)}><span className="account-avatar">A</span><span>Account</span><ChevronDown size={15}/></button>
              {accountOpen && <div className="console-popover account-popover"><strong>Account</strong><span>Identity will be populated from the authenticated session.</span><button onClick={signOut}>Sign out</button></div>}
            </div>
          </div>
        </header>
        <section className="console-content"><Outlet /></section>
      </main>
    </div>
  );
}
