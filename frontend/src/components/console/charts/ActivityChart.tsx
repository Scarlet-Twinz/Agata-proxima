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
    const usableWidth = width - padding * 2;
    const usableHeight = height - padding * 2;

    // Normalize sparse API results to the full 30-day window. Missing dates
    // are genuine zero-activity days, not synthetic verification records.
    const today = new Date();
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 29);
    const byDay = new Map<string, number>();
    for (const point of points) {
      const timestamp = new Date(point.timestamp);
      if (Number.isNaN(timestamp.getTime())) continue;
      const key = timestamp.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + Math.max(0, Number(point.value) || 0));
    }
    const dailyPoints = points.length === 0 ? [] : Array.from({ length: 30 }, (_, index) => {
      const day = new Date(start);
      day.setUTCDate(start.getUTCDate() + index);
      const timestamp = day.toISOString();
      return { timestamp, value: byDay.get(timestamp.slice(0, 10)) ?? 0 };
    });

    const values = dailyPoints.map((point) => point.value);
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 0;
    const range = max - min || 1;
    const coordinates = dailyPoints.map((point, index) => ({
      x: padding + (index / Math.max(1, dailyPoints.length - 1)) * usableWidth,
      y: max === min ? (max === 0 ? height - padding : height / 2) : height - padding - ((point.value - min) / range) * usableHeight,
      value: point.value,
      timestamp: point.timestamp,
    }));

    const path = coordinates
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");

    return { coordinates, path, dailyPoints };
  }, [points, height]);

  return (
    <div className={plotted.dailyPoints.length === 0 ? "chart-shell chart-shell--empty" : "chart-shell"}>
      <svg
        className="activity-chart"
        viewBox={`0 0 900 ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Daily verification records over the last 30 days"
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
            <title>{`${point.timestamp}: ${point.value} verification record(s)`}</title>
          </circle>
        ))}
      </svg>
      {plotted.dailyPoints.length === 0 && (
        <div className="chart-empty-overlay" role="status">
          <strong>No verification history yet</strong>
          <span>Record a verification result with completed test evidence to populate this graph.</span>
        </div>
      )}
      {plotted.dailyPoints.length > 0 && plotted.dailyPoints.every((point) => point.value === 0) && (
        <p className="chart-caption">No verification records in the last 30 days.</p>
      )}
      {plotted.dailyPoints.length > 0 && (
        <div className="chart-axis-labels" aria-hidden="true">
          <span>{new Date(plotted.dailyPoints[0].timestamp).toLocaleDateString(undefined, { timeZone: "UTC" })}</span>
          <span>Verification records · last 30 days</span>
          <span>{new Date(plotted.dailyPoints[plotted.dailyPoints.length - 1].timestamp).toLocaleDateString(undefined, { timeZone: "UTC" })}</span>
        </div>
      )}
    </div>
  );
}
