import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

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
    title: "Developers",
  },
  partnerships: {
    subject: "Partnership inquiry",
    message: "I would like to discuss an infrastructure, platform, or technology partnership with Agata.\n\nDetails:\n",
    title: "Partnerships",
  },
};

export function SupportRequest() {
  const [searchParams] = useSearchParams();
  const context = contextMap[searchParams.get("topic") ?? ""];
  const isSupport = searchParams.get("from") !== "contact";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState(context?.subject ?? "");
  const [message, setMessage] = useState(context?.message ?? "");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    document.title = `${isSupport ? "Open Support" : "Contact Agata"} · Agata Proxima`;
  }, [isSupport]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
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
                <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Your name" />
              </label>
              <label>
                Email
                <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="you@company.com" required />
              </label>
            </div>

            <label>
              Subject
              <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="What can we help with?" required />
            </label>

            <label>
              Message
              <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={12} placeholder="Write your request here..." required />
            </label>

            <div className="public-request-actions">
              <button type="submit" className="agata-button agata-button-primary">
                <Send size={16} />
                {submitted ? "Request prepared" : "Prepare request"}
              </button>
              {submitted && (
                <p className="public-request-note">
                  Your message is ready with the context you entered. The public frontend does not currently expose a live submission endpoint, so nothing has been falsely marked as sent.
                </p>
              )}
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
