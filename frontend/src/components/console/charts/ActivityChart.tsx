import { useMemo } from "react";
import type { MetricPoint } from "../../../types/console";

type Props = {
  points: MetricPoint[];
  height?: number;
};

export function ActivityChart({ points, height = 250 }: Props) {
  const path = useMemo(() => {
    if (points.length < 2) return "";

    const width = 900;
    const padding = 28;

    const values = points.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    return points
      .map((point, index) => {
        const x =
          padding +
          (index / Math.max(points.length - 1, 1)) *
            (width - padding * 2);

        const y =
          height -
          padding -
          ((point.value - min) / range) *
            (height - padding * 2);

        return `${index === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  }, [points, height]);

  if (points.length < 2) {
    return (
      <div className="chart-empty">
        <strong>No verification history yet.</strong>
        <span>
          Once Proxima records verification runs, the activity trend will
          appear here automatically.
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

        <path
          d={`${path} L 872 ${height - 28} L 28 ${height - 28} Z`}
          className="chart-area"
        />

        <path d={path} className="chart-line" />
      </svg>
    </div>
  );
}
