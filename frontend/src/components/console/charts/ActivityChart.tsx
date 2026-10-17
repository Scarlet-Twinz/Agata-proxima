import { useMemo } from "react";
import type { MetricPoint } from "../../../types/console";

type Props = {
  points: MetricPoint[];
  height?: number;
};

export function ActivityChart({ points, height = 250 }: Props) {
  const plotted = useMemo(() => {
    const width = 900;
    const padding = 28;
    const values = points.map((point) => point.value);
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 0;
    const range = max - min || 1;
    const usableWidth = width - padding * 2;
    const usableHeight = height - padding * 2;

    const coordinates = points.map((point, index) => ({
      x: points.length === 1
        ? width / 2
        : padding + (index / (points.length - 1)) * usableWidth,
      y: max === min ? (max === 0 ? height - padding : height / 2) : height - padding - ((point.value - min) / range) * usableHeight,
      value: point.value,
      timestamp: point.timestamp,
    }));

    const path = coordinates
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");

    return { coordinates, path };
  }, [points, height]);

  return (
    <div className={points.length === 0 ? "chart-shell chart-shell--empty" : "chart-shell"}>
      <svg
        className="activity-chart"
        viewBox={`0 0 900 ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Verification activity trend"
      >
        <defs>
          <linearGradient id="agata-chart-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--agata-blue)" stopOpacity="0.20" />
            <stop offset="100%" stopColor="var(--agata-blue)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 1, 2, 3].map((step) => {
          const y = 28 + (step / 3) * (height - 56);
          return <line key={step} x1="28" x2="872" y1={y} y2={y} className="chart-gridline" />;
        })}
        <line
          x1="28"
          x2="872"
          y1={height - 28}
          y2={height - 28}
          className="chart-axis"
        />

        {plotted.coordinates.length > 1 && (
          <path
            d={`${plotted.path} L 872 ${height - 28} L 28 ${height - 28} Z`}
            className="chart-area"
          />
        )}

        {plotted.coordinates.length > 1 && (
          <path d={plotted.path} className="chart-line" />
        )}

        {plotted.coordinates.map((point) => (
          <circle
            key={point.timestamp}
            cx={point.x}
            cy={point.y}
            r={plotted.coordinates.length === 1 ? 6 : 3.5}
            className="chart-point"
          >
            <title>{`${point.timestamp}: ${point.value} verification run(s)`}</title>
          </circle>
        ))}
      </svg>
      {points.length === 0 && (
        <div className="chart-empty-overlay" role="status">
          <strong>No verification history yet</strong>
          <span>Run a verification to populate this graph. No sample telemetry is being invented.</span>
        </div>
      )}
      {points.length > 0 && points.every((point) => point.value === 0) && (
        <p className="chart-caption">No verification runs recorded in the last 30 days.</p>
      )}
      {points.length > 0 && (
        <div className="chart-axis-labels" aria-hidden="true">
          <span>{new Date(points[0].timestamp).toLocaleDateString()}</span>
          <span>Verification runs · last 30 days</span>
          <span>{new Date(points[points.length - 1].timestamp).toLocaleDateString()}</span>
        </div>
      )}
    </div>
  );
}
