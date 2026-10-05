import { ArrowRight, Check, ChevronRight, Database, LockKeyhole, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

const principles = [
  {
    number: "01",
    title: "Make tenant context explicit",
    text: "A protected request needs more than an authenticated identity. The request must carry an unambiguous tenant context that can be evaluated before data access.",
    to: "/developers/tenant-context",
    label: "Read tenant context",
  },
  {
    number: "02",
    title: "Enforce before protected data",
    text: "Proxima is designed as a boundary between the application request and PostgreSQL, so an invalid or cross-tenant operation can be rejected before it reaches protected data.",
    to: "/docs/security",
    label: "Read the security model",
  },
  {
    number: "03",
    title: "Verify the property",
    text: "The important security claim is testable: legitimate same-tenant operations should work, while cross-tenant and invalid-context operations should be blocked.",
    to: "/developers/verification",
    label: "Read verification guide",
  },
];

const solutions = [
  { title: "B2B SaaS", text: "Protect customer organizations as tenant count and application complexity grow.", to: "/solutions/b2b-saas" },
  { title: "Enterprise SaaS", text: "Give security and engineering teams a boundary they can inspect and operate.", to: "/solutions/enterprise-saas" },
  { title: "Developer platforms", text: "Keep tenant context consistent across the infrastructure layer shared by many products.", to: "/solutions/developer-platforms" },
  { title: "Security-sensitive systems", text: "Make unauthorized cross-tenant access a deliberate failure condition.", to: "/solutions/security-sensitive-systems" },
];

const resources = [
  { title: "Documentation", text: "Architecture, concepts, API behavior, operations and troubleshooting.", to: "/docs" },
  { title: "Developer platform", text: "Quickstart, authentication, tenant context, verification and webhooks.", to: "/developers" },
  { title: "Security", text: "Understand the enforcement boundary and layered database controls.", to: "/security" },
  { title: "Changelog", text: "Follow what changed, why it changed and what it means for operators.", to: "/changelog" },
];

export function Home() {
  return (
    <main className="agata-home">
      <section className="home-hero">
        <div className="agata-container home-hero-grid">
          <div className="home-hero-copy">
            <div className="public-eyebrow">Tenant isolation infrastructure</div>
            <h1>Make tenant isolation an independently verifiable boundary.</h1>
            <p>
              Agata Proxima gives multi-tenant applications a dedicated security boundary between application identity and protected data—so tenant isolation can be enforced, tested and evidenced instead of living only in application code.
            </p>
            <div className="home-actions">
              <Link to="/signup" className="agata-button agata-button-primary">
                Start building <ArrowRight size={16} />
              </Link>
              <Link to="/product" className="agata-button agata-button-secondary">
                Explore Proxima
              </Link>
            </div>
            <div className="home-proof-line">
              <span><Check size={15} /> Explicit tenant context</span>
              <span><Check size={15} /> Fail-closed enforcement</span>
              <span><Check size={15} /> Verification evidence</span>
            </div>
          </div>

          <div className="home-architecture">
            <div className="home-architecture-header">
              <span>Proxima request path</span>
              <span className="home-live-indicator"><i /> Enforcement model</span>
            </div>

            <div className="home-architecture-flow">
              <div className="home-architecture-node">
                <div className="home-node-icon"><LockKeyhole size={18} /></div>
                <div><strong>Application</strong><span>Identity + tenant context</span></div>
              </div>
              <div className="home-flow-line"><i /></div>
              <div className="home-architecture-node home-architecture-node-accent">
                <div className="home-node-icon"><ShieldCheck size={18} /></div>
                <div><strong>Proxima</strong><span>Enforce + verify</span></div>
              </div>
              <div className="home-flow-line"><i /></div>
              <div className="home-architecture-node">
                <div className="home-node-icon"><Database size={18} /></div>
                <div><strong>PostgreSQL</strong><span>Roles + RLS + data</span></div>
              </div>
            </div>

            <div className="home-decision">
              <div><span className="home-decision-dot home-decision-allow" /><strong>Tenant A → Tenant A</strong><span>ALLOW</span></div>
              <div><span className="home-decision-dot home-decision-block" /><strong>Tenant A → Tenant B</strong><span>BLOCK</span></div>
              <div><span className="home-decision-dot home-decision-block" /><strong>Expired context</strong><span>BLOCK</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="home-section home-section-border">
        <div className="agata-container">
          <div className="home-section-intro">
            <div className="public-eyebrow">The problem</div>
            <h2>Tenant isolation becomes harder as the system becomes bigger.</h2>
            <p>
              In a multi-tenant system, the security boundary crosses authentication, request handling, services, background work and database access. A single missing or incorrect tenant check can turn a normal application path into a data-isolation failure.
            </p>
          </div>

          <div className="home-problem-grid">
            <div>
              <span className="home-index">01</span>
              <h3>Identity is not enough</h3>
              <p>A user can be authenticated correctly and still be attempting to access the wrong tenant.</p>
            </div>
            <div>
              <span className="home-index">02</span>
              <h3>Checks become scattered</h3>
              <p>Tenant checks can end up duplicated across routes, services, jobs and database calls.</p>
            </div>
            <div>
              <span className="home-index">03</span>
              <h3>Security claims need evidence</h3>
              <p>Teams need a repeatable way to exercise the boundary and inspect what happened.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="agata-container">
          <div className="home-section-intro">
            <div className="public-eyebrow">The Proxima model</div>
            <h2>Three decisions turn an architecture principle into an operating control.</h2>
            <p>Proxima is designed around a simple progression: establish context, enforce the boundary, then prove that the boundary behaves as intended.</p>
          </div>

          <div className="home-principles">
            {principles.map((item) => (
              <Link to={item.to} key={item.number} className="home-principle">
                <span className="home-index">{item.number}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <span className="home-text-link">{item.label} <ArrowRight size={15} /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section home-dark-section">
        <div className="agata-container">
          <div className="home-section-intro home-dark-intro">
            <div className="public-eyebrow">One boundary, multiple controls</div>
            <h2>Proxima does not replace your database security model. It makes the path to it explicit.</h2>
            <p>
              PostgreSQL roles and row-level security remain important controls. Proxima adds an operational boundary and verification model around the path from application identity to protected data.
            </p>
          </div>

          <div className="home-layer-diagram">
            <div><span>01</span><strong>Identity</strong><small>Who is making the request?</small></div>
            <ChevronRight />
            <div><span>02</span><strong>Tenant context</strong><small>Which isolation domain is requested?</small></div>
            <ChevronRight />
            <div className="home-layer-active"><span>03</span><strong>Proxima</strong><small>Should this operation cross the boundary?</small></div>
            <ChevronRight />
            <div><span>04</span><strong>PostgreSQL</strong><small>Which protected data can be reached?</small></div>
          </div>

          <div className="home-dark-note">
            <ShieldCheck size={19} />
            <p>Verification then exercises the expected decisions and preserves the resulting evidence for operators and security teams.</p>
          </div>
        </div>
      </section>

      <section className="home-section home-section-border">
        <div className="agata-container">
          <div className="home-section-intro">
            <div className="public-eyebrow">Where it fits</div>
            <h2>Built for systems where tenant leakage is not an acceptable failure mode.</h2>
          </div>

          <div className="home-solution-grid">
            {solutions.map((item) => (
              <Link to={item.to} key={item.to} className="home-solution">
                <span className="home-solution-arrow"><ArrowRight size={16} /></span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <span className="home-text-link">Explore solution <ArrowRight size={15} /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="agata-container">
          <div className="home-section-intro">
            <div className="public-eyebrow">Go deeper</div>
            <h2>Read the architecture. Then build against it.</h2>
            <p>Every major concept on this page has a deeper destination. The goal is not to send you back to a generic marketing page—it is to give you enough technical context to decide whether Proxima fits your system.</p>
          </div>

          <div className="home-resource-grid">
            {resources.map((item) => (
              <Link to={item.to} key={item.to} className="home-resource">
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <span className="home-text-link">Open {item.title.toLowerCase()} <ArrowRight size={15} /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="home-final-section">
        <div className="agata-container">
          <div className="home-final-inner">
            <div>
              <div className="public-eyebrow">Start with the boundary</div>
              <h2>Build tenant isolation into the infrastructure, not just the application.</h2>
              <p>Create a workspace, read the integration model and verify the first protected request.</p>
            </div>
            <div className="home-actions">
              <Link to="/signup" className="agata-button agata-button-primary">Create workspace <ArrowRight size={16} /></Link>
              <Link to="/docs/getting-started" className="agata-button agata-button-secondary">Read the quickstart</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
