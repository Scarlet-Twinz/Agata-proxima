import {
  Activity,
  Boxes,
  CreditCard,
  FileCheck2,
  FileText,
  Gauge,
  KeyRound,
  LifeBuoy,
  Network,
  Server,
  Settings,
  ShieldCheck,
  Users,
  Workflow,
  X,
} from "lucide-react";
import { NavLink, Link } from "react-router-dom";
import { AgataLogo } from "../brand/AgataLogo";
type ConsoleSidebarProps = {
  open: boolean;
  onClose: () => void;
};

const primary = [
  { to: "/app", label: "Overview", icon: Gauge, end: true },
  { to: "/app/tenants", label: "Tenants", icon: Boxes },
  { to: "/app/policies", label: "Policies", icon: FileCheck2 },
  { to: "/app/nodes", label: "Proxima Nodes", icon: Server },
  { to: "/app/deployments", label: "Deployments", icon: Workflow },
];

const security = [
  { to: "/app/verification", label: "Verification", icon: ShieldCheck },
  { to: "/app/audit", label: "Audit", icon: FileText },
  { to: "/app/security", label: "Security", icon: ShieldCheck },
];

const organization = [
  { to: "/app/team", label: "Team", icon: Users },
  { to: "/app/billing", label: "Billing", icon: CreditCard },
  { to: "/app/developer", label: "Developer", icon: KeyRound },
  { to: "/app/database", label: "Database", icon: Network },
];

export default function ConsoleSidebar({
  open,
  onClose,
}: ConsoleSidebarProps) {
  return (
    <aside className={`console-sidebar ${open ? "open" : ""}`}>
      <div className="console-brand">
        <AgataLogo compact />
        <button
          className="console-icon-button"
          onClick={onClose}
          aria-label="Close navigation"
          style={{
            marginLeft: "auto",
            display: "none",
          }}
        >
          <X size={16} />
        </button>
      </div>

      <div className="console-workspace">
        <div className="console-workspace-label">Workspace</div>

        <button className="console-workspace-button" type="button">
          <span className="console-workspace-name">
            <span className="console-workspace-mark">AC</span>
            <span>Acme Corporation</span>
          </span>

          <Activity size={14} />
        </button>
      </div>

      <nav className="console-nav">
        <div className="console-nav-section">
          <div className="console-nav-title">Operations</div>

          {primary.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `console-nav-link ${isActive ? "active" : ""}`
              }
              onClick={onClose}
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </div>

        <div className="console-nav-section">
          <div className="console-nav-title">Security</div>

          {security.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `console-nav-link ${isActive ? "active" : ""}`
              }
              onClick={onClose}
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </div>

        <div className="console-nav-section">
          <div className="console-nav-title">Organization</div>

          {organization.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `console-nav-link ${isActive ? "active" : ""}`
              }
              onClick={onClose}
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </div>

        <div className="console-nav-section">
          <div className="console-nav-title">Resources</div>

          <Link
            to="/docs"
            className="console-nav-link"
            onClick={onClose}
          >
            <Network size={15} />
            Documentation
          </Link>

          <Link
            to="/support"
            className="console-nav-link"
            onClick={onClose}
          >
            <LifeBuoy size={15} />
            Support
          </Link>
        </div>
      </nav>

      <div className="console-sidebar-footer">
        <Link
          to="/app/settings"
          className="console-sidebar-footer-link"
          onClick={onClose}
        >
          <Settings size={15} />
          Settings
        </Link>
      </div>
    </aside>
  );
}
