import { Github, Linkedin, ExternalLink } from "lucide-react";
import { Link, Outlet } from "react-router-dom";
import PublicNavigation from "../components/navigation/PublicNavigation";
import "../styles/public-site.css";

const socials = [
  { label: "GitHub", href: "https://github.com/Scarlet-Twinz/Agata-proxima", icon: "github" },
  { label: "LinkedIn", href: "https://ng.linkedin.com/in/anthony-emmanuella-mmasinachi-a515543b1", icon: "linkedin" },
  { label: "X", href: "https://x.com/Worldtwins25", icon: "x" },
] as const;

function SocialIcon({ type }: { type: "github" | "linkedin" | "x" }) {
  if (type === "github") return <Github size={17} aria-hidden="true" />;
  if (type === "linkedin") return <Linkedin size={17} aria-hidden="true" />;
  return <span className="agata-social-x" aria-hidden="true">X</span>;
}

export default function PublicLayout() {
  return (
    <div className="agata-public-site">
      <PublicNavigation />
      <Outlet />
      <footer className="agata-public-footer">
        <div className="agata-public-footer-inner">
          <div className="agata-public-footer-brand">
            <strong>AGATA PROXIMA</strong>
            <p>Tenant isolation infrastructure for systems that need a boundary they can enforce and verify.</p>
            <Link className="text-link" to="/trust">Visit Trust Center →</Link>
            <div className="agata-social-links" aria-label="Agata Proxima social links">
              {socials.map((social) => (
                <a key={social.label} href={social.href} target="_blank" rel="noreferrer" aria-label={social.label}>
                  <SocialIcon type={social.icon} />
                  <span>{social.label}</span>
                  <ExternalLink size={12} aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          <div className="agata-public-footer-links">
            <div><span>PRODUCT</span><Link to="/product">Product</Link><Link to="/solutions">Solutions</Link><Link to="/pricing">Pricing</Link><Link to="/security">Security</Link><Link to="/trust">Trust</Link></div>
            <div><span>DEVELOPERS</span><Link to="/developers">Developer Platform</Link><Link to="/docs">Documentation</Link><Link to="/changelog">Changelog</Link><Link to="/status">Status</Link></div>
            <div><span>COMPANY</span><Link to="/company">Company</Link><Link to="/contact">Contact</Link><Link to="/support">Support</Link><Link to="/faq">FAQ</Link></div>
            <div><span>SOURCE</span><a href="https://github.com/Scarlet-Twinz/Agata-proxima" target="_blank" rel="noreferrer">GitHub ↗</a><Link to="/status">Status</Link></div>
            <div><span>LEGAL</span><Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link></div>
          </div>
        </div>
        <div className="agata-public-footer-bottom">
          <span>© {new Date().getFullYear()} Agata Proxima</span>
          <span>Tenant isolation infrastructure</span>
        </div>
      </footer>
    </div>
  );
}
