import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../api/client";

const contextMap: Record<string, { subject: string; message: string; title: string }> = {
  documentation: {
    subject: "Documentation help",
    message: "I need help with Agata Proxima documentation, architecture, or integration guidance.\n\nWhat I am trying to do:\n",
    title: "Documentation help",
  },
  troubleshooting: {
    subject: "Troubleshooting request",
    message: "I am having an issue with Agata Proxima and need troubleshooting help.\n\nWhat I expected:\n\nWhat happened instead:\n",
    title: "Troubleshooting",
  },
  security: {
    subject: "Security concern",
    message: "I would like to report or discuss a security concern involving Agata Proxima.\n\nDetails:\n",
    title: "Security",
  },
  customer: {
    subject: "Customer support request",
    message: "I need help with an Agata Proxima customer or workspace matter.\n\nDetails:\n",
    title: "Customer support",
  },
  customers: {
    subject: "Customer inquiry",
    message: "I would like to discuss Agata Proxima architecture, adoption, plans, or operating requirements.\n\nDetails:\n",
    title: "Customers",
  },
  developers: {
    subject: "Developer inquiry",
    message: "I have a developer or integration question about Agata Proxima.\n\nDetails:\n",
    title: "Developer inquiry",
  },
  partnerships: {
    subject: "Partnership inquiry",
    message: "I would like to discuss an infrastructure, platform, or technology partnership with Agata.\n\nDetails:\n",
    title: "Partnership inquiry",
  },
};

type SupportRequestResponse = {
  ok: boolean;
  request_id?: string;
  requester_email_status?: "sent" | "failed";
  support_email_status?: "sent" | "failed" | "not_configured";
  message: string;
};

export function SupportRequest() {
  const [searchParams] = useSearchParams();
  const requestedTopic = searchParams.get("topic") ?? "general";
  const context = contextMap[requestedTopic];
  const topic = context ? requestedTopic : "general";
  const isSupport = searchParams.get("from") !== "contact";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState(context?.subject ?? "");
  const [message, setMessage] = useState(context?.message ?? "");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SupportRequestResponse | null>(null);

  useEffect(() => {
    document.title = `${isSupport ? "Open Support" : "Contact Agata"} · Agata Proxima`;
  }, [isSupport]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    setResult(null);
    try {
      const response = await api.post<SupportRequestResponse>("/api/v1/public/support-requests", {
        name,
        email,
        subject,
        message,
        topic,
        website,
      });
      setResult(response);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not submit your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="public-page">
      <section className="public-page-hero">
        <div className="agata-container public-page-hero-inner">
          <div className="public-eyebrow">{isSupport ? "Open Support" : "Contact Agata"}</div>
          <h1>{context?.title ?? (isSupport ? "Tell us what you need." : "Start the conversation.")}</h1>
          <p>
            {context
              ? "We have started the request for you. Edit the details below and add anything else that will help us understand what you need."
              : "Write the request in your own words. You can add as much context as you need."}
          </p>
        </div>
      </section>

      <section className="public-content">
        <div className="agata-container public-request-layout">
          <div>
            <Link to={isSupport ? "/support" : "/contact"} className="public-back-link">
              <ArrowLeft size={15} />
              Back to {isSupport ? "support" : "contact"}
            </Link>
          </div>

          <form className="public-request-form" onSubmit={handleSubmit}>
            <div className="public-request-field-grid">
              <label>
                Name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  placeholder="Your name"
                  maxLength={120}
                />
              </label>
              <label>
                Email
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  maxLength={254}
                  required
                />
              </label>
            </div>

            <label>
              Subject
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="What can we help with?"
                minLength={4}
                maxLength={200}
                required
              />
            </label>

            <label>
              Message
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={12}
                minLength={10}
                maxLength={10000}
                placeholder="Write your request here..."
                required
              />
            </label>

            <label
              aria-hidden="true"
              className="public-support-honeypot"
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                padding: 0,
                margin: -1,
                overflow: "hidden",
                clip: "rect(0, 0, 0, 0)",
                whiteSpace: "nowrap",
                border: 0,
              }}
            >
              Website
              <input
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                tabIndex={-1}
                autoComplete="off"
              />
            </label>

            <div className="public-request-actions">
              <button type="submit" className="agata-button agata-button-primary" disabled={submitting}>
                <Send size={16} />
                {submitting ? "Sending request…" : "Send request"}
              </button>
              {error && (
                <p className="public-request-note" role="alert">
                  {error}
                </p>
              )}
              {result && (
                <div className="public-request-note" role="status" aria-live="polite">
                  <p>{result.message}</p>
                  {result.request_id && <p><strong>Request ID:</strong> {result.request_id}</p>}
                  {result.requester_email_status && result.requester_email_status !== "sent" && (
                    <p>We could not send a confirmation email. Please keep the request ID for reference.</p>
                  )}
                  {result.support_email_status && result.support_email_status !== "sent" && (
                    <p>Our support team has not received an email notification yet. Your request is saved, but follow-up may be delayed.</p>
                  )}
                </div>
              )}
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
