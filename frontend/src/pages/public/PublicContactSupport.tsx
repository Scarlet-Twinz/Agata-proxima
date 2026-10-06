import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import "./public-contact-support.css";

type RequestKind = "contact" | "support";

const controlPlaneBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

type SupportCategory = {
  title: string;
  slug: string;
  description: string;
  articles: string[];
};

const supportCategories: SupportCategory[] = [
  {
    title: "Getting started",
    slug: "getting-started",
    description: "Installation, first tenant, authentication and first verification.",
    articles: [
      "Installation",
      "First tenant",
      "Authentication",
      "First verification",
    ],
  },
  {
    title: "Tenant isolation",
    slug: "tenant-isolation",
    description: "Diagnose tenant context, cross-tenant blocks and enforcement.",
    articles: [
      "Cross-tenant request blocked",
      "Tenant context rejected",
      "Expired tenant context",
      "Isolation verification failed",
    ],
  },
  {
    title: "Developer platform",
    slug: "developer-platform",
    description: "API, SDK, CLI, webhooks and infrastructure-as-code.",
    articles: [
      "API integration",
      "SDK setup",
      "CLI",
      "Webhooks",
      "Terraform",
    ],
  },
];

const articleSteps: Record<string, string[]> = {
  installation: [
    "Confirm the runtime and operating system where Proxima is being installed.",
    "Verify that the required dependencies and configuration are present.",
    "Start the service and confirm its health endpoint responds successfully.",
    "Review the installation logs for configuration or environment errors.",
    "If the problem remains, contact support with the version, environment and non-sensitive diagnostics.",
  ],
  "first-tenant": [
    "Confirm the organization and tenant model you intend to protect.",
    "Create the tenant through the supported control-plane workflow.",
    "Verify that the tenant has the expected identifier and configuration.",
    "Run a same-tenant request and confirm that it is allowed.",
    "If the expected result does not occur, contact support with the request context and result.",
  ],
  authentication: [
    "Confirm that the calling principal has authenticated successfully.",
    "Keep authentication identity separate from tenant scope.",
    "Verify that the request carries the intended tenant context.",
    "Confirm that invalid or expired context fails closed.",
    "If authentication and tenant scope appear inconsistent, contact support with non-sensitive diagnostics.",
  ],
  "first-verification": [
    "Define the expected same-tenant allow case.",
    "Define the cross-tenant block cases.",
    "Run the verification scenarios against the intended environment.",
    "Inspect the resulting decisions and evidence.",
    "If a result differs from the expected security contract, contact support with the scenario and evidence identifier.",
  ],
  "cross-tenant-request-blocked": [
    "Confirm which tenant the request intended to access.",
    "Confirm which tenant owns the protected resource.",
    "If they differ, the block is the expected security behavior.",
    "Inspect the verification or audit evidence if you need to confirm the decision.",
    "If a same-tenant request is being blocked unexpectedly, contact support with the environment and reproduction steps.",
  ],
  "tenant-context-rejected": [
    "Confirm that the tenant context is present in the request.",
    "Check that the context is valid and has not been modified.",
    "Verify that the context identifies the intended tenant.",
    "Retry using freshly generated valid context.",
    "If rejection persists, contact support with the non-sensitive error and environment details.",
  ],
  "expired-tenant-context": [
    "Confirm that the tenant context has expired.",
    "Generate fresh context using the supported authentication flow.",
    "Retry the request with the fresh context.",
    "Confirm that the resulting decision matches the expected tenant boundary.",
    "If fresh context is also rejected, contact support with the timestamp and error.",
  ],
  "isolation-verification-failed": [
    "Identify the exact verification scenario that failed.",
    "Confirm the expected allow or block result.",
    "Inspect tenant context and policy inputs.",
    "Review the resulting evidence for the first point of divergence.",
    "Contact support with the scenario, environment and evidence identifier.",
  ],
  "api-integration": [
    "Confirm the API endpoint and authentication method match the deployed environment.",
    "Keep API credentials server-side.",
    "Confirm tenant context is supplied where required.",
    "Inspect the response status and error without exposing credentials.",
    "Contact support with the endpoint, environment and non-sensitive response details.",
  ],
  "sdk-setup": [
    "Confirm the SDK version and runtime.",
    "Install the SDK using the package manager appropriate to your environment.",
    "Configure credentials through environment or secret-management facilities.",
    "Run a minimal tenant-aware request.",
    "If setup fails, contact support with the SDK version and non-sensitive error details.",
  ],
  cli: [
    "Confirm the CLI version.",
    "Authenticate using the supported local credential mechanism.",
    "Check the active environment and configuration.",
    "Run the smallest command that reproduces the issue.",
    "Contact support with the command, environment and sanitized output.",
  ],
  webhooks: [
    "Confirm the webhook endpoint is reachable.",
    "Validate the authenticity and integrity of incoming events.",
    "Make the consumer idempotent because delivery can be retried.",
    "Inspect delivery and application logs for the event identifier.",
    "Contact support with the event identifier and non-sensitive delivery details.",
  ],
  terraform: [
    "Confirm the provider and version match the supported Proxima distribution.",
    "Keep credentials outside Terraform source files.",
    "Review the planned changes before applying them.",
    "Confirm the resulting tenant and environment configuration.",
    "Contact support with the provider version and sanitized plan error if the issue persists.",
  ],
};

function articleSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function submitRequest(kind: RequestKind, payload: Record<string, string>) {
  const response = await fetch(
    kind === "contact"
      ? `${controlPlaneBase}/api/v1/public/contact`
      : `${controlPlaneBase}/api/v1/public/support`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    },
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data.message === "string"
        ? data.message
        : "We could not submit your request. Please try again.",
    );
  }

  return data;
}

function RequestForm({ kind }: { kind: RequestKind }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    category: kind === "support" ? "technical" : "general",
    subject: "",
    message: "",
  });
  const [state, setState] = useState<"idle" | "sending" | "success" | "error">(
    "idle",
  );
  const [error, setError] = useState("");

  const isSupport = kind === "support";

  function update(field: string, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setError("");

    try {
      await submitRequest(kind, form);
      setState("success");
      setForm({
        name: "",
        email: "",
        company: "",
        category: isSupport ? "technical" : "general",
        subject: "",
        message: "",
      });
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Submission failed.");
    }
  }

  if (state === "success") {
    return (
      <div className="public-request-success">
        <span className="public-request-success-mark">✓</span>
        <div>
          <strong>Request received.</strong>
          <p>
            Your request has been recorded. Keep the request details available
            if the team needs additional context.
          </p>
        </div>
        <button type="button" onClick={() => setState("idle")}>
          Send another request
        </button>
      </div>
    );
  }

  return (
    <form className="public-request-form" onSubmit={onSubmit}>
      <div className="public-form-grid">
        <label>
          Name
          <input
            required
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            maxLength={160}
          />
        </label>

        <label>
          Work email
          <input
            required
            type="email"
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
            maxLength={320}
          />
        </label>
      </div>

      <div className="public-form-grid">
        <label>
          Company
          <input
            value={form.company}
            onChange={(event) => update("company", event.target.value)}
            maxLength={160}
          />
        </label>

        <label>
          Category
          <select
            value={form.category}
            onChange={(event) => update("category", event.target.value)}
          >
            {isSupport ? (
              <>
                <option value="technical">Technical</option>
                <option value="security">Security</option>
                <option value="billing">Billing</option>
                <option value="general">General</option>
              </>
            ) : (
              <>
                <option value="general">General</option>
                <option value="sales">Sales</option>
                <option value="technical">Technical</option>
                <option value="security">Security</option>
                <option value="billing">Billing</option>
                <option value="partnership">Partnership</option>
              </>
            )}
          </select>
        </label>
      </div>

      <label>
        Subject
        <input
          required
          value={form.subject}
          onChange={(event) => update("subject", event.target.value)}
          maxLength={240}
        />
      </label>

      <label>
        Message
        <textarea
          required
          value={form.message}
          onChange={(event) => update("message", event.target.value)}
          maxLength={12000}
          rows={7}
          placeholder={
            isSupport
              ? "Describe the environment, operation, error and reproduction steps. Do not include secrets."
              : "Tell us what you need help with."
          }
        />
      </label>

      {state === "error" && (
        <p className="public-form-error" role="alert">
          {error}
        </p>
      )}

      <button
        className="button button-primary"
        type="submit"
        disabled={state === "sending"}
      >
        {state === "sending"
          ? "Sending..."
          : isSupport
            ? "Submit support request"
            : "Send message"}
      </button>
    </form>
  );
}

export function Contact() {
  return (
    <main className="public-contact-page">
      <header className="public-contact-hero">
        <span className="public-eyebrow">CONTACT</span>
        <h1>Talk to the right Agata Proxima team.</h1>
        <p>
          Tell us what you are building, evaluating or troubleshooting and
          provide enough context for the request to reach the right workflow.
        </p>
      </header>

      <section className="public-contact-section public-container">
        <div>
          <span className="public-eyebrow">CONTACT PATHS</span>
          <h2>Start with the reason for your request.</h2>
        </div>

        <div className="public-contact-paths">
          <Link to="/pricing">
            <strong>Sales</strong>
            <span>Plans, deployment and enterprise requirements.</span>
          </Link>
          <Link to="/developers">
            <strong>Technical</strong>
            <span>Integration and architecture questions.</span>
          </Link>
          <Link to="/security">
            <strong>Security</strong>
            <span>Security reports and responsible disclosure.</span>
          </Link>
          <Link to="/support">
            <strong>Support</strong>
            <span>Troubleshooting and product guidance.</span>
          </Link>
          <Link to="/company">
            <strong>General</strong>
            <span>Company, partnerships and other inquiries.</span>
          </Link>
        </div>
      </section>

      <section className="public-contact-section public-container">
        <div>
          <span className="public-eyebrow">SEND A REQUEST</span>
          <h2>Contact Agata Proxima.</h2>
          <p>
            Never include passwords, API keys, private tokens or other secrets
            in a public request.
          </p>
        </div>
        <RequestForm kind="contact" />
      </section>
    </main>
  );
}

export function Support() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) return supportCategories;

    return supportCategories
      .map((category) => ({
        ...category,
        articles: category.articles.filter((article) =>
          `${category.title} ${category.description} ${article}`
            .toLowerCase()
            .includes(normalized),
        ),
      }))
      .filter(
        (category) =>
          category.articles.length > 0 ||
          `${category.title} ${category.description}`
            .toLowerCase()
            .includes(normalized),
      );
  }, [query]);

  return (
    <main className="public-contact-page">
      <header className="public-contact-hero">
        <span className="public-eyebrow">SUPPORT CENTER</span>
        <h1>Find the answer before you open a ticket.</h1>
        <p>
          Troubleshoot integrations, tenant isolation, developer tooling and
          operational issues through focused support paths.
        </p>
      </header>

      <section className="public-support-search public-container">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search support topics..."
          aria-label="Search support topics"
        />
        <span>Search troubleshooting guides and support topics.</span>
      </section>

      <section className="public-contact-section public-container">
        <div>
          <span className="public-eyebrow">SUPPORT LIBRARY</span>
          <h2>What are you trying to solve?</h2>
        </div>

        <div className="public-support-grid">
          {filtered.map((category) => (
            <article key={category.slug}>
              <span className="public-eyebrow">SUPPORT</span>
              <h3>{category.title}</h3>
              <p>{category.description}</p>
              <ul>
                {category.articles.map((article) => (
                  <li key={article}>
                    <Link
                      to={`/support/${category.slug}/${articleSlug(article)}`}
                    >
                      {article} →
                    </Link>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="public-support-empty">
            <strong>No matching support topic.</strong>
            <p>Try a different search term or contact the team directly.</p>
          </div>
        )}
      </section>

      <section className="public-contact-section public-container">
        <div>
          <span className="public-eyebrow">STILL NEED HELP?</span>
          <h2>Open a public support request.</h2>
          <p>
            Include the environment, operation, error and reproduction steps.
            Do not include secrets.
          </p>
        </div>
        <RequestForm kind="support" />
      </section>
    </main>
  );
}

export function SupportArticle() {
  const { category, article } = useParams();
  const categoryData = supportCategories.find((item) => item.slug === category);
  const title =
    categoryData?.articles.find((item) => articleSlug(item) === article) ??
    "Support article";
  const steps = article ? articleSteps[article] : undefined;

  if (!categoryData || !steps) {
    return (
      <main className="public-contact-page">
        <header className="public-contact-hero">
          <span className="public-eyebrow">SUPPORT</span>
          <h1>Support article not found.</h1>
          <p>
            The requested support article could not be resolved.
          </p>
          <Link className="button button-primary" to="/support">
            Return to Support Center
          </Link>
        </header>
      </main>
    );
  }

  return (
    <main className="public-contact-page">
      <header className="public-contact-hero">
        <span className="public-eyebrow">
          SUPPORT / {categoryData.title.toUpperCase()}
        </span>
        <h1>{title}</h1>
        <p>
          Focused troubleshooting guidance for {title.toLowerCase()}.
        </p>
      </header>

      <article className="public-support-article public-container">
        {steps.map((step, index) => (
          <section key={step}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h2>
                {["Confirm", "Capture", "Check", "Reproduce", "Escalate"][
                  index
                ] ?? "Next step"}
              </h2>
              <p>{step}</p>
            </div>
          </section>
        ))}

        <div className="public-support-article-links">
          <Link to="/docs">Documentation</Link>
          <Link to="/support">Support Center</Link>
          <Link to="/contact">Contact</Link>
        </div>
      </article>
    </main>
  );
}
