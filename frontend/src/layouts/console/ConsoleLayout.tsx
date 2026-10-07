import { useEffect, useMemo, useState } from "react";
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
import { api } from "../../api/client";
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

const searchNavigation = [
  ...primaryNavigation,
  ...platformNavigation,
  { label: "Billing usage", href: "/app/billing/usage", icon: CreditCard },
  { label: "Billing plans", href: "/app/billing/plans", icon: CreditCard },
  { label: "Billing invoices", href: "/app/billing/invoices", icon: CreditCard },
  { label: "Tenant isolation", href: "/app/security/tenant-isolation", icon: ShieldCheck },
  { label: "Security events", href: "/app/security/events", icon: FileSearch },
  { label: "Developer API keys", href: "/app/developer/api-keys", icon: KeyRound },
  { label: "Developer tenant context", href: "/app/developer/tenant-context", icon: KeyRound },
  { label: "Developer webhooks", href: "/app/developer/webhooks", icon: KeyRound },
  { label: "Developer API reference", href: "/app/developer/api-reference", icon: KeyRound },
  { label: "Settings authentication", href: "/app/settings/authentication", icon: Settings },
  { label: "Settings identity", href: "/app/settings/identity", icon: Settings },
  { label: "Settings security", href: "/app/settings/security", icon: Settings },
];

export function ConsoleLayout() {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("agata.console.sidebar") === "collapsed";
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [environmentOpen, setEnvironmentOpen] = useState(false);
  const [environments, setEnvironments] = useState<Array<{id:string;name:string;slug:string;kind:string;status:string}>>([]);
  const [activeProjectId, setActiveProjectId] = useState(() => localStorage.getItem("agata.active.project") || "");
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [organizations, setOrganizations] = useState<Array<{id:string;name:string;slug:string;role:string}>>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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

    api.get<Array<{id:string;name:string;slug:string;role:string}>>("/api/v1/organizations").then(setOrganizations).catch(()=>{});
    api.get<Array<{id:string;name:string;slug:string}>>("/api/v1/projects").then((items) => {
      const saved = localStorage.getItem("agata.active.project");
      const selected = items.find((item) => item.id === saved) ?? items[0];
      if (selected) {
        setActiveProjectId(selected.id);
        localStorage.setItem("agata.active.project", selected.id);
      }
    }).catch(()=>{});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!activeProjectId) { setEnvironments([]); return; }
    api.get<Array<{id:string;name:string;slug:string;kind:string;status:string}>>(`/api/v1/projects/${activeProjectId}/environments`).then(setEnvironments).catch(() => setEnvironments([]));
  }, [activeProjectId]);

  async function handleLogout() {
    await logout();
    setAccountOpen(false);
    navigate("/login", { replace: true });
  }

  const accountLabel = session?.user_id || "Account";
  const accountInitial = accountLabel.slice(0, 1).toUpperCase();

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return searchNavigation.slice(0, 8);

    return searchNavigation.filter((item) =>
      item.label.toLowerCase().includes(query),
    );
  }, [searchQuery]);

  function openSearch() {
    setSearchOpen(true);
    setSearchQuery("");
    setEnvironmentOpen(false);
  }

  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery("");
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }

      if (searchOpen && event.key === "Escape") {
        closeSearch();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchOpen]);

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

        <button className="workspace-switcher" type="button" aria-expanded={workspaceOpen} onClick={() => { setWorkspaceOpen(v => !v); setAccountOpen(false); setEnvironmentOpen(false); }}>
          <span className="workspace-symbol">A</span>

          {!collapsed && (
            <span className="workspace-copy">
              <strong>Workspace</strong>
              <small>Production</small>
            </span>
          )}

          {!collapsed && <ChevronDown size={16} />}
        </button>

        {!collapsed && workspaceOpen && (
          <div className="console-workspace-menu">
            {organizations.map((org) => (
              <button key={org.id} type="button" onClick={async () => {
                const switched = await api.post<{csrf_token:string}>("/api/v1/organization/switch", { organization_id: org.id });
                sessionStorage.setItem("proxima_csrf", switched.csrf_token);
                setWorkspaceOpen(false);
                window.location.reload();
              }}>
                <strong>{org.name}</strong><small>{org.role}</small>
              </button>
            ))}
            <button type="button" onClick={() => { setWorkspaceOpen(false); navigate("/app/projects"); }}>Manage projects</button>
          </div>
        )}

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

      {searchOpen && (
        <div className="console-search-backdrop" onMouseDown={closeSearch}>
          <div
            className="console-search-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Search console"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="console-search-input-wrap">
              <Search size={18} />
              <input
                autoFocus
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search the control plane..."
                aria-label="Search the control plane"
              />
              <kbd>Esc</kbd>
            </div>

            <div className="console-search-results">
              {searchResults.length ? (
                searchResults.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      className="console-search-result"
                      type="button"
                      key={item.href}
                      onClick={() => {
                        closeSearch();
                        navigate(item.href);
                      }}
                    >
                      <Icon size={17} />
                      <span>{item.label}</span>
                    </button>
                  );
                })
              ) : (
                <div className="console-search-empty">
                  No console surface matches “{searchQuery}”.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
            <div className="console-environment-wrap">
              <button
                className="environment-button"
                type="button"
                aria-expanded={environmentOpen}
                onClick={() => {
                  setEnvironmentOpen((value) => !value);
                  setAccountOpen(false);
                }}
              >
                <span className="environment-dot" />
                {environments.find((environment) => environment.kind === "production")?.name ?? "Environment"}
                <ChevronDown size={15} />
              </button>

              {environmentOpen && (
                <div className="console-environment-menu">
                  {environments.length ? environments.map((environment) => (
                    <button
                      key={environment.id}
                      className="console-environment-option"
                      type="button"
                      onClick={() => {
                        setEnvironmentOpen(false);
                        navigate(`/app/projects/${activeProjectId}/environments/${environment.id}`);
                      }}
                    >
                      <span>
                        <strong>{environment.name}</strong>
                        <small>{environment.kind} · {environment.status}</small>
                      </span>
                      {environment.kind === "production" && <span className="environment-check">●</span>}
                    </button>
                  )) : (
                    <div className="console-search-empty">No environments are available for the active project.</div>
                  )}
                  <button
                    className="console-environment-settings"
                    type="button"
                    onClick={() => {
                      setEnvironmentOpen(false);
                      navigate(activeProjectId ? `/app/projects/${activeProjectId}` : "/app/projects");
                    }}
                  >
                    Manage environments
                  </button>
                </div>
              )}
            </div>

            <button
              className="command-button"
              type="button"
              onClick={openSearch}
              aria-haspopup="dialog"
              aria-expanded={searchOpen}
            >
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
