import { Github } from "lucide-react";
import { Link } from "react-router-dom";
import { AgataLogo } from "../brand/AgataLogo";

const githubUrl = "https://github.com/Scarlet-Twinz/Agata-proxima";

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="agata-container">
        <div className="public-footer-grid">
          <div>
            <AgataLogo />
            <p className="public-footer-copy">
              Tenant isolation infrastructure designed to be enforceable,
              independently verifiable and auditable.
            </p>
            <a
              className="public-social-link"
              href={githubUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Agata Proxima on GitHub"
            >
              <Github size={17} />
              GitHub
            </a>
          </div>

          <div>
            <div className="public-footer-title">Product</div>
            <Link to="/product">Product</Link>
            <Link to="/solutions">Solutions</Link>
            <Link to="/pricing">Pricing</Link>
            <Link to="/security">Security</Link>
            <Link to="/trust">Trust</Link>
          </div>

          <div>
            <div className="public-footer-title">Developers</div>
            <Link to="/developers">Developer platform</Link>
            <Link to="/developers/quickstart">Quickstart</Link>
            <Link to="/docs">Documentation</Link>
            <Link to="/developers/webhooks">Webhooks</Link>
            <Link to="/developers/terraform">Terraform</Link>
          </div>

          <div>
            <div className="public-footer-title">Company</div>
            <Link to="/company">Company</Link>
            <Link to="/status">Status</Link>
            <Link to="/changelog">Changelog</Link>
            <Link to="/contact">Contact</Link>
            <Link to="/faq">FAQ</Link>
          </div>

          <div>
            <div className="public-footer-title">Help & legal</div>
            <Link to="/support">Support</Link>
            <Link to="/docs/troubleshooting">Troubleshooting</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/login">Sign in</Link>
          </div>
        </div>

        <div className="public-footer-bottom">
          <span>© 2026 Agata Proxima. All rights reserved.</span>
          <span>Tenant isolation infrastructure.</span>
        </div>
      </div>
    </footer>
  );
}
