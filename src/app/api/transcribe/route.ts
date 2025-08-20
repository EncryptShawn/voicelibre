/*
  src/app/api/transcribe/route.ts

  Summary:
    Next.js API route for audio transcription. Handles both JSON and multipart/form-data requests.
    For JSON requests with mode "chat", it echoes back the provided text. For multipart/form-data,
    it authenticates the user, retrieves the appropriate API key, and streams audio transcription
    results from the APIpie service back to the client as a server-sent event (SSE) stream.

  Imports to:
    - (Imported by Next.js API route system)

  Exports:
    - POST (async function handling POST requests)

  Exports used by:
    - src/components/bottomBar/hooks/useHandsfree.ts (calls /api/transcribe endpoint for streaming transcription)

  Nuances:
    - If a user has a stored apipie_key, it is decrypted and used instead of the default API key.
    - The endpoint streams the response from APIpie as an SSE stream, which is expected by the client.
    - Returns specific error messages and status codes for missing fields, unauthorized access, and API errors.
*/

import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { decryptApiKey } from "~/lib/utils/crypto";
import { createResponseStream } from "../_utils/stream";
import { auth } from "~/server/auth";

interface ChatJsonPayload {
  mode?: string;
  text?: string;
}

/**
 * POST
 *
 * Handles POST requests for the /api/transcribe endpoint.
 * - For JSON requests with mode "chat", echoes back the provided text.
 * - For multipart/form-data requests, authenticates the user, retrieves the API key,
 *   and streams audio transcription results from APIpie as a server-sent event (SSE) stream.
 * - Returns appropriate error responses for missing fields, unauthorized access, or API errors.
 */
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type");

    if (contentType?.includes("application/json")) {
      const json = (await request.json()) as ChatJsonPayload;

      if (json?.mode === "chat") {
        return NextResponse.json({ text: json.text ?? "" });
      }

      return NextResponse.json(
        { error: "Invalid mode specified" },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const model = formData.get("model");

    if (!(file instanceof File) || typeof model !== "string") {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let apipieApiKey = process.env.APIPIE_API_KEY;
    const user = await db.user.findUnique({ where: { id: session.user.id } });

    if (user?.apipie_key) {
      const decrypted = decryptApiKey(user.apipie_key);
      if (typeof decrypted !== "string") {
        return decrypted;
      }
      apipieApiKey = decrypted;
    }

    if (!apipieApiKey) {
      return NextResponse.json(
        { error: "APIpie API key not configured" },
        { status: 500 },
      );
    }

    const form = new FormData();
    form.append("file", file, file.name);
    form.append("model", model);
    form.append("stream", "true");
    form.append("user", session.user.id);

    const baseUrl = process.env.APIPIE_BASE_URL ?? "https://apipie.ai";

    const response = await fetch(`${baseUrl}/v1/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apipieApiKey}`,
      },
      body: form,
    });

    if (!response.ok) {
      const error: unknown = await response.json();
      const errMsg =
        typeof error === "object" &&
        error !== null &&
        "error" in error &&
        typeof (error as { error?: { message?: unknown } }).error?.message ===
          "string"
          ? (error as { error?: { message?: string } }).error!.message
          : "Transcription failed";

      return NextResponse.json({ error: errMsg }, { status: response.status });
    }

    if (!response.body) {
      return NextResponse.json(
        { error: "No response body from APIpie" },
        { status: 500 },
      );
    }

    const stream = createResponseStream(response);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Transcription error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
