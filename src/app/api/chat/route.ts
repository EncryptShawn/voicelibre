/**
 * src/app/api/chat/route.ts
 *
 * Summary:
 * Handles the /api/chat POST route. Validates incoming chat requests, resolves the
 * requested responder configuration from the database, assembles the payload for the
 * upstream Apipie chat completions endpoint, and proxies a streaming response back to the client.
 *
 * Responsibilities:
 * - Authenticate the request (session-based).
 * - Validate and normalize input using Zod.
 * - Look up the responder by name and apply its model and defaults.
 * - Decrypt and select the appropriate Apipie API key (user-specific or system-wide).
 * - Forward a streaming chat completion request to the Apipie API and convert the response
 *   into a text/event-stream for the client using createResponseStream.
 * - Surface API and internal errors as JSON responses (non-streaming) when necessary.
 *
 * Imports to:
 * - Invoked by client code that posts chat messages to /api/chat.
 *
 * Exports:
 * - POST(request: Request): Route handler for POST requests to /api/chat.
 *
 * Exports used by:
 * - src/components/chat/hooks/useStreamingChat.ts (fetches /api/chat for streaming chat)
 * - src/components/bottomBar/hooks/useMemory.ts (fetches /api/chat for memory clear/re-remember)
 * - src/app/chat/page.tsx (indirectly, via useChat/useStreamingChat and useMemory)
 *
 * Nuances:
 * - This route expects streaming responses from the upstream API and returns a Server-Sent
 *   Events (SSE) response. Consumers must handle streaming message assembly.
 * - The handler requires a responder entry to exist in the database. Missing responders are
 *   treated as server errors and returned as a 500 with a descriptive message.
 * - API keys may be stored per-user (encrypted) or provided by the system; the encrypted key
 *   is decrypted via decryptApiKey before use.
 * - This module intentionally keeps request validation and response streaming logic here;
 *   heavier business rules belong in upstream helpers or services if expanded.
 */
import { NextResponse } from "next/server";
import { db } from "../../../server/db";
import { z } from "zod";
import { decryptApiKey } from "../../../lib/utils/crypto";
import { createResponseStream } from "../_utils/stream";
import { auth } from "../../../server/auth";

const bodySchema = z.object({
  text: z.string().min(1).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string(),
      }),
    )
    .optional(),
  promptName: z.string().optional().default("General"),
  memory: z.boolean().optional().default(false),
  mem_clear: z.boolean().optional().default(false),
  user: z.string().optional(),
  web_search_options: z
    .object({
      search_context_size: z.enum(["low", "medium", "high"]).optional(),
    })
    .optional(),
  short_mem: z.number().optional(),
  long_mem: z.number().optional(),
  mem_expire: z.number().optional(),
});

/**
 * POST
 *
 * Route handler for POST /api/chat.
 *
 * Input:
 * - Expects a JSON body matching `bodySchema`:
 *   - text?: string
 *   - messages?: { role: "system" | "user" | "assistant", content: string }[]
 *   - promptName?: string (defaults to "General")
 *   - memory?: boolean
 *   - mem_clear?: boolean
 *   - user?: string
 *   - web_search_options?: { search_context_size?: "low" | "medium" | "high" }
 *   - short_mem?: number
 *   - long_mem?: number
 *   - mem_expire?: number
 *
 * Behavior:
 * - Authenticates the caller using `auth()`. Returns 401 if unauthenticated.
 * - Parses and validates the request body with Zod.
 * - Looks up the responder (by promptName) in the database and uses its model and defaults.
 * - Resolves an Apipie API key (user-specific encrypted key or fallback system key).
 * - Calls the Apipie chat completions endpoint with `stream: true` and proxies the streaming
 *   response back to the client as `text/event-stream`. Usage metadata (when present) is
 *   captured by createResponseStream and emitted in the stream.
 * - On upstream API failures returns a JSON error with the upstream status code.
 * - Logs unexpected errors and returns a 500 JSON error response.
 *
 * Returns:
 * - Streaming Response (SSE) on success with proper SSE headers.
 * - JSON error responses for auth, validation, missing responder, API key absence,
 *   upstream API errors, or internal errors.
 *
 * Nuances:
 * - This handler intentionally returns non-stream JSON for error cases to make client
 *   error handling simpler.
 * - The function relies on `createResponseStream` to normalize the upstream streaming
 *   payload into a consumable SSE stream for the client.
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody: unknown = await request.json();
    const parsed = bodySchema.parse(rawBody);
    const {
      text,
      messages,
      promptName,
      memory,
      web_search_options,
      mem_clear,
    } = parsed;

    const responder = await db.responders.findUnique({
      where: {
        responder: {
          owner: "system",
          name: promptName,
        },
      },
    });

    if (!responder) {
      return NextResponse.json(
        { error: `Responder "${promptName}" not found` },
        { status: 500 },
      );
    }

    let apipieApiKey = process.env.APIPIE_API_KEY ?? "";
    const user = await db.user.findUnique({ where: { id: session.user.id } });
    const encryptedKey = user?.apipie_key;

    if (encryptedKey) {
      const decrypted = decryptApiKey(encryptedKey);
      if (typeof decrypted !== "string") return decrypted;
      apipieApiKey = decrypted;
    }

    if (!apipieApiKey) {
      return NextResponse.json(
        { error: "APIpie API key not configured" },
        { status: 500 },
      );
    }

    const baseUrl = process.env.APIPIE_BASE_URL ?? "https://apipie.ai";
    const chatResponse = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apipieApiKey}`,
      },
      body: JSON.stringify({
        model: responder.model,
        messages: messages ?? [
          { role: "system", content: responder.prompt },
          { role: "user", content: text ?? "" },
        ],
        ...(web_search_options && { web_search_options }),
        ...(memory && { memory: true }),
        ...(mem_clear && { mem_clear: true }),
        user: session.user.id,
        ...(parsed.short_mem !== undefined && { short_mem: parsed.short_mem }),
        ...(parsed.long_mem !== undefined && { long_mem: parsed.long_mem }),
        ...(parsed.mem_expire !== undefined && {
          mem_expire: parsed.mem_expire,
        }),
        stream: true,
        temperature: 0.6,
        max_tokens: responder.max_tokens ?? 300,
      }),
    });

    if (!chatResponse.ok) {
      const errorData: unknown = await chatResponse.json();
      const apiError = errorData as { error?: { message?: string } };
      return NextResponse.json(
        { error: apiError.error?.message ?? "Chat completion failed" },
        { status: chatResponse.status },
      );
    }

    const stream = createResponseStream(chatResponse);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat completion error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
