import { Link, NavLink } from "react-router-dom";
import { AgataLogo } from "../brand/AgataLogo";

const navigation = [
  { label: "Product", path: "/product" },
  { label: "Solutions", path: "/solutions" },
  { label: "Developers", path: "/developers" },
  { label: "Pricing", path: "/pricing" },
  { label: "Security", path: "/security" },
  { label: "Docs", path: "/docs" },
];

export function PublicNavigation() {
  return (
    <header className="public-header">
      <div className="agata-container public-header-inner">
        <Link to="/" aria-label="Agata Proxima home">
          <AgataLogo />
        </Link>

        <nav className="public-nav" aria-label="Primary navigation">
          {navigation.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `public-nav-link${isActive ? " active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="public-actions">
          <Link to="/login" className="agata-button agata-button-secondary">Sign in</Link>
          <Link to="/signup" className="agata-button agata-button-primary">Start building</Link>
        </div>
      </div>
    </header>
  );
}
