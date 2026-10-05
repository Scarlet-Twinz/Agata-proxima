import { Menu, Search, Bell } from "lucide-react";
import { Outlet, useLocation } from "react-router-dom";
import { useState } from "react";
import ConsoleSidebar from "../components/console/ConsoleSidebar";

const labels: Record<string, string> = {
  "/app": "Overview",
  "/app/tenants": "Tenants",
  "/app/policies": "Policies",
  "/app/nodes": "Proxima Nodes",
  "/app/deployments": "Deployments",
  "/app/verification": "Verification",
  "/app/audit": "Audit",
  "/app/security": "Security",
  "/app/team": "Team",
  "/app/billing": "Billing",
  "/app/developer": "Developer",
  "/app/settings": "Settings",
};

export default function ConsoleLayout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const pageTitle = labels[location.pathname] ?? "Command Center";

  return (
    <div className="console-shell">
      <ConsoleSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="console-main">
        <header className="console-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              className="console-mobile-toggle"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={17} />
            </button>

            <div className="console-breadcrumb">
              <span>Workspace</span>
              <span>/</span>
              <strong>{pageTitle}</strong>
            </div>
          </div>

          <div className="console-top-actions">
            <button
              className="console-icon-button"
              aria-label="Search"
              type="button"
            >
              <Search size={16} />
            </button>

            <button
              className="console-icon-button"
              aria-label="Notifications"
              type="button"
            >
              <Bell size={16} />
            </button>

            <div className="console-user">
              <div className="console-avatar">AC</div>

              <div className="console-user-text">
                <strong>Workspace Admin</strong>
                <span>Administrator</span>
              </div>
            </div>
          </div>
        </header>

        <main className="console-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

