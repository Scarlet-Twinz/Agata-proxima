import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <main className="public-page-header" style={{ minHeight: "60vh" }}>
      <span className="public-eyebrow">404</span>
      <h1>That page does not exist.</h1>
      <p>Check the address or return to the Agata Proxima product surface.</p>
      <div className="hero-actions">
        <Link className="button button-primary" to="/">Back to home</Link>
        <Link className="button button-secondary" to="/docs">Open documentation</Link>
      </div>
    </main>
  );
}
