/*
src/app/api/models/route.ts

Summary:
API route for fetching available AI models, voice-capable models, and concrete voice entries from the apipie.ai backend. Handles query parameters to filter by type, provider, or request voice entries, and returns normalized model or voice data for use in the responder editing UI.

Imports to:
- Used internally by Next.js API routing.

Exports:
- export async function GET(request: Request)

Exports used by:
- src/components/bottomBar/hooks/useResponderModels.ts

Nuances:
- The endpoint dynamically builds the backend API URL based on query parameters (?type, ?provider, ?voices).
- Handles and normalizes error responses from the backend, returning appropriate HTTP status codes and error messages.
- Expects the backend to return a JSON object with a "data" property; returns only the "data" field to the client.
- Uses zod for query validation and returns 400 on validation errors.
*/

import { NextResponse } from "next/server";
import { z } from "zod";

const baseUrl = process.env.APIPIE_BASE_URL ?? "https://apipie.ai";
const apiKey = process.env.APIPIE_API_KEY;

const querySchema = z.object({
  type: z.enum(["voice", "llm"]).optional(),
  provider: z.string().optional(),
  voices: z.string().optional(),
});

/**
 * GET
 * Handles GET requests to /api/models. Validates query parameters, builds the appropriate backend API endpoint,
 * fetches model or voice data from apipie.ai, and returns the normalized result or error.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = Object.fromEntries(searchParams.entries());

  try {
    const validated = querySchema.parse(query);

    let endpoint = "/v1/models";

    if ("voices" in validated) {
      endpoint = "/v1/models?voices";
    } else if (validated.type) {
      endpoint += `?type=${validated.type}`;
    } else if (validated.provider === "pool") {
      endpoint += `?provider=pool`;
    }

    const url = `${baseUrl}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch models: ${response.statusText}` },
        { status: response.status },
      );
    }

    const result: unknown = await response.json();
    if (typeof result === "object" && result !== null && "data" in result) {
      return NextResponse.json((result as { data: unknown }).data);
    }

    return NextResponse.json(
      { error: "Unexpected response structure" },
      { status: 500 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
}
