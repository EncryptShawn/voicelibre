/**
 * ./src/components/usage/hooks/useUsageData.ts
 *
 * Summary:
 * Hook to fetch and memoize usage analytics for the currently authenticated user.
 * Responsibilities:
 *  - Fetch raw usage data from the backend endpoint (/api/usage).
 *  - Derive availableApps and defaultApp from returned items.
 *  - Provide filtered metrics for a selected app (totalSpend, totalTokens, spendByRoute, spendByPeriod, topRoutes).
 *
 * Imports to:
 *  - src/components/usage/UsageChartsTab.tsx
 *  - src/components/usage/UsageRecordsTab.tsx
 *  - src/app/usage/page.tsx
 *
 * Exports:
 *  - default: useUsageData (hook)
 *  - named: QueryItem (interface)
 *
 * Exports used by:
 *  - src/components/usage/UsageChartsTab.tsx
 *  - src/components/usage/UsageRecordsTab.tsx
 *  - src/app/usage/page.tsx
 *
 * Nuances:
 *  - This is a client-side only module ("use client") and requires next-auth session to obtain the user id.
 *  - The hook expects the API response to include at minimum:
 *      items, recordCount, totalSpend, totalTokens, spendByRoute, spendByPeriod, topRoutes.
 *  - Default app selection uses a simple heuristic that prefers names containing "voice" and "libre".
 *
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";

export interface QueryItem {
  timestamp: string;
  app: string;
  provider: string;
  route: string;
  prompt_tokens?: number;
  response_tokens?: number;
  cost: number;
  latency_ms: number;
  ttfc_ms?: number;
}

interface UsageData {
  items: QueryItem[];
  recordCount: number;
  totalSpend: number;
  totalTokens: number;
  credits: number;
  spendByRoute: Record<string, number>;
  spendByPeriod: Array<{
    timestamp: string;
    cost: number;
    breakdown: Record<string, number>;
  }>;
  topRoutes: string[];
  availableApps: string[];
  defaultApp: string;
}

/**
 * getDefaultApp
 * Choose a sensible default app name from a list of app identifiers.
 * Preference order:
 *  1) App containing both "voice" and "libre" (case-insensitive)
 *  2) App containing "voice"
 *  3) App containing "libre"
 *  4) First app alphabetically
 */
function getDefaultApp(apps: string[]): string {
  if (apps.length === 0) return "";

  const sortedApps = [...apps].sort();

  const voiceLibre = sortedApps.find(
    (app) =>
      app.toLowerCase().includes("voice") &&
      app.toLowerCase().includes("libre"),
  );
  if (voiceLibre) return voiceLibre;

  const voice = sortedApps.find((app) => app.toLowerCase().includes("voice"));
  if (voice) return voice;

  const libre = sortedApps.find((app) => app.toLowerCase().includes("libre"));
  if (libre) return libre;

  return sortedApps[0] ?? "";
}

/**
 * useUsageData
 * Fetches usage data for the authenticated user and returns memoized, optionally app-filtered metrics.
 *
 * Parameters:
 *  - show: display granularity (e.g. "hourly", "daily", "weekly")
 *  - days: number of days to include in the query
 *  - selectedApp: optional app identifier to filter results
 *
 * Returns:
 *  - { data, isLoading, error }
 *    data: derived UsageData with recalculated metrics when an app is selected (or null while loading)
 *    isLoading: boolean loading state
 *    error: error message string or null
 *
 * Nuances:
 *  - Requires next-auth session to provide the user id used when calling /api/usage.
 *  - If the API response doesn't match the expected structure the hook sets error.
 */
export default function useUsageData({
  show,
  days,
  selectedApp,
}: {
  show: string;
  days: number;
  selectedApp?: string;
}) {
  const { data: session, status } = useSession();
  const [rawData, setRawData] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const userId = session?.user?.id;
        if (!userId) {
          throw new Error("User ID missing");
        }

        const res = await fetch(
          `/api/usage?show=${show}&days=${days}&user=${userId}`,
          {
            headers: { Accept: "application/json" },
          },
        );

        if (!res.ok) throw new Error("Failed to fetch usage data");

        const json: unknown = await res.json();

        if (
          typeof json === "object" &&
          json !== null &&
          "items" in json &&
          "recordCount" in json &&
          "totalSpend" in json &&
          "totalTokens" in json &&
          "spendByRoute" in json &&
          "spendByPeriod" in json &&
          "topRoutes" in json
        ) {
          const typed = json as Omit<UsageData, "availableApps" | "defaultApp">;

          const seen = new Set<string>();
          const availableApps = typed.items
            .map((item) => item.app)
            .filter((app): app is string => !!app && app.trim().length > 0)
            .filter((app) => {
              const k = app.toLowerCase();
              if (seen.has(k)) return false;
              seen.add(k);
              return true;
            })
            .sort((a, b) =>
              a.localeCompare(b, undefined, { sensitivity: "base" }),
            );

          const defaultApp = getDefaultApp(availableApps);

          setRawData({
            items: typed.items,
            recordCount: typed.recordCount,
            totalSpend: typed.totalSpend,
            totalTokens: typed.totalTokens,
            credits: typed.credits ?? 0,
            spendByRoute: typed.spendByRoute,
            spendByPeriod: typed.spendByPeriod,
            topRoutes: typed.topRoutes,
            availableApps,
            defaultApp,
          });
        } else {
          throw new Error("Invalid response structure");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    if (status === "authenticated") {
      void fetchData();
    }
  }, [show, days, session?.user?.id, status]);

  const data = useMemo(() => {
    if (!rawData) return null;

    const appToFilter = selectedApp?.trim() ?? rawData.defaultApp;

    if (!appToFilter) return rawData;

    const target = appToFilter.toLowerCase();
    const filteredItems = rawData.items.filter(
      (item) => (item.app?.toLowerCase() ?? "") === target,
    );

    const totalSpend = filteredItems.reduce((sum, item) => sum + item.cost, 0);
    const totalTokens = filteredItems.reduce(
      (sum, item) =>
        sum + (item.prompt_tokens ?? 0) + (item.response_tokens ?? 0),
      0,
    );
    const spendByRoute: Record<string, number> = {};
    filteredItems.forEach((item) => {
      spendByRoute[item.route] = (spendByRoute[item.route] ?? 0) + item.cost;
    });

    // Period series:
    // - If we have filtered rows, bucket them (hour/day/week) so each period shows ONLY that app.
    // - If filteredItems is empty BUT the server already provided a period series, use it verbatim
    //   so the bar chart doesn't render empty due to lack of per-row items for aggregated views.
    //   (We still keep totals/route from filteredItems, i.e., they stay zero if no usage.)
    let spendByPeriod: Array<{
      timestamp: string;
      cost: number;
      breakdown: Record<string, number>;
    }>;

    if (filteredItems.length > 0) {
      const timeUnit = days <= 1 ? "hour" : days <= 30 ? "day" : "week";
      const periodMap = new Map<
        string,
        { cost: number; breakdown: Record<string, number> }
      >();

      filteredItems.forEach((item) => {
        const d = new Date(item.timestamp);
        if (timeUnit === "hour") {
          d.setMinutes(0, 0, 0);
        } else if (timeUnit === "day") {
          d.setHours(0, 0, 0, 0);
        } else {
          const day = d.getDay();
          const diffToMonday = day === 0 ? -6 : 1 - day;
          d.setDate(d.getDate() + diffToMonday);
          d.setHours(0, 0, 0, 0);
        }

        const key =
          timeUnit === "hour"
            ? new Date(
                Date.UTC(
                  d.getUTCFullYear(),
                  d.getUTCMonth(),
                  d.getUTCDate(),
                  d.getUTCHours(),
                ),
              ).toISOString()
            : new Date(
                Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
              ).toISOString();

        if (!periodMap.has(key)) {
          periodMap.set(key, { cost: 0, breakdown: {} });
        }
        const period = periodMap.get(key)!;
        period.cost += item.cost;
        period.breakdown[item.route] =
          (period.breakdown[item.route] ?? 0) + item.cost;
      });

      spendByPeriod = Array.from(periodMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([timestamp, data]) => ({
          timestamp,
          cost: data.cost,
          breakdown: data.breakdown,
        }));
    } else {
      spendByPeriod = rawData.spendByPeriod ?? [];
    }

    const topRoutes = Object.entries(spendByRoute)
      .sort(([, a], [, b]) => b - a)
      .map(([route]) => route);

    return {
      ...rawData,
      items: filteredItems,
      recordCount: filteredItems.length,
      totalSpend,
      totalTokens,
      spendByRoute,
      spendByPeriod,
      topRoutes,
    };
  }, [rawData, selectedApp, days]);

  return { data, isLoading, error };
}
