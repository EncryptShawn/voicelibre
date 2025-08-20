/**
 * src/components/usage/UsageRecordsTab.tsx
 *
 * Summary:
 *   Renders the "Usage Records" tab for the usage analytics area. This module
 *   fetches and displays a list of usage records (timestamp, route, cost) and
 *   provides a lightweight wrapper that keys the inner component to the
 *   selected time range and application. The module delegates the actual table
 *   rendering to UsageRecordsInner which is responsible for rendering rows and
 *   handling theme-based styling.
 *
 * Imports to:
 *   - ~/app/usage/page.tsx
 *
 * Exports:
 *   - default: UsageRecordsTab
 *
 * Exports used by:
 *   - src/app/usage/page.tsx
 *
 * Nuances:
 *   - This file uses useUsageData hook to load the usage payload and then
 *     filters/keys the inner renderer. The outer component exists primarily to
 *     provide a stable key when the selected time range or app changes.
 *   - Keep comments high-level only; the inner rendering logic is intentionally
 *     compact and relies on theme provider values for styling.
 */
"use client";

import { useTheme } from "~/lib/theme-provider";
import useUsageData from "./hooks/useUsageData";

interface UsageRecordsTabProps {
  show: string;
  days: number;
  selectedApp?: string;
}

/**
 * UsageRecordsTab
 *
 * Description:
 *   Lightweight wrapper component that creates a stable React key for the
 *   UsageRecordsInner component based on the show/days/selectedApp props.
 *   This ensures the inner component remounts when those values change so the
 *   table and its data are refreshed predictably.
 *
 * Props:
 *   - show: string (time granularity, e.g. "daily" | "hourly")
 *   - days: number (number of days to show)
 *   - selectedApp?: string (optional application filter)
 */
export default function UsageRecordsTab({
  show,
  days,
  selectedApp,
}: UsageRecordsTabProps) {
  const key = `${show}-${days}-${selectedApp ?? "all"}`;
  return (
    <UsageRecordsInner
      key={key}
      show={show}
      days={days}
      selectedApp={selectedApp}
    />
  );
}

/**
 * UsageRecordsInner
 *
 * Description:
 *   Responsible for loading usage data via the useUsageData hook and rendering
 *   the records table. Applies theme-aware styles and formats timestamps for
 *   display. This is the primary UI implementation for the "Records" tab.
 *
 * Notes:
 *   - Returns early for loading / error / empty states.
 *   - Avoids inline/trivial comments; the table rows are self-explanatory.
 */
function UsageRecordsInner({ show, days, selectedApp }: UsageRecordsTabProps) {
  const { theme } = useTheme();
  const { data, isLoading, error } = useUsageData({ show, days, selectedApp });
  const isDark = theme === "dark";
  const bgColor = isDark ? "rgb(var(--background))" : "#ffffff";
  const rowBg = isDark ? "rgb(var(--header-footer-bg))" : "#ffffff";
  const textColor = isDark ? "#ffffff" : "#111111";
  const subTextColor = isDark ? "#cbd5e1" : "#6b7280";
  const borderColor = isDark ? "#475569" : "#e5e7eb";

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading data</div>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div
        className="overflow-x-auto rounded-lg"
        style={{ border: `1px solid ${borderColor}` }}
      >
        <table className="min-w-full" style={{ backgroundColor: bgColor }}>
          <thead style={{ backgroundColor: isDark ? "#334155" : "#f9fafb" }}>
            <tr>
              <th
                className="px-4 py-3 text-left text-xs font-medium tracking-wider uppercase"
                style={{ color: subTextColor }}
              >
                Timestamp
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium tracking-wider uppercase"
                style={{ color: subTextColor }}
              >
                Route & Cost
              </th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, index) => {
              const timestamp = new Date(item.timestamp);
              const date = timestamp.toLocaleDateString();
              const time = timestamp.toLocaleTimeString();

              return (
                <tr
                  key={`${item.timestamp}-${index}`}
                  style={{ backgroundColor: rowBg }}
                >
                  <td className="px-4 py-4 text-sm whitespace-nowrap">
                    <div className="leading-tight" style={{ color: textColor }}>
                      <div>{date}</div>
                      <div className="text-xs" style={{ color: subTextColor }}>
                        {time}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm whitespace-nowrap">
                    <div
                      className="leading-tight"
                      style={{ color: subTextColor }}
                    >
                      <div>{item.route}</div>
                      <div className="text-xs" style={{ color: subTextColor }}>
                        ${item.cost.toFixed(5)}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
