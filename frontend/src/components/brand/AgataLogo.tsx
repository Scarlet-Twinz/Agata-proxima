import "./AgataLogo.css";

type AgataLogoProps = {
  compact?: boolean;
  className?: string;
};

export function AgataLogo({
  compact = false,
  className = "",
}: AgataLogoProps) {
  return (
    <div className={`agata-logo ${compact ? "agata-logo--compact" : ""} ${className}`.trim()}>
      <img
        src="/src/assets/agata-proxima-logo.svg"
        alt="Agata Proxima"
        className="agata-logo__mark"
      />

      {!compact && (
        <span className="agata-logo__wordmark">
          AGATA PROXIMA
        </span>
      )}
    </div>
  );
}
