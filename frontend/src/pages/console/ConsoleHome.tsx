import { Link } from "react-router-dom";
import { AgataLogo } from "../../components/brand/AgataLogo";

export default function ConsoleHome() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f7f8fa",
        color: "#101828",
      }}
    >
      <header
        style={{
          height: 72,
          background: "#07111f",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
        }}
      >
        <AgataLogo compact />

        <Link
          to="/"
          style={{
            color: "#aab8cc",
            textDecoration: "none",
            fontSize: 14,
          }}
        >
          Back to website
        </Link>
      </header>

      <main
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "64px 28px",
        }}
      >
        <p
          style={{
            color: "#176bff",
            fontWeight: 700,
            fontSize: 13,
            textTransform: "uppercase",
            letterSpacing: ".08em",
          }}
        >
          Protected application
        </p>

        <h1
          style={{
            fontSize: 48,
            letterSpacing: "-.04em",
            margin: "12px 0",
          }}
        >
          Agata Proxima Command Center
        </h1>

        <p
          style={{
            maxWidth: 680,
            color: "#667085",
            fontSize: 18,
            lineHeight: 1.7,
          }}
        >
          The application shell is ready. The real authenticated workspace,
          tenants, policies, nodes, verification, audit, security, team,
          billing, settings, and developer surfaces come next.
        </p>
      </main>
    </div>
  );
}

