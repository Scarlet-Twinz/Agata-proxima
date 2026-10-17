import type { ComponentType } from "react";
import { Github, Linkedin, Twitter } from "lucide-react";
import { Link } from "react-router-dom";
import { AgataLogo } from "../brand/AgataLogo";

type SocialIcon = ComponentType<{ size?: number }>;

type SocialProfile = {
  label: string;
  href?: string;
  icon: SocialIcon;
};

function HackerNewsIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-hidden="true">
      <rect width="24" height="24" rx="3" fill="#F0652F" />
      <path d="M5.2 5.2h2.4l4.4 6.6 4.4-6.6h2.4l-5.6 8.2v5.4h-2.4v-5.4z" fill="#fff" />
    </svg>
  );
}

const socialProfiles: SocialProfile[] = [
  { label: "GitHub", href: "https://github.com/Scarlet-Twinz/Agata-proxima", icon: Github },
  // Add the official profile URLs when they are provided; never guess social accounts.
  { label: "LinkedIn", icon: Linkedin },
  { label: "Twitter", icon: Twitter },
  { label: "Hacker News", icon: HackerNewsIcon },
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
                  <a
                    key={label}
                    className="public-social-icon"
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={"Agata Proxima on " + label}
                    title={label}
                  >
                    <Icon size={18} />
                  </a>
                ) : (
                  <span
                    key={label}
                    className="public-social-icon public-social-icon-pending"
                    aria-label={label + " profile URL not configured"}
                    title={label + " profile URL not configured"}
                    aria-disabled="true"
                  >
                    <Icon size={18} />
                  </span>
                ),
              )}
            </div>
            <p className="public-social-note">
              GitHub is linked. LinkedIn, Twitter and Hacker News will be enabled when their official profile URLs are added.
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
            <Link to="/developers/downloads">Downloads</Link>
            <Link to="/developers/quickstart">Quickstart</Link>
            <Link to="/docs">Documentation</Link>
            <Link to="/developers/webhooks">Webhooks</Link>
            <Link to="/developers/integrations">Integration catalog</Link>
            <Link to="/developers/sdks">SDK guide</Link>
            <Link to="/developers/cli">CLI guide</Link>
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
