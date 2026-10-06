import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
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
import { getSession, logout, type Session } from "../../api/auth";
import { AgataLogo } from "../../components/brand/AgataLogo";

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
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("agata.console.sidebar") === "collapsed";
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    localStorage.setItem(
      "agata.console.sidebar",
      collapsed ? "collapsed" : "expanded",
    );
  }, [collapsed]);

  useEffect(() => {
    let active = true;
    getSession()
      .then((current) => {
        if (active) setSession(current);
      })
      .catch(() => {
        if (active) setSession(null);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleLogout() {
    await logout();
    setAccountOpen(false);
    navigate("/login", { replace: true });
  }

  const accountLabel = session?.user_id || "Account";
  const accountInitial = accountLabel.slice(0, 1).toUpperCase();

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
          <AgataLogo compact />

          {!collapsed && (
            <div className="console-brand-copy">
              <strong>AGATA PROXIMA</strong>
              <span>Control Plane</span>
            </div>
          )}

          <button
            className="console-icon-button console-sidebar-collapse"
            onClick={() => setCollapsed((value) => !value)}
            title={collapsed ? "Expand navigation" : "Collapse navigation"}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          >
            {collapsed ? (
              <PanelLeftOpen size={17} />
            ) : (
              <PanelLeftClose size={17} />
            )}
          </button>

          <button
            className="console-icon-button console-mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <button className="workspace-switcher" type="button">
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
            <button className="environment-button" type="button">
              <span className="environment-dot" />
              Production
              <ChevronDown size={15} />
            </button>

            <button className="command-button" type="button">
              <Search size={17} />
              <span>Search</span>
              <kbd>⌘K</kbd>
            </button>

            <div className="console-account-wrap">
              <button
                className="console-account"
                type="button"
                aria-expanded={accountOpen}
                onClick={() => setAccountOpen((value) => !value)}
              >
                <span className="account-avatar">{accountInitial}</span>
                <span>{accountLabel}</span>
                <ChevronDown size={15} />
              </button>

              {accountOpen && (
                <div className="console-account-menu">
                  <div className="console-account-meta">
                    <strong>{accountLabel}</strong>
                    <span>{session?.role || "Account"}</span>
                  </div>
                  <button type="button" onClick={handleLogout}>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <section className="console-content">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
