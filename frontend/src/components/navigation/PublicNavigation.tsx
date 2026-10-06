import { Menu, X } from "lucide-react";
import { useState } from "react";
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
  const [open, setOpen] = useState(false);

  return (
    <header className="public-header">
      <div className="agata-container public-header-inner">
        <Link to="/" aria-label="Agata Proxima home" onClick={() => setOpen(false)}>
          <AgataLogo />
        </Link>

        <nav className="public-nav" aria-label="Primary navigation">
          {navigation.map((item) => (
            <NavLink key={item.path} to={item.path} className={({ isActive }) => `public-nav-link${isActive ? " active" : ""}`}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="public-actions">
          <Link to="/login" className="agata-button agata-button-secondary">Sign in</Link>
          <Link to="/signup" className="agata-button agata-button-primary">Start building</Link>
          <button
            type="button"
            className="public-mobile-toggle"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="public-mobile-nav">
          <nav aria-label="Mobile navigation">
            {navigation.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setOpen(false)}
                className={({ isActive }) => `public-mobile-nav-link${isActive ? " active" : ""}`}
              >
                {item.label}
              </NavLink>
            ))}
            <Link to="/company" onClick={() => setOpen(false)} className="public-mobile-nav-link">Company</Link>
            <Link to="/support" onClick={() => setOpen(false)} className="public-mobile-nav-link">Support</Link>
            <Link to="/contact" onClick={() => setOpen(false)} className="public-mobile-nav-link">Contact</Link>
          </nav>
        </div>
      )}
    </header>
  );
}
