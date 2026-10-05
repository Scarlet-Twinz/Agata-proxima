import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
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

export function ConsoleLayout() {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("agata.console.sidebar") === "collapsed";
  });

  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(
      "agata.console.sidebar",
      collapsed ? "collapsed" : "expanded",
    );
  }, [collapsed]);

  return (
    <div
      className={[
        "console-root",
        collapsed ? "console-root--collapsed" : "",
      ].join(" ")}
    >
      {mobileOpen && (
        <button
          className="console-mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={[
          "console-sidebar",
          mobileOpen ? "console-sidebar--mobile-open" : "",
        ].join(" ")}
      >
        <div className="console-brand">
          <div className="console-brand-mark">A</div>

          {!collapsed && (
            <div>
              <strong>AGATA PROXIMA</strong>
              <span>Control Plane</span>
            </div>
          )}

          <button
            className="console-icon-button console-mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <button className="workspace-switcher">
          <span className="workspace-symbol">A</span>

          {!collapsed && (
            <span className="workspace-copy">
              <strong>Workspace</strong>
              <small>Production</small>
            </span>
          )}

          {!collapsed && <ChevronDown size={16} />}
        </button>

        <nav className="console-nav">
          <div className="console-nav-group">
            {!collapsed && <span className="console-nav-label">CONTROL</span>}

            {primaryNavigation.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  end={item.href === "/app"}
                  title={collapsed ? item.label : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `console-nav-link ${isActive ? "is-active" : ""}`
                  }
                >
                  <Icon size={19} strokeWidth={1.8} />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              );
            })}
          </div>

          <div className="console-nav-group">
            {!collapsed && <span className="console-nav-label">PLATFORM</span>}

            {platformNavigation.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  title={collapsed ? item.label : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `console-nav-link ${isActive ? "is-active" : ""}`
                  }
                >
                  <Icon size={19} strokeWidth={1.8} />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              );
            })}
          </div>
        </nav>

        <div className="console-sidebar-footer">
          <button
            className="sidebar-collapse-button"
            onClick={() => setCollapsed((value) => !value)}
            title={collapsed ? "Expand navigation" : "Collapse navigation"}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}

            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      <main className="console-main">
        <header className="console-topbar">
          <div className="console-topbar-left">
            <button
              className="console-icon-button console-mobile-menu"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>

            <div className="console-breadcrumb">
              <span>Agata Proxima</span>
              <span>/</span>
              <strong>Control Plane</strong>
            </div>
          </div>

          <div className="console-topbar-actions">
            <button className="environment-button">
              <span className="environment-dot" />
              Production
              <ChevronDown size={15} />
            </button>

            <button className="command-button">
              <Search size={17} />
              <span>Search</span>
              <kbd>⌘K</kbd>
            </button>

            <button className="console-account">
              <span className="account-avatar">A</span>
              <span>Anthony</span>
              <ChevronDown size={15} />
            </button>
          </div>
        </header>

        <section className="console-content">
          <Outlet />
        </section>
      </main>
    </div>
  );
}

