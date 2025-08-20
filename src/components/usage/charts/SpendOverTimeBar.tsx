// src/components/usage/charts/SpendOverTimeBar.tsx
/**
 * Summary:
 *   A stacked bar chart component that visualizes spend over time, broken down by route.
 *   It renders a responsive Recharts BarChart and provides a custom tooltip that shows
 *   the breakdown of spend for a specific time period. The component fills missing
 *   time periods with zero-value buckets and maps the UI time unit (hour/day/week)
 *   to the data provided by the parent.
 *
 * Imports to:
 *   - Recharts components (BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer)
 *   - useTheme from src/lib/theme-provider
 *
 * Exports:
 *   - default: SpendOverTimeBar
 *
 * Exports used by:
 *   - src/components/usage/UsageChartsTab.tsx
 *
 * Nuances:
 *   - The parent is responsible for mapping `days` / `show` into a timeUnit when passing data.
 *     This component expects each data entry to include a `timeUnit` field ("hour" | "day" | "week").
 *   - The component pads empty time buckets (24 hours, 7 days, or ~52 weeks) so the chart always
 *     shows consistent time ranges even when some periods have no data.
 *   - Tooltip display is controlled by a local state (tooltipActive) and a wrapperStyle toggle so
 *     the custom tooltip can be shown/hidden programmatically; clicks outside the chart hide it.
 *   - Numeric formatting intentionally uses toFixed(5) to match existing UI precision.
 */

"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "~/lib/theme-provider";
import { useRef, useEffect, useState } from "react";

interface SpendOverTimeBarProps {
  data: Array<{
    timestamp: string;
    cost: number;
    breakdown: Record<string, number>;
    timeUnit: "hour" | "day" | "week";
  }>;
  topRoutes: string[];
}

/**
 * CustomTooltip
 *
 * Renders the custom tooltip displayed when a bar is active.
 * Shows the label (formatted timestamp), total spend for that period, and a per-route breakdown.
 *
 * Props:
 *   - active: whether the tooltip should render
 *   - payload: array of entries containing name, value, and color
 *   - label: the timestamp or label for the hovered bar
 */
const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;

  const total = payload.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className="rounded-lg border border-gray-600 bg-gray-800 p-4 text-white shadow-lg">
      <p className="mb-2 text-lg font-bold">{label}</p>
      <p className="mb-2">Total: ${total.toFixed(5)}</p>
      <div className="grid grid-cols-2 gap-2">
        {payload.map((entry, index) => (
          <div key={`tooltip-entry-${index}`} className="contents">
            <span style={{ color: entry.color }}>{entry.name}:</span>
            <span>${entry.value.toFixed(5)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * SpendOverTimeBar
 *
 * Main exported component.
 *
 * Behavior:
 *   - Accepts raw data and topRoutes from the parent.
 *   - Builds a merged dataset by generating empty time buckets for the requested timeUnit
 *     and replacing them with real data where available.
 *   - Renders a stacked BarChart showing the top 5 routes plus an "Other" bucket.
 *   - Clicking the chart toggles a programmatic tooltip; clicking outside hides it.
 */
export default function SpendOverTimeBar({
  data,
  topRoutes,
}: SpendOverTimeBarProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const chartRef = useRef<HTMLDivElement>(null);
  const [tooltipActive, setTooltipActive] = useState(false);
  const [tooltipResetKey, setTooltipResetKey] = useState(0);

  const axisTextColor = isDark ? "#ffffff" : "#000000";

  const COLORS = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#8884D8",
    "#A4DE6C",
  ];

  useEffect(() => {
    if (!tooltipActive) return;

    const timer = setTimeout(() => {
      setTooltipActive(false);
      setTooltipResetKey((k) => k + 1);
    }, 4000);

    const handleClickOutside = (e: MouseEvent) => {
      if (chartRef.current && !chartRef.current.contains(e.target as Node)) {
        setTooltipActive(false);
        setTooltipResetKey((k) => k + 1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [tooltipActive]);

  const handleBarClick = () => {
    setTooltipActive(true);
  };

  const pad = (num: number) => String(num).padStart(2, "0");

  /**
   * formatTimestamp
   *
   * Converts a Date object into a formatted string depending on the provided unit.
   * - "hour": YYYY-MM-DD HH:00
   * - "day":  YYYY-MM-DD
   * - "week": YYYY-MM (month-level label for weekly buckets)
   */
  const formatTimestamp = (date: Date, unit: string) => {
    if (unit === "hour") {
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate(),
      )} ${pad(date.getHours())}:00`;
    } else if (unit === "day") {
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate(),
      )}`;
    } else {
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
    }
  };

  /**
   * generateEmptyData
   *
   * Produces a list of empty (zero-cost) time buckets matching the timeUnit inferred
   * from the provided data. Count is:
   *   - hour => 24
   *   - day  => 7
   *   - week => 52
   *
   * Parent-provided data is expected to include a timeUnit on the first element.
   * The generated buckets use formatTimestamp for their timestamp strings.
   */
  const generateEmptyData = () => {
    if (!data.length || !data[0]) return [];
    const timeUnit = data[0].timeUnit;
    const count = timeUnit === "hour" ? 24 : timeUnit === "day" ? 7 : 52;
    const now = new Date();

    return Array.from({ length: count }, (_, i) => {
      const date = new Date(now);
      if (timeUnit === "hour") date.setHours(date.getHours() - (count - 1 - i));
      else if (timeUnit === "day")
        date.setDate(date.getDate() - (count - 1 - i));
      else date.setDate(date.getDate() - (count - 1 - i) * 7);

      return {
        timestamp: formatTimestamp(date, timeUnit),
        cost: 0,
        breakdown: {},
        timeUnit,
      };
    });
  };

  /**
   * normalizeHour
   *
   * Normalizes an ISO timestamp to an hourly bucket string used as the map key.
   * This is used to align incoming data with generated empty buckets.
   */
  const normalizeHour = (ts: string) =>
    new Date(ts).toISOString().slice(0, 13) + ":00";

  const periodMap = new Map(data.map((d) => [normalizeHour(d.timestamp), d]));

  const mergedData = generateEmptyData().map((emptyItem) => {
    const key = normalizeHour(emptyItem.timestamp);
    const match = periodMap.get(key);
    return match ?? emptyItem;
  });

  const formatXAxis = (tick: string, timeUnit?: string) => {
    const date = new Date(tick);
    if (!timeUnit) return tick;
    if (timeUnit === "hour") return `${date.getHours()}:00`;
    if (timeUnit === "day")
      return date.toLocaleDateString("en-US", { weekday: "short" });
    if (timeUnit === "week")
      return `Week ${Math.floor(date.getDate() / 7) + 1}`;
    return tick;
  };

  const top5Routes = topRoutes.slice(0, 5);

  return (
    <div className="relative h-96 w-full" ref={chartRef} key={tooltipResetKey}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          key={tooltipResetKey}
          data={mergedData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          onClick={handleBarClick}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={isDark ? "#334155" : "#ccc"}
          />
          <XAxis
            dataKey="timestamp"
            tick={{ fill: axisTextColor }}
            tickFormatter={(tick) => {
              const timeUnit = mergedData?.[0]?.timeUnit ?? "day";
              return formatXAxis(tick as string, timeUnit);
            }}
          />
          <YAxis
            tick={{ fill: axisTextColor }}
            tickFormatter={(value: number) => `$${value.toFixed(5)}`}
          />
          <Tooltip
            content={<CustomTooltip />}
            wrapperStyle={{ display: tooltipActive ? "block" : "none" }}
          />
          {top5Routes.map((route, index) => (
            <Bar
              key={route}
              dataKey={(entry: { breakdown: Record<string, number> }) =>
                entry.breakdown?.[route] ?? 0
              }
              name={route}
              stackId="a"
              fill={COLORS[index % COLORS.length]}
            />
          ))}
          <Bar
            dataKey={(entry: { breakdown: Record<string, number> }) => {
              const known = top5Routes.reduce(
                (sum, route) => sum + (entry.breakdown?.[route] ?? 0),
                0,
              );
              const total = Object.values(entry.breakdown ?? {}).reduce(
                (a: number, b: number) => a + b,
                0,
              );
              return +(total - known).toFixed(5);
            }}
            name="Other"
            stackId="a"
            fill="#999999"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
