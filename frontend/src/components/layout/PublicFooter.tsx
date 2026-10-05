import { Link } from "react-router-dom";
import { AgataLogo } from "../brand/AgataLogo";

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="agata-container">

        <div className="public-footer-grid">

          <div>
            <AgataLogo />
            <p
              style={{
                maxWidth: 280,
                marginTop: 20,
                color: "#9db0c8",
                fontSize: 13,
                lineHeight: 1.7,
              }}
            >
              Tenant isolation infrastructure designed to be
              enforceable, independently verifiable and auditable.
            </p>
          </div>

          <div>
            <div className="public-footer-title">
              Product
            </div>
            <Link to="/product">Product</Link>
            <Link to="/solutions">Solutions</Link>
            <Link to="/pricing">Pricing</Link>
            <Link to="/security">Security</Link>
          </div>

          <div>
            <div className="public-footer-title">
              Developers
            </div>
            <Link to="/developers">Developer platform</Link>
            <Link to="/docs">Documentation</Link>
            <Link to="/changelog">Changelog</Link>
          </div>

          <div>
            <div className="public-footer-title">
              Company
            </div>
            <Link to="/company">Company</Link>
            <Link to="/trust">Trust</Link>
            <Link to="/status">Status</Link>
            <Link to="/contact">Contact</Link>\n            <Link to="/terms">Terms</Link>\n            <Link to="/privacy">Privacy</Link>
          </div>

          <div>
            <div className="public-footer-title">
              Help
            </div>
            <Link to="/support">Support</Link>
            <Link to="/faq">FAQ</Link>
            <Link to="/login">Sign in</Link>
            <Link to="/signup">Start building</Link>
          </div>

        </div>

        <div className="public-footer-bottom">
          <span>
            © 2026 Agata Proxima. All rights reserved.
          </span>

          <span>
            Tenant isolation infrastructure.
          </span>
        </div>

      </div>
    </footer>
  );
}
