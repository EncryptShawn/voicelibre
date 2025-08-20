/**
 * src/components/usage/charts/TopModelsPie.tsx
 *
 * Summary:
 *  - Renders a responsive pie chart displaying spend by model/route.
 *  - Allows the user to click a slice to show a transient details panel with spend and percentage.
 *
 * Imports to:
 *  - Recharts components for rendering visuals (PieChart, Pie, Cell, ResponsiveContainer, Sector)
 *  - React hooks for component state and lifecycle
 *
 * Exports:
 *  - default: TopModelsPie React component
 *
 * Exports used by:
 *  - src/components/usage/UsageChartsTab.tsx
 *
 * Nuances:
 *  - This is a client component ("use client") intended to run in the browser.
 *  - Incoming prop `data` is a Record<string, number> (name -> spend). The component converts this into the array format Recharts expects.
 *  - Clicking a slice shows a small details panel anchored to the top-right of the chart and automatically dismisses after ~3 seconds.
 *  - Clicking outside the chart dismisses the panel immediately.
 *  - The timeoutRef is typed as NodeJS.Timeout; it is used purely for browser timeouts in this Next.js client component.
 *  - Styling and colors are inline to match the existing theming approach.
 */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from "recharts";

interface TopModelsPieProps {
  data: Record<string, number>;
}

interface SectorProps {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  endAngle?: number;
  fill?: string;
  percent?: number;
}

const RADIAN = Math.PI / 180;

/**
 * renderCustomizedLabel
 * Renders the percentage label positioned on each pie slice.
 * - Positions the label halfway between innerRadius and outerRadius using the midAngle.
 * - Returns an empty string when the slice percentage is zero to avoid clutter.
 */
const renderCustomizedLabel = ({
  cx = 0,
  cy = 0,
  midAngle = 0,
  innerRadius = 0,
  outerRadius = 0,
  percent = 0,
}: SectorProps) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const safePercent = typeof percent === "number" ? percent : 0;

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
    >
      {safePercent > 0 ? `${(safePercent * 100).toFixed(0)}%` : ""}
    </text>
  );
};

/**
 * renderActiveShape
 * Renders an enlarged sector used when a slice is active (clicked).
 * - Slightly increases the outer radius to visually emphasize the selected slice.
 */
const renderActiveShape = ({
  cx = 0,
  cy = 0,
  innerRadius = 0,
  outerRadius = 0,
  startAngle = 0,
  endAngle = 0,
  fill = "#000",
}: SectorProps) => (
  <Sector
    cx={cx}
    cy={cy}
    innerRadius={innerRadius}
    outerRadius={outerRadius + 10}
    startAngle={startAngle}
    endAngle={endAngle}
    fill={fill}
  />
);

/**
 * TopModelsPie
 * Main component displaying model/route spend as an interactive pie chart.
 *
 * Props:
 *  - data: Record<string, number> mapping route/model name to spend amount.
 *
 * Behavior:
 *  - Converts `data` into an array format for Recharts and calculates the total spend.
 *  - Clicking a slice sets it as the active slice and shows a transient details panel
 *    that displays the name, spend, and percentage for the slice.
 *  - The details panel automatically dismisses after ~3 seconds; clicking outside
 *    the chart will dismiss it immediately.
 */
export default function TopModelsPie({ data }: TopModelsPieProps) {
  const [selectedSlice, setSelectedSlice] = useState<{
    name: string;
    value: number;
    percent: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const COLORS = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#8884D8",
    "#A4DE6C",
  ];

  const pieData = Object.entries(data).map(([name, value]) => ({
    name,
    value,
  }));

  const total = pieData.reduce((sum, e) => sum + e.value, 0);

  const handleClick = useCallback(
    (index: number) => {
      const entry = pieData[index];
      if (!entry) return;

      setSelectedSlice({
        name: entry.name,
        value: entry.value,
        percent: entry.value / total,
      });

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setSelectedSlice(null);
      }, 3000);
    },
    [pieData, total],
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setSelectedSlice(null);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div
      id="top-models-pie"
      className="relative h-96 w-full"
      ref={containerRef}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <defs>
            <filter id="pieShadow" height="130%">
              <feDropShadow
                dx="5"
                dy="5"
                stdDeviation="5"
                floodColor="rgba(0,0,0,0.4)"
              />
            </filter>
          </defs>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomizedLabel}
            outerRadius={150}
            fill="#8884d8"
            dataKey="value"
            activeShape={renderActiveShape}
          >
            {pieData.map((entry, index) => (
              <Cell
                key={entry.name}
                fill={COLORS[index % COLORS.length]}
                onClick={(e) => {
                  e.stopPropagation();
                  handleClick(index);
                }}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {selectedSlice && (
        <div className="absolute top-4 right-4 z-50 w-64 rounded-lg border border-gray-600 bg-gray-800 p-4 text-white shadow-lg">
          <p className="mb-2 text-lg font-bold">{selectedSlice.name}</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="font-medium">Spend:</span>
            <span>${selectedSlice.value.toFixed(5)}</span>
            <span className="font-medium">Percentage:</span>
            <span>{(selectedSlice.percent * 100).toFixed(1)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
