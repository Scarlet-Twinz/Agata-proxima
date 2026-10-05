import { Mail, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicPage";

const contactEmail = import.meta.env.VITE_CONTACT_EMAIL as string | undefined;

const channels = [
  ["Customers", "Architecture, adoption, plans and operating requirements.", "customer"],
  ["Developers", "Integration questions, API behavior and tenant-context guidance.", "developer"],
  ["Security", "Responsible disclosure and security-sensitive communication.", "security"],
  ["Partnerships", "Infrastructure, platform and technology partnerships.", "partnership"],
];

export function Contact() {
  return (
    <PublicPage
      eyebrow="Contact"
      title="Talk to the people building Agata."
      description="Choose the reason for contacting us. The production email address is configuration-driven so the final domain can be connected without rewriting the public application."
    >
      <section className="public-content">
        <div className="agata-container">
          <div className="public-contact-banner">
            <div>
              <span className="public-feature-kicker">Production contact</span>
              <h2>{contactEmail ?? "Production contact address"}</h2>
              <p>
                {contactEmail
                  ? "Use this address for general product conversations and we will route the request internally."
                  : "Set VITE_CONTACT_EMAIL when the production domain is connected. The contact surface is already wired for it."}
              </p>
            </div>
            {contactEmail ? (
              <a className="agata-button agata-button-primary" href={`mailto:${contactEmail}`}>
                Email Agata <Mail size={16} />
              </a>
            ) : (
              <Link className="agata-button agata-button-secondary" to="/support">
                Contact support <ArrowRight size={16} />
              </Link>
            )}
          </div>

          <div className="public-feature-grid">
            {channels.map(([title, text, subject]) => (
              <div key={title} className="public-feature">
                <span className="public-feature-kicker">Contact channel</span>
                <h3>{title}</h3>
                <p>{text}</p>
                {contactEmail ? (
                  <a className="public-resource-link" href={`mailto:${contactEmail}?subject=Agata%20Proxima%20${subject}`}>
                    Email {title.toLowerCase()} →
                  </a>
                ) : (
                  <Link className="public-resource-link" to="/support">
                    Open support path →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
