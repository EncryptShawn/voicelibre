//src/app/api/usage/route.ts
/**
 * ./src/app/api/usage/route.ts
 *
 * Summary:
 * API route handler for fetching usage analytics for the authenticated user. Aggregates and transforms usage data from the backend API, providing totals, breakdowns, and periodized metrics for consumption by the frontend.
 *
 * Imports to:
 *  - Next.js API route system
 *
 * Exports:
 *  - GET (async function): Route handler for GET requests
 *
 * Exports used by:
 *  - src/components/usage/hooks/useUsageData.ts
 *
 * Nuances:
 *  - Authenticates user via next-auth session; returns 401 if not authenticated.
 *  - Decrypts per-user API key if present, otherwise uses global key.
 *  - Aggregates spend and token usage by route and by period (hour/day/month).
 *  - Returns a normalized response structure expected by the usage analytics hook.
 *  - Handles and reports API errors and malformed responses.
 */

import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { decryptApiKey } from "~/lib/utils/crypto";
import { auth } from "~/server/auth";

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

interface ApiResponse {
  items: QueryItem[];
  limit?: number;
  offset?: number;
  show?: string;
  days?: string;
  credits?: number;
}

/**
 * GET
 * Route handler for usage analytics requests.
 * - Authenticates the user and determines the API key to use.
 * - Fetches usage data from the backend API.
 * - Aggregates spend and token usage by route and by period.
 * - Returns a normalized response for usage analytics consumers.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const show = url.searchParams.get("show") ?? "all";
  const days = url.searchParams.get("days") ?? "3";

  let apiKey = process.env.APIPIE_API_KEY;
  const user = await db.user.findUnique({ where: { id: session.user.id } });

  if (user?.apipie_key) {
    const decrypted = decryptApiKey(user.apipie_key);
    if (typeof decrypted !== "string") return decrypted;
    apiKey = decrypted;
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: "API key not configured" },
      { status: 401 },
    );
  }

  try {
    const res = await fetch(
      `${process.env.APIPIE_BASE_URL}/v1/queries?show=${show}&days=${days}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      },
    );

    if (!res.ok) {
      throw new Error(`API request failed with status ${res.status}`);
    }

    const data: unknown = await res.json();
    if (
      typeof data !== "object" ||
      data === null ||
      !("items" in data) ||
      !Array.isArray((data as Record<string, unknown>).items)
    ) {
      throw new Error("Invalid API response format");
    }

    const {
      items,
      limit = 0,
      offset = 0,
      show: responseShow = show,
      days: responseDays = days,
      credits = 0,
    } = data as ApiResponse;

    const filteredItems = items;

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

    const allRoutes = Object.keys(spendByRoute);

    const spendByPeriodMap: Record<
      string,
      { cost: number; breakdown: Record<string, number> }
    > = {};

    filteredItems.forEach((item) => {
      let key: string;
      if (show === "hourly" || (show === "all" && days === "1")) {
        key = item.timestamp.slice(0, 13) + ":00";
      } else if (show === "daily") {
        key = item.timestamp.slice(0, 10);
      } else {
        key = item.timestamp.slice(0, 7);
      }

      const period = spendByPeriodMap[key] ?? { cost: 0, breakdown: {} };
      period.cost += item.cost;
      period.breakdown[item.route] =
        (period.breakdown[item.route] ?? 0) + item.cost;
      spendByPeriodMap[key] = period;
    });

    const spendByPeriod = Object.entries(spendByPeriodMap).map(
      ([timestamp, data]) => ({ timestamp, ...data }),
    );

    return NextResponse.json({
      items: filteredItems,
      recordCount: filteredItems.length,
      totalSpend,
      totalTokens,
      spendByRoute,
      spendByPeriod,
      topRoutes: allRoutes,
      limit,
      offset,
      show: responseShow,
      days: responseDays,
      credits,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
