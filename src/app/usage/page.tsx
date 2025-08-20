/**
 * File: src/app/usage/page.tsx
 *
 * Summary:
 *   UsagePage is the page component for the /usage route. It renders the header,
 *   controls for selecting application and time range, a tab switch between
 *   Charts and Records, and loads initial usage data. It delegates charts and
 *   records rendering to UsageChartsTab and UsageRecordsTab respectively.
 *
 * Imports to:
 *   - Next.js app router (this file is a Next.js app route page; not imported
 *     directly by other modules)
 *
 * Exports:
 *   - default: UsagePage React component
 *
 * Exports used by:
 *   - Next.js app router (renders this page at /usage)
 *
 * Nuances:
 *   - This file is a client component ("use client") and relies on client-only
 *     hooks and components (useState, useEffect, theme provider, and hooks that
 *     call browser-only APIs). Keep it as a client component.
 *   - The initial app dropdown is populated from useUsageData; the default app
 *     is set when initial data loads via useEffect.
 */
"use client";

import { useState, useEffect, useRef } from "react";
import { useTheme } from "~/lib/theme-provider";
import { HeaderBar } from "~/components/HeaderBar";
import UsageChartsTab from "~/components/usage/UsageChartsTab";
import UsageRecordsTab from "~/components/usage/UsageRecordsTab";
import useUsageData from "~/components/usage/hooks/useUsageData";

const timeOptions = [
  { label: "Last 24 Hours", value: "all", days: 1 },
  { label: "Last Week", value: "daily", days: 7 },
  { label: "Last Month", value: "daily", days: 30 },
  { label: "Last Year", value: "weekly", days: 365 },
];

export default function UsagePage() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<"charts" | "records">("charts");
  const [timeOption, setTimeOption] = useState({
    label: "Last 24 Hours",
    value: "hourly",
    days: 1,
  });
  const [selectedApp, setSelectedApp] = useState<string>("");
  const userPickedRef = useRef(false);

  // Get initial data to populate app dropdown and set default
  const { data: initialData } = useUsageData({
    show: timeOption.value,
    days: timeOption.days,
    selectedApp,
  });

  // Set default app when data loads
  useEffect(() => {
    if (!initialData) return;

    const apps = initialData.availableApps || [];
    const inList = selectedApp && apps.includes(selectedApp);
    const nextDefault = initialData.defaultApp ?? apps[0] ?? "";

    if (!userPickedRef.current || !inList) {
      setSelectedApp(nextDefault);
    }
  }, [initialData, selectedApp]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <div className="fixed top-0 right-0 left-0 z-50">
        <HeaderBar
          activeView="usage"
          onNav={(view) => {
            if (view === "chat") window.location.href = "/chat";
            else if (view === "transcripts")
              window.location.href = "/transcripts";
          }}
        />
        <div
          className="px-4 pb-4 shadow"
          style={{
            backgroundColor: theme === "dark" ? "#0f172a" : "#ffffff",
          }}
        >
          <div className="mx-auto max-w-7xl">
            <div className="flex items-center justify-between pt-4">
              <h1
                className="text-2xl font-bold"
                style={{ color: theme === "dark" ? "#ffffff" : "#111111" }}
              >
                Usage Analytics
              </h1>
              <div className="flex flex-col gap-3 sm:flex-row">
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none sm:w-[150px]"
                  style={{
                    backgroundColor: theme === "dark" ? "#1f2937" : "#ffffff",
                    color: theme === "dark" ? "#ffffff" : "#111111",
                    borderColor: theme === "dark" ? "#4b5563" : "#d1d5db",
                  }}
                  value={selectedApp}
                  onChange={(e) => {
                    userPickedRef.current = true;
                    setSelectedApp(e.target.value);
                  }}
                >
                  {initialData?.availableApps.map((app, idx) => (
                    <option
                      key={`${app}-${idx}`}
                      value={app}
                      style={{
                        backgroundColor:
                          theme === "dark" ? "#1f2937" : "#ffffff",
                        color: theme === "dark" ? "#ffffff" : "#111111",
                      }}
                    >
                      {app}
                    </option>
                  ))}
                </select>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none sm:w-[150px]"
                  style={{
                    backgroundColor: theme === "dark" ? "#1f2937" : "#ffffff",
                    color: theme === "dark" ? "#ffffff" : "#111111",
                    borderColor: theme === "dark" ? "#4b5563" : "#d1d5db",
                  }}
                  value={timeOption.label}
                  onChange={(e) => {
                    const selected = timeOptions.find(
                      (opt) => opt.label === e.target.value,
                    );
                    if (selected) {
                      userPickedRef.current = false;
                      setSelectedApp("");
                      setTimeOption(selected);
                    }
                  }}
                >
                  {timeOptions.map((option) => (
                    <option
                      key={option.label}
                      value={option.label}
                      style={{
                        backgroundColor:
                          theme === "dark" ? "#1f2937" : "#ffffff",
                        color: theme === "dark" ? "#ffffff" : "#111111",
                      }}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 flex border-b border-gray-200 dark:border-gray-700">
              <button
                className={`px-4 py-2 text-sm font-medium ${
                  activeTab === "charts"
                    ? "border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                    : "text-gray-500 dark:text-gray-400"
                }`}
                onClick={() => setActiveTab("charts")}
              >
                Charts
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium ${
                  activeTab === "records"
                    ? "border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                    : "text-gray-500 dark:text-gray-400"
                }`}
                onClick={() => setActiveTab("records")}
              >
                Records
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="mt-[200px] flex-1 overflow-y-auto px-4">
        <div className="mx-auto max-w-7xl pb-8">
          {activeTab === "charts" ? (
            <UsageChartsTab
              show={timeOption.value}
              days={timeOption.days}
              selectedApp={selectedApp}
            />
          ) : (
            <UsageRecordsTab
              show={timeOption.value}
              days={timeOption.days}
              selectedApp={selectedApp}
            />
          )}
        </div>
      </main>
    </div>
  );
}
