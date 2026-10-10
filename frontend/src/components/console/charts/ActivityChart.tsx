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
      y: height - padding - ((point.value - min) / range) * usableHeight,
      value: point.value,
      timestamp: point.timestamp,
    }));

    const path = coordinates
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");

    return { coordinates, path };
  }, [points, height]);

  if (points.length === 0) {
    return (
      <div className="chart-empty">
        <strong>No verification history yet.</strong>
        <span>
          Run a verification to record the first result. The activity trend will
          update automatically.
        </span>
      </div>
    );
  }

  return (
    <div className="chart-shell">
      <svg
        className="activity-chart"
        viewBox={`0 0 900 ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Verification activity trend"
      >
        <defs>
          <linearGradient id="agata-chart-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopOpacity="0.20" />
            <stop offset="100%" stopOpacity="0" />
          </linearGradient>
        </defs>

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
      {points.length === 1 && (
        <p className="chart-caption">
          First recorded verification · {points[0].value} run
          {points[0].value === 1 ? "" : "s"} on this day
        </p>
      )}
    </div>
  );
}
