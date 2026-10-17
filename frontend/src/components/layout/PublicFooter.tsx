import type { ComponentType } from "react";
import { Link } from "react-router-dom";
import { AgataLogo } from "../brand/AgataLogo";

type SocialIcon = ComponentType<{ size?: number }>;

type SocialProfile = {
  label: string;
  href?: string;
  icon: SocialIcon;
};

function GithubIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .8a11.2 11.2 0 0 0-3.54 21.83c.56.1.76-.24.76-.54v-1.9c-3.1.67-3.76-1.32-3.76-1.32-.5-1.28-1.24-1.63-1.24-1.63-1.01-.69.08-.68.08-.68 1.12.08 1.71 1.14 1.71 1.14 1 1.7 2.6 1.21 3.23.92.1-.72.39-1.21.71-1.49-2.48-.28-5.09-1.24-5.09-5.52 0-1.22.44-2.21 1.14-2.99-.11-.28-.49-1.41.11-2.94 0 0 .93-.3 3.08 1.14a10.7 10.7 0 0 1 5.6 0c2.14-1.44 3.07-1.14 3.07-1.14.61 1.53.23 2.66.12 2.94.71.78 1.14 1.77 1.14 2.99 0 4.29-2.61 5.23-5.1 5.51.4.35.75 1.02.75 2.06v3.05c0 .3.2.64.77.53A11.2 11.2 0 0 0 12 .8z" />
    </svg>
  );
}

function LinkedinIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.42v1.56h.05c.47-.9 1.63-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM3.56 9h3.56v11.45H3.56z" />
    </svg>
  );
}

function TwitterIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.95 4.57a10 10 0 0 1-2.83.78 4.93 4.93 0 0 0 2.16-2.72 9.86 9.86 0 0 1-3.13 1.2 4.92 4.92 0 0 0-8.38 4.48A13.98 13.98 0 0 1 1.64 2.16a4.92 4.92 0 0 0 1.52 6.57 4.9 4.9 0 0 1-2.23-.62v.06a4.93 4.93 0 0 0 3.95 4.83 4.9 4.9 0 0 1-2.22.08 4.93 4.93 0 0 0 4.6 3.42A9.88 9.88 0 0 1 0 18.54a13.94 13.94 0 0 0 7.55 2.21c9.05 0 14-7.5 14-14v-.64a10 10 0 0 0 2.46-2.54z" />
    </svg>
  );
}

function HackerNewsIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-hidden="true">
      <rect width="24" height="24" rx="3" fill="#F0652F" />
      <path d="M5.2 5.2h2.4l4.4 6.6 4.4-6.6h2.4l-5.6 8.2v5.4h-2.4v-5.4z" fill="#fff" />
    </svg>
  );
}

const socialProfiles: SocialProfile[] = [
  { label: "GitHub", href: "https://github.com/Scarlet-Twinz/Agata-proxima", icon: GithubIcon },
  // Add official profile URLs when provided; never guess social accounts.
  { label: "LinkedIn", icon: LinkedinIcon },
  { label: "Twitter", icon: TwitterIcon },
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
          <button
            className="agata-button agata-button-secondary"
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="Scroll to the top of the page"
          >
            Back to top ↑
          </button>
        </div>
      </div>
    </footer>
  );
}
