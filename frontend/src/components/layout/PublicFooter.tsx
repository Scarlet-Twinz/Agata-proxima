import { Github, Globe2, Link2, Share2 } from "lucide-react";
import { Link } from "react-router-dom";
import { AgataLogo } from "../brand/AgataLogo";

type SocialProfile = {
  label: string;
  href?: string;
  icon: typeof Globe2;
};

const socialProfiles: SocialProfile[] = [
  { label: "LinkedIn", icon: Link2 },
  { label: "Twitter / X", icon: Share2 },
  { label: "Instagram", icon: Share2 },
  { label: "GitHub", href: "https://github.com/Scarlet-Twinz/Agata-proxima", icon: Github },
];

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
            <div className="public-social-links" aria-label="Agata Proxima social profiles">
              {socialProfiles.map(({ label, href, icon: Icon }) =>
                href ? (
                  <a key={label} className="public-social-icon" href={href} target="_blank" rel="noreferrer" aria-label={"Agata Proxima on " + label} title={label}>
                    <Icon size={18} />
                  </a>
                ) : (
                  <span key={label} className="public-social-icon public-social-icon-pending" aria-label={label + " profile URL not configured"} title={label + " profile URL not configured"} aria-disabled="true">
                    <Icon size={18} />
                  </span>
                ),
              )}
            </div>
            <p className="public-social-note">
              LinkedIn, Twitter/X and Instagram are shown as reserved social
              destinations until their official profile URLs are configured.
            </p>
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
