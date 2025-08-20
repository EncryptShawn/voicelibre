//src/components/usage/charts/sumamryBarr.ts
//
// Imported by usage page shows the users balance and overall usage stats for spend and tokens.

"use client";

import { useTheme } from "~/lib/theme-provider";

interface SummaryBarProps {
  totalSpend: number;
  totalTokens: number;
  credits: number;
}

export default function SummaryBar({
  totalSpend,
  totalTokens,
  credits,
}: SummaryBarProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div
      className="flex flex-col gap-4 rounded-lg p-4"
      style={{
        backgroundColor: isDark ? "rgb(var(--background))" : "#f3f4f6",
      }}
    >
      <div
        className="rounded p-4 shadow"
        style={{
          backgroundColor: isDark ? "rgb(var(--header-footer-bg))" : "#ffffff",
        }}
      >
        <h3
          className="text-sm font-medium"
          style={{
            color: isDark ? "#94a3b8" : "#6b7280",
          }}
        >
          Current Balance
        </h3>
        <p
          className="text-2xl font-bold"
          style={{
            color: isDark ? "#ffffff" : "#111827",
          }}
        >
          ${credits.toFixed(2)}
        </p>
      </div>
      <div className="flex gap-4">
        <div
          className="flex-1 rounded p-4 shadow"
          style={{
            backgroundColor: isDark
              ? "rgb(var(--header-footer-bg))"
              : "#ffffff",
          }}
        >
          <h3
            className="text-sm font-medium"
            style={{
              color: isDark ? "#94a3b8" : "#6b7280",
            }}
          >
            Total Spend
          </h3>
          <p
            className="text-2xl font-bold"
            style={{
              color: isDark ? "#ffffff" : "#111827",
            }}
          >
            ${totalSpend.toFixed(5)}
          </p>
        </div>
        <div
          className="flex-1 rounded p-4 shadow"
          style={{
            backgroundColor: isDark
              ? "rgb(var(--header-footer-bg))"
              : "#ffffff",
          }}
        >
          <h3
            className="text-sm font-medium"
            style={{
              color: isDark ? "#94a3b8" : "#6b7280",
            }}
          >
            Total Tokens
          </h3>
          <p
            className="text-2xl font-bold"
            style={{
              color: isDark ? "#ffffff" : "#111827",
            }}
          >
            {totalTokens.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
