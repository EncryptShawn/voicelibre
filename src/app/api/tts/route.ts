/*
src/app/api/tts/route.ts

Summary:
  Next.js API route for Text-to-Speech (TTS) audio generation. Handles POST requests with text input, authenticates the user, determines the appropriate voice model, and proxies the request to the APIpie TTS backend. Returns an audio/mpeg stream and optionally includes audio usage details in the response headers.

Imports to:
  - Not directly imported; used by Next.js API routing.

Exports:
  - POST

Exports used by:
  - src/components/chat/hooks/useTTSPlayer.ts (calls this route via HTTP POST to /api/tts)

Nuances:
  - If a user has a custom APIpie key, it is decrypted and used for the request; otherwise, the system key is used.
  - The responder (voice model) is looked up by promptName; if not found, a 500 error is returned.
  - The route expects the APIpie backend to return an audio stream and may include an X-Audio-Details header with usage/cost/latency.
  - The route always returns audio/mpeg on success, with no caching and chunked transfer encoding.
*/

import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { decryptApiKey } from "~/lib/utils/crypto";
import { auth } from "~/server/auth";

interface RequestBody {
  text: string;
  promptName?: string;
}

/**
 * Handles POST requests for TTS audio generation.
 *
 * - Validates input and user authentication.
 * - Looks up the responder (voice model) by promptName.
 * - Selects the correct APIpie API key (user or system).
 * - Proxies the request to APIpie TTS backend and streams the audio response.
 * - Returns audio/mpeg with optional X-Audio-Details header.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const { text, promptName = "General" } = body;

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

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

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let apipieApiKey: string | undefined = process.env.APIPIE_API_KEY;
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

    const baseUrl = process.env.APIPIE_BASE_URL ?? "https://apipie.ai";

    const ttsResponse = await fetch(`${baseUrl}/v1/audio/speech`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apipieApiKey}`,
      },
      body: JSON.stringify({
        model: responder.voice_model?.split("/")[1] ?? "gpt-4o-mini-tts",
        provider: responder.voice_model?.split("/")[0] ?? "openai",
        input: text,
        voice: responder.voice ?? "echo",
        response_format: "mp3",
        user: session.user.id,
      }),
    });

    if (!ttsResponse.ok || !ttsResponse.body) {
      const errorData = (await ttsResponse.json()) as {
        error?: { message?: string };
      };
      return NextResponse.json(
        { error: errorData.error?.message ?? "TTS generation failed" },
        { status: ttsResponse.status },
      );
    }

    const headers = new Headers({
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
      "X-Content-Type-Options": "nosniff",
    });

    const audioDetails = ttsResponse.headers.get("X-Audio-Details");
    if (audioDetails) {
      headers.set("X-Audio-Details", audioDetails);
    }

    return new Response(ttsResponse.body, {
      headers,
    });
  } catch (error) {
    console.error("TTS generation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
