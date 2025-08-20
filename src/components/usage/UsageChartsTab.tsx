/*
src/components/usage/UsageChartsTab.tsx

Summary:
  React component that renders the usage analytics charts section. It requests
  usage data via the useUsageData hook according to the provided `show` and
  `days` props (and optional `selectedApp`), shows lightweight loading/error
  states, and when data is available renders:
    - SummaryBar: current balance, total spend, and total tokens
    - TopModelsPie: pie chart for spend grouped by route
    - SpendOverTimeBar: stacked bar chart showing spend over time

Imports to:
  - This module is imported by pages or components that render the usage view,
    for example: src/app/usage/page.tsx

Exports:
  - default export: UsageChartsTab (React component)

Exports used by:
  - src/app/usage/page.tsx

Nuances:
  - The timeUnit passed into SpendOverTimeBar is derived from the props:
      days === 1  => "hour"
      else if show === "daily" => "day"
      otherwise => "week"
    This mapping is applied when transforming spendByPeriod before passing it down.
  - The component returns null when `data` is not present; parents control overall layout.
  - Relies on the useUsageData hook to provide a data shape that includes:
    totalSpend, totalTokens, credits, spendByRoute, spendByPeriod, topRoutes.
*/

"use client";

import useUsageData from "../usage/hooks/useUsageData";
import SummaryBar from "../usage/charts/SummaryBar";
import TopModelsPie from "../usage/charts/TopModelsPie";
import SpendOverTimeBar from "../usage/charts/SpendOverTimeBar";

interface UsageChartsTabProps {
  show: string;
  days: number;
  selectedApp?: string;
}

/**
 * UsageChartsTab
 *
 * Renders the charts view for usage analytics. Fetches usage data using the
 * useUsageData hook with the provided `show`, `days`, and optional `selectedApp`.
 * While loading it displays a simple placeholder, and if an error occurs it
 * displays an error placeholder. When data is available it composes three chart
 * components to present the insights.
 *
 * Props:
 *  - show: aggregation level requested from the backend (e.g. "hourly", "daily")
 *  - days: number of days the view should represent
 *  - selectedApp: optional application filter string
 *
 * Nuances:
 *  - The timeUnit supplied to SpendOverTimeBar is computed from `days` and `show`
 *    (see top-of-file Nuances section).
 */
export default function UsageChartsTab({
  show,
  days,
  selectedApp,
}: UsageChartsTabProps) {
  const { data, isLoading, error } = useUsageData({ show, days, selectedApp });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading data</div>;
  if (!data) return null;

  return (
    <div className="space-y-8">
      <SummaryBar
        totalSpend={data.totalSpend}
        totalTokens={data.totalTokens}
        credits={data.credits}
      />
      <TopModelsPie data={data.spendByRoute} />
      <SpendOverTimeBar
        data={data.spendByPeriod.map((period) => ({
          ...period,
          timeUnit: days <= 1 ? "hour" : days <= 30 ? "day" : "week",
        }))}
        topRoutes={data.topRoutes}
      />
    </div>
  );
}
