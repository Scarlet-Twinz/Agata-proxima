import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <section className="public-page public-not-found">
      <div className="agata-container">
        <div className="public-eyebrow">404 · Not found</div>
        <h1>This destination does not exist.</h1>
        <p>The link may have moved. Use one of the verified destinations below.</p>
        <div className="public-detail-links">
          <Link to="/" className="agata-button agata-button-primary">Go home</Link>
          <Link to="/developers" className="agata-button agata-button-secondary">Developer platform</Link>
          <Link to="/support" className="agata-button agata-button-secondary">Support</Link>
        </div>
      </div>
    </section>
  );
}
